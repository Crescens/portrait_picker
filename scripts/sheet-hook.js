/**
 * sheet-hook.js
 * Catches clicks on the portrait of a dnd5e actor sheet and opens the
 * Portrait Picker instead of Foundry's standard file picker.
 *
 * How it works:
 * Every time an actor sheet draws itself, Foundry fires the
 * "renderActorSheetV2" hook. All five dnd5e default sheets (character, npc,
 * vehicle, group, encounter) are built on ActorSheetV2, so this one hook
 * covers them all. When it fires, we find the portrait image and add our own
 * click listener to it.
 *
 * dnd5e marks an editable portrait with data-action="editImage". The sheet
 * handles every data-action click with a single listener on the whole sheet
 * window. Our listener sits on the image itself, so it runs first and can
 * stop the click from ever reaching the sheet's listener.
 */

import { MODULE_ID } from "./constants.js";
import { openPortraitPicker } from "./picker-app.js";
import * as log from "./logger.js";

/** Start listening for actor sheets being drawn. Called once from main.js. */
export function registerSheetHook() {
  Hooks.on("renderActorSheetV2", onRenderActorSheet);
}

/**
 * Runs every time any actor sheet is drawn (or redrawn).
 * @param {ApplicationV2} app      The sheet window.
 * @param {HTMLElement} element    The sheet's HTML.
 */
function onRenderActorSheet(app, element) {
  const actor = app.actor;
  if (!actor) {
    return;
  }

  // Sheets for UNLINKED tokens always keep the standard picker. Changing
  // them is out of scope for this module.
  if (actor.isToken) {
    return;
  }

  // dnd5e only adds data-action="editImage" when the user may edit the sheet.
  // If it's missing, the user can only view the art, so we leave it alone.
  const portrait = element.querySelector('.portrait [data-action="editImage"]');
  if (!portrait) {
    return;
  }

  // A sheet can redraw only some of its parts. If the portrait wasn't redrawn,
  // it already has our listener. This marker stops us adding a second one.
  if (portrait.dataset.portraitPickerBound === "true") {
    return;
  }
  portrait.dataset.portraitPickerBound = "true";

  portrait.addEventListener("click", (event) => {
    onPortraitClick(event, actor);
  });

  log.debug(`Portrait click hooked on sheet for "${actor.name}".`);
}

/**
 * Decide what to do with a click on the portrait.
 * @param {PointerEvent} event
 * @param {Actor} actor
 */
function onPortraitClick(event, actor) {
  // Shift+click: always let the standard file picker open, for everyone.
  if (event.shiftKey) {
    log.debug("Shift+click: using the standard file picker.");
    return;
  }

  // The user has turned the picker off for themselves. We read the setting
  // here (at click time) so changing it works without reopening the sheet.
  if (game.settings.get(MODULE_ID, "enabled") !== true) {
    log.debug("Picker is turned off for this user: using the standard file picker.");
    return;
  }

  // Stop the click here so the sheet never opens the standard file picker.
  event.stopPropagation();
  event.preventDefault();

  openPortraitPicker(actor);
}
