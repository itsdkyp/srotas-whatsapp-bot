fn main() {
    // Auto-generates an `allow-open-external-url` ACL permission for our own
    // app-defined command (lib.rs's open_external_url). Without this,
    // Tauri's runtime ACL rejects invoke() calls for ANY command — plugin or
    // bare app command alike — once the app has its own capabilities file,
    // which this app does (capabilities/default.json, needed for
    // shell:allow-execute).
    let attrs = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(&["open_external_url"]));
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
