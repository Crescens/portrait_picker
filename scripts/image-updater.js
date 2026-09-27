/**
 * image-updater.js
 * Saves the chosen image onto the actor.
 *
 * PHASE 4 updates, in ONE save:
 *   - the actor's portrait (img)
 *   - the prototype token's image, at normal (1x) scale
 *   - the folder the image came from, so the picker opens there next time
 * Phase 5 will add the linked tokens on the current scene.
 */

import { MODULE_ID } from "./constants.js";
import * as log from "./logger.js";

/**
 * Save a new image for an actor.
 * Returns true if it worked, false if not (the user has already been told why).
 *
 * @param {Actor} actor
 * @param {string} imagePath   e.g. "assets/Alice/Happy.png"
 * @param {string} folder      the folder the image was chosen from, e.g. "assets/Alice"
 * @returns {Promise<boolean>}
 */
export async function applyImageToActor(actor, imagePath, folder) {
  // Only change documents this user is allowed to change. The sheet already
  // checks this, but checking again here keeps this function safe on its own.
  if (!actor.canUserModify(game.user, "update")) {
    ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.NoActorPermission", { name: actor.name }));
    return false;
  }

  const texture = actor.prototypeToken.texture;

  // Writing the changes as "path.to.field": value updates only those fields
  // and leaves everything else on the actor untouched.
  const changes = {
    "img": imagePath,
    "prototypeToken.texture.src": imagePath,
    // The prototype token is always the normal 1x token. keepSign() keeps a
    // mirrored (flipped) token flipped.
    "prototypeToken.texture.scaleX": keepSign(texture.scaleX, 1),
    "prototypeToken.texture.scaleY": keepSign(texture.scaleY, 1),
    [`flags.${MODULE_ID}.lastFolder`]: folder
  };

  try {
    await actor.update(changes);
  } catch (err) {
    ui.notifications.error(game.i18n.format("PORTRAIT_PICKER.Errors.ActorUpdateFailed", { name: actor.name }));
    log.error(`Could not update "${actor.name}":`, err);
    return false;
  }

  log.debug(`Updated "${actor.name}" portrait and prototype token to "${imagePath}".`);
  return true;
}

/**
 * Return newScale, but negative if the old scale was negative.
 * Foundry stores a mirrored (flipped) token image as a negative scale, so
 * this keeps a flipped token flipped while changing its size.
 * @param {number} oldScale
 * @param {number} newScale
 */
export function keepSign(oldScale, newScale) {
  if (oldScale < 0) {
    return -newScale;
  }
  return newScale;
}
