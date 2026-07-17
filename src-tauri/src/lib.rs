use std::sync::Mutex;

use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Phase 2: real sidecar bundling. Replaces Phase 1's "whatever node is on
// PATH" with Tauri's actual production mechanism — a Node runtime binary
// bundled per-platform via `externalBin` (staged by
// scripts/stage-tauri-sidecar.mjs), spawned via `app.shell().sidecar(...)`.
// server.js + its node_modules (including a matching-ABI better-sqlite3)
// ship alongside as plain `resources`, resolved at runtime via
// `app.path().resource_dir()`.
//
// Phase 3: feature parity with main.js's Electron shell — single-instance
// lock, PID-file orphan recovery, kill-on-quit, macOS dock hide/reopen,
// external links routed to the system browser, and the same V8 heap cap.

struct ServerState {
    child: Mutex<Option<CommandChild>>,
}

fn server_pid_file_path(app_data_dir: &std::path::Path) -> std::path::PathBuf {
    app_data_dir.join("server.pid")
}

// Kill any headless sidecar left running from a previous session that
// crashed or was force-killed before it could clean up after itself (normal
// quit already handles this via the RunEvent::Exit handler below). Mirrors
// main.js's cleanupOrphanedServer().
fn cleanup_orphaned_server(app_data_dir: &std::path::Path) {
    let pid_file = server_pid_file_path(app_data_dir);
    let Ok(contents) = std::fs::read_to_string(&pid_file) else {
        return;
    };
    let _ = std::fs::remove_file(&pid_file);

    let Ok(pid) = contents.trim().parse::<u32>() else {
        return;
    };

    // Confirm this PID is still our own orphaned backend process before
    // touching it — the OS can reuse a PID for an unrelated process between
    // runs, and killing based on liveness alone would be unsafe.
    let cmdline_matches = if cfg!(target_os = "windows") {
        // wmic.exe is deprecated and removed outright on Windows 11 24H2+;
        // Get-CimInstance is the modern replacement and is present on every
        // currently-supported Windows version (it's part of Windows
        // PowerShell 5.1, built into the OS since Windows 7/2008 R2).
        std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine"),
            ])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains("server.js"))
            .unwrap_or(false)
    } else {
        std::process::Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "command="])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains("server.js"))
            .unwrap_or(false)
    };

    if !cmdline_matches {
        return;
    }

    if cfg!(target_os = "windows") {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status();
    } else {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
    }
}

// Reproduces Electron's setWindowOpenHandler without touching the portable
// frontend. Two distinct interception points are needed:
//
// 1. `<a target="_blank">` clicks (updates.tsx, page.tsx's footer link,
//    app-shell.tsx) never call the page's window.open() JS function at all —
//    WKWebView/wry handle target="_blank" as a native "new window" request,
//    and since no popup window is configured, it's silently dropped (this
//    was confirmed live: clicking did nothing). The only way to catch it is
//    a capture-phase click listener that preempts the browser's default
//    action before it decides to open a new browsing context.
// 2. Programmatic `window.open(url)` calls (contacts.tsx's CSV export) don't
//    go through a click event at all, so they still need the window.open
//    override.
const OPEN_OVERRIDE_INIT_SCRIPT: &str = r#"
(function () {
  window.open = function (url) {
    if (url) {
      window.__TAURI_INTERNALS__.invoke('open_external_url', { url: String(url) }).catch(function () {});
    }
    return null;
  };

  document.addEventListener('click', function (e) {
    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.href) return;
    if (el.target === '_blank') {
      e.preventDefault();
      window.__TAURI_INTERNALS__.invoke('open_external_url', { url: el.href }).catch(function () {});
    }
  }, true);
})();
"#;

