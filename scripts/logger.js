/**
 * logger.js
 * Small helpers for writing messages to the browser console.
 *
 * - debug() only prints when the "Debug logging" setting is turned on, so
 *   normal players don't get a noisy console.
 * - warn() and error() always print, because they mean something went wrong
 *   and we want that visible even when debug logging is off.
 */

import { MODULE_ID, LOG_PREFIX } from "./constants.js";

/**
 * Is debug logging turned on?
 * The setting doesn't exist until settings.js registers it during the "init"
 * hook, and reading an unregistered setting throws an error. If something
 * tries to log before that, we treat debug as off instead of crashing.
 */
function isDebugEnabled() {
  try {
    return game.settings.get(MODULE_ID, "debug") === true;
  } catch (err) {
    return false;
  }
}

/** Print a message only when debug logging is on. */
export function debug(...args) {
  if (isDebugEnabled()) {
    console.log(LOG_PREFIX, ...args);
  }
}

/** Always print a warning (yellow in the console). */
export function warn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

/** Always print an error (red in the console). */
export function error(...args) {
  console.error(LOG_PREFIX, ...args);
}
