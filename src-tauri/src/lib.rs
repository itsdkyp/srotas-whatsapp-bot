use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;

use tauri::{Manager, Url};

// Phase 1 spike only: spawn a plain `node server.js` using whatever Node is on
// PATH, and discover its dynamic port the same way main.js does today — by
// reading a `SERVER_PORT=<port>` line off its stdout. This deliberately
// skips the real sidecar/externalBin mechanism, single-instance lock, and
// orphan-PID recovery, which are Phase 2/3 concerns.
fn repo_root() -> PathBuf {
    // CARGO_MANIFEST_DIR is compile-time and always points at src-tauri/,
    // regardless of the working directory `tauri dev` was invoked from.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should have a parent directory")
        .to_path_buf()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let root = repo_root();
            let mut child = Command::new("node")
                .arg("server.js")
                .current_dir(&root)
                .env("PORT", "0")
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .expect("failed to spawn `node server.js` — is Node installed and on PATH?");

            let stdout = child.stdout.take().expect("child stdout was not piped");
            let app_handle = app.handle().clone();

            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    let Ok(line) = line else { continue };
                    println!("[server.js] {line}");
                    if let Some(port_str) = line.strip_prefix("SERVER_PORT=") {
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
            });

            // Phase 1 spike: no PID tracking, no kill-on-quit yet (dropping
            // `Child` does not terminate the OS process, so this node
            // process outlives the app until manually killed). Phase 3
            // replaces this with the real orphan-recovery + kill-on-quit
            // logic ported from main.js's
            // killServerProcess()/cleanupOrphanedServer().
            let _ = &child;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
