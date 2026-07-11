fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
    );
    let source = manifest_dir.join("../../../public/fonts");
    let destination = manifest_dir.join("../ui/fonts");
    println!("cargo:rerun-if-changed={}", source.display());

    if let Err(error) = copy_directory(&source, &destination) {
        panic!("failed to stage bundled Reader fonts: {error}");
    }
    tauri_build::build()
}

fn copy_directory(source: &std::path::Path, destination: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(destination)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}