#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Someone tried to run a second instance — focus our window
            // instead of starting a duplicate backend.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![open_external_url])
        .on_window_event(|window, event| {
            // On macOS, closing the *dashboard* window (red button) hides it
            // instead of quitting — clicking the Dock icon re-shows it via
            // the Reopen handler below. Matches main.js's
            // window-all-closed/activate pair, which only quits on
            // non-darwin platforms. Scoped to label "main" specifically:
            // the transient "splash" placeholder must be allowed to actually
            // close (see setup(), where it's replaced by the real dashboard
            // window) rather than being hidden and kept alive under the
            // hood, which would leave its label permanently unavailable.
            if cfg!(target_os = "macos") && window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve the app's resource directory");
            let server_app_dir = resource_dir.join("server-app");
            let server_js_path = server_app_dir.join("server.js");
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve the app's data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create the app's data directory");

            // Created early and seeded with the resolved paths so a future
            // "stuck at Starting backend" report's watchdog diagnostic (see
            // below) immediately shows whether these paths were resolved
            // sanely, rather than needing another back-and-forth to rule out
            // a bug in our own path computation vs. Node internals.
            let captured_output: std::sync::Arc<Mutex<Vec<String>>> =
                std::sync::Arc::new(Mutex::new(Vec::new()));
            for line in [
                format!("[lib.rs] resource_dir={}", resource_dir.display()),
                format!("[lib.rs] server_js_path={}", server_js_path.display()),
                format!("[lib.rs] app_data_dir={}", app_data_dir.display()),
            ] {
                println!("{line}");
                captured_output.lock().unwrap().push(line);
            }

            cleanup_orphaned_server(&app_data_dir);

            // Lightweight placeholder window shown immediately while the
            // sidecar boots. It carries no init script or nav guard — it
            // never has any links — since neither would survive being
            // replaced below anyway. Labeled "splash" (not "main") so the
            // on_window_event hide-not-quit handler above doesn't intercept
            // its close() call below once the real dashboard is ready.
            WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("index.html".into()))
                .title("Srotas WhatsApp Bot")
                .inner_size(1200.0, 800.0)
                .resizable(true)
                .fullscreen(false)
                .build()
                .expect("failed to build the placeholder window");

            // Same V8 heap cap as the Electron build's utilityProcess.fork()
            // execArgv, applied here as a plain CLI flag since the sidecar is
            // a real separate process rather than an in-process fork.
            let (mut rx, child) = app
                .shell()
                .sidecar("node")
                .expect("failed to create sidecar command for `node` — check externalBin config")
                .args([
                    "--max-old-space-size=256".to_string(),
                    // Works around a real bug confirmed on real ARM64
                    // Windows hardware (not just an x64-on-ARM64 VMware
                    // emulation quirk): Node's own module resolution walks
                    // paths resolving symlinks via fs.realpathSync, and
                    // chokes with `EISDIR: illegal operation on a directory,
                    // lstat 'C:'`. --preserve-symlinks-main alone only fixed
                    // this for resolving the main entry script (server.js)
                    // — the identical bug then resurfaced on the very next
                    // require() call inside server.js, in the CJS loader's
                    // general module resolution path rather than
                    // resolveMainPath specifically. --preserve-symlinks
                    // covers that broader path, skipping the same realpath
                    // walk for every subsequent require(), not just the
                    // entry point.
                    "--preserve-symlinks-main".to_string(),
                    "--preserve-symlinks".to_string(),
                    server_js_path.to_string_lossy().to_string(),
                ])
                .env("PORT", "0")
                .env("APP_USER_DATA_PATH", app_data_dir.to_string_lossy().to_string())
                .spawn()
                .expect("failed to spawn the node sidecar");

            let _ = std::fs::write(server_pid_file_path(&app_data_dir), child.pid().to_string());
            *app.state::<ServerState>().child.lock().unwrap() = Some(child);

            let app_handle = app.handle().clone();

            // captured_output (declared earlier, seeded with resolved paths)
            // also captures the sidecar's combined stdout/stderr from here
            // on, so the timeout watchdog below can show it if the backend
            // never reports its port. Without this, a startup failure is
            // invisible: server.js's own uncaughtException handler logs to
            // crash.log but never calls process.exit(), so any early throw
            // (wrong native-module ABI, a missing runtime DLL, antivirus
            // interference — anything) leaves the sidecar process alive but
            // stuck, and the splash screen would otherwise just say
            // "Starting backend..." forever with zero indication anything is
            // wrong.
            {
                let app_handle = app_handle.clone();
                let captured_output = captured_output.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(20));
                    // If "splash" is gone, the real dashboard window already
                    // took over — nothing to do. If it's still there, the
                    // backend never reported its port in time.
                    if let Some(splash) = app_handle.get_webview_window("splash") {
                        let log_tail = captured_output.lock().unwrap().join("\n");
                        let log_json = serde_json::to_string(&log_tail)
                            .unwrap_or_else(|_| "\"(failed to capture log)\"".to_string());
                        let js = format!(
                            r#"(function() {{
                                document.body.innerHTML = '';
                                document.body.style.cssText = 'background:#080c14;color:#e8edf5;font-family:sans-serif;margin:0;padding:24px;';
                                var h = document.createElement('h3');
                                h.style.color = '#f87171';
                                h.textContent = 'Backend did not start within 20 seconds';
                                var pre = document.createElement('pre');
                                pre.style.cssText = 'background:#111;padding:12px;border-radius:8px;max-height:50vh;overflow:auto;white-space:pre-wrap;font-size:12px;';
                                pre.textContent = {log_json} || '(no output captured)';
                                var hint = document.createElement('p');
                                hint.style.cssText = 'color:#94a3b8;font-size:13px;';
                                hint.textContent = 'If this is Windows: check that the Visual C++ Redistributable is installed and that antivirus/Defender isn\'t blocking node.exe. The full log is also written to crash.log in the app data folder.';
                                document.body.appendChild(h);
                                document.body.appendChild(pre);
                                document.body.appendChild(hint);
                            }})();"#
                        );
                        let _ = splash.eval(&js);
                    }
                });
            }

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes).to_string();
                            println!("[server.js] {line}");
                            {
                                let mut buf = captured_output.lock().unwrap();
                                buf.push(line.clone());
                                let len = buf.len();
                                if len > 200 {
                                    buf.drain(0..len - 200);
                                }
                            }
                            if let Some(port_str) = line.trim().strip_prefix("SERVER_PORT=") {
                                if let Ok(port) = port_str.trim().parse::<u16>() {
                                    let url = format!("http://localhost:{port}");
                                    if let Ok(parsed) = Url::parse(&url) {
                                        // Rebuilding rather than calling
                                        // window.navigate() on the existing
                                        // placeholder window is deliberate:
                                        // Tauri's initialization_script is a
                                        // WKUserScript tied to the webview's
                                        // *initial* configuration and does
                                        // not get re-applied across a
                                        // same-webview navigate() to a new
                                        // origin (confirmed live — the
                                        // click-interception script only
                                        // ever fired once, on the
                                        // placeholder's own load). A freshly
                                        // built webview is guaranteed to run
                                        // the init script for its one and
                                        // only page load.
                                        if let Some(old_window) = app_handle.get_webview_window("splash") {
                                            if let Err(e) = old_window.close() {
                                                eprintln!("[lib.rs] failed to close placeholder window: {e}");
                                            }
                                        }
                                        let nav_app_handle = app_handle.clone();
                                        let build_result = WebviewWindowBuilder::new(
                                            &app_handle,
                                            "main",
                                            WebviewUrl::External(parsed),
                                        )
                                        .title("Srotas WhatsApp Bot")
                                        .inner_size(1200.0, 800.0)
                                        .resizable(true)
                                        .fullscreen(false)
                                        .initialization_script(OPEN_OVERRIDE_INIT_SCRIPT)
                                        .on_navigation(move |nav_url| {
                                            // Allow navigations within our
                                            // own sidecar-hosted dashboard
                                            // (localhost, any port). Anything
                                            // else (an external URL slipping
                                            // through some other path than
                                            // the click/window.open
                                            // intercepts above) gets denied
                                            // and reopened in the system
                                            // browser instead.
                                            let is_internal = matches!(
                                                nav_url.host_str(),
                                                Some("localhost") | Some("127.0.0.1")
                                            );
                                            if !is_internal
                                                && (nav_url.scheme() == "http" || nav_url.scheme() == "https")
                                            {
                                                let _ = nav_app_handle
                                                    .opener()
                                                    .open_url(nav_url.to_string(), None::<String>);
                                                return false;
                                            }
                                            true
                                        })
                                        .build();

                                        if let Err(e) = build_result {
                                            eprintln!("[lib.rs] failed to build the dashboard window: {e}");
                                        }
                                    }
                                }
                            }
                        }
                        CommandEvent::Stderr(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes).to_string();
                            eprintln!("[server.js:stderr] {line}");
                            let mut buf = captured_output.lock().unwrap();
                            buf.push(format!("[stderr] {line}"));
                            let len = buf.len();
                            if len > 200 {
                                buf.drain(0..len - 200);
                            }
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                // RunEvent::Reopen only exists on macOS (it wraps
                // NSApplicationDelegate's applicationShouldHandleReopen, the
                // Dock-icon-click callback) — Tauri itself gates the enum
                // variant behind #[cfg(target_os = "macos")], so this arm
                // must be too, or it fails to compile on Windows/Linux.
                #[cfg(target_os = "macos")]
                RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } => {
                    // Dock icon clicked with no windows visible — re-show
                    // the hidden main window instead of creating a new one.
                    if !has_visible_windows {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                RunEvent::Exit => {
                    let state = app_handle.state::<ServerState>();
                    if let Some(child) = state.child.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                        let _ = std::fs::remove_file(server_pid_file_path(&app_data_dir));
                    }
                }
                _ => {}
            }
        });
}
