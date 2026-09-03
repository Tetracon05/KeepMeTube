//! Native macOS menu bar: an app menu ("YT Downloader"), a "File" menu, and
//! a standard "Edit" menu. This module is only compiled on macOS (see the
//! `#[cfg(target_os = "macos")]` on its `mod menu;` declaration in lib.rs) —
//! Windows and Linux keep their existing (menu-less) behavior untouched.
//!
//! Menu clicks don't carry enough context to act on their own (e.g. "Delete"
//! needs to know which download is currently selected in the UI), so every
//! custom item just re-emits its id as a window event. The frontend listens
//! for these events and routes them through the same handlers already used
//! by the on-screen toolbar.

use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Wry};

pub fn build(app: &AppHandle<Wry>) -> tauri::Result<Menu<Wry>> {
    let about = MenuItemBuilder::with_id("menu-about", "About YT Downloader").build(app)?;
    let settings = MenuItemBuilder::with_id("menu-settings", "Settings...")
        .accelerator("Cmd+,")
        .build(app)?;
    let check_updates =
        MenuItemBuilder::with_id("menu-check-updates", "Check for Updates...").build(app)?;

    let app_menu = SubmenuBuilder::new(app, "YT Downloader")
        .item(&about)
        .separator()
        .item(&settings)
        .separator()
        .item(&check_updates)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let add_download = MenuItemBuilder::with_id("menu-add-download", "Add Download")
        .accelerator("Cmd+N")
        .build(app)?;
    let select_mode = MenuItemBuilder::with_id("menu-select-mode", "Select Mode").build(app)?;
    let rename = MenuItemBuilder::with_id("menu-rename", "Rename").build(app)?;
    let delete = MenuItemBuilder::with_id("menu-delete", "Delete").build(app)?;
    let remove_from_list =
        MenuItemBuilder::with_id("menu-remove", "Remove from List").build(app)?;
    let show_in_finder =
        MenuItemBuilder::with_id("menu-show-in-finder", "Show in Finder").build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&add_download)
        .separator()
        .item(&select_mode)
        .separator()
        .item(&rename)
        .item(&delete)
        .item(&remove_from_list)
        .separator()
        .item(&show_in_finder)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .select_all()
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .build()
}

/// Forwards every custom `menu-*` item click to the frontend as a same-named
/// window event. Predefined items (Undo, Quit, Hide, ...) are handled
/// natively by the OS and never reach this handler.
pub fn handle_event(app: &AppHandle<Wry>, event: MenuEvent) {
    let id = event.id().as_ref();
    if id.starts_with("menu-") {
        let _ = app.emit(id, ());
    }
}
