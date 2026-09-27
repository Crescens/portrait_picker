/**
 * main.js
 * The module's entry point. module.json tells Foundry to load this file.
 * Its only job is to connect our code to Foundry's startup "hooks":
 *
 * - "init"  runs early while Foundry is starting up. Settings must be
 *           registered here, before anything tries to read them.
 * - "ready" runs once the game has fully loaded and the user is logged in.
 */

import { LOG_PREFIX } from "./constants.js";
import { registerSettings } from "./settings.js";
import { registerSheetHook } from "./sheet-hook.js";
import * as log from "./logger.js";

Hooks.once("init", () => {
  registerSettings();
  // Start watching for actor sheets. Doing it during init means we're ready
  // before any sheet can be opened.
  registerSheetHook();
  log.debug("Settings and sheet hook registered.");
});

Hooks.once("ready", () => {
  // Printed with console.log directly (not log.debug) so you can always
  // confirm the module loaded, even with debug logging off.
  console.log(LOG_PREFIX, "Ready.");
  log.debug("Debug logging is ON.");
});
