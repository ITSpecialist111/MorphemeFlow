// MorphemeFlow Reader — main entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    reader_windows_lib::run();
}
