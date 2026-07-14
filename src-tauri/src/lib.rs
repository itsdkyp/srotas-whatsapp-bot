use tauri::{Manager, Url};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// Phase 2: real sidecar bundling. Replaces Phase 1's "whatever node is on
// PATH" with Tauri's actual production mechanism — a Node runtime binary
// bundled per-platform via `externalBin` (staged by
// scripts/stage-tauri-sidecar.mjs), spawned via `app.shell().sidecar(...)`.
// server.js + its node_modules (including a matching-ABI better-sqlite3)
// ship alongside as plain `resources`, resolved at runtime via
// `app.path().resource_dir()`.
//
// Still deliberately skipped here (Phase 3 concerns): single-instance lock,
// PID-file orphan recovery/kill-on-quit, macOS dock reactivation,
// external-link handling.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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

            let (mut rx, _child) = app
                .shell()
                .sidecar("node")
                .expect("failed to create sidecar command for `node` — check externalBin config")
                .args([server_js_path.to_string_lossy().to_string()])
                .env("PORT", "0")
                .env("APP_USER_DATA_PATH", app_data_dir.to_string_lossy().to_string())
                .spawn()
                .expect("failed to spawn the node sidecar");

            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes);
                            println!("[server.js] {line}");
                            if let Some(port_str) = line.trim().strip_prefix("SERVER_PORT=") {
                                if let Ok(port) = port_str.trim().parse::<u16>() {
                                    let url = format!("http://localhost:{port}");
                                    if let Some(window) = app_handle.get_webview_window("main") {
                                        if let Ok(parsed) = Url::parse(&url) {
                                            let _ = window.navigate(parsed);
                                        }
                                    }
                                }
                            }
                        }
                        CommandEvent::Stderr(line_bytes) => {
                            eprintln!("[server.js:stderr] {}", String::from_utf8_lossy(&line_bytes));
                        }
                        _ => {}
                    }
                }
            });

            // Phase 2 spike: still no PID tracking, no kill-on-quit yet — the
            // sidecar child is dropped here without being tracked further.
            // Phase 3 replaces this with the real orphan-recovery +
            // kill-on-quit logic ported from main.js's
            // killServerProcess()/cleanupOrphanedServer().

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
