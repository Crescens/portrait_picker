/**
 * constants.js
 * Values shared by every other file in the module. Keeping them in one place
 * means a typo in the module id can only happen once.
 */

// Must match the "id" in module.json. Foundry uses it as the namespace for our
// settings and flags (for example: flags.portrait_picker.lastFolder).
export const MODULE_ID = "portrait_picker";

// Every console message from this module starts with this text, so it is easy
// to find in the browser console (you can type it into the console's filter box).
export const LOG_PREFIX = "portrait_picker |";

// Which of Foundry's file storage areas we browse. "data" is the User Data
// folder, where assets/<player name>/ lives on a standard Foundry server.
export const FILE_SOURCE = "data";

// The top folder that holds one subfolder per player.
export const ASSETS_ROOT = "assets";

// Image types the picker shows. Written in lower case; we compare against the
// lower-cased file name, so "Happy.PNG" is shown too.
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
