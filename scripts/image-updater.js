/**
 * image-updater.js
 * Saves the chosen image onto the actor and its tokens.
 *
 * 1. applyImageToActor() updates, in ONE save:
 *      - the actor's portrait (img)
 *      - the prototype token's image, at normal (1x) scale
 *      - the folder the image came from, so the picker opens there next time
 * 2. applyImageToSceneTokens() updates every LINKED token for the actor on
 *    the scene the user is currently viewing, in "token" or "portrait" mode.
 *    Tokens on other scenes and unlinked tokens are never touched.
 */

import { MODULE_ID } from "./constants.js";
import * as log from "./logger.js";

// The two ways a scene token can be drawn. Stored on each token in
// flags.portrait_picker.mode so the picker can preselect it next time.
export const MODE_TOKEN = "token";
export const MODE_PORTRAIT = "portrait";

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
 * Update this actor's LINKED tokens on the scene the user is viewing.
 *
 * Token mode:    image at 1x, and the dynamic ring switched back to however
 *                the prototype token has it. (For ringed tokens, dnd5e then
 *                adds its own size adjustment on top, e.g. smaller for Small
 *                creatures, just like a freshly placed token.)
 * Portrait mode: image drawn larger (the GM's "Portrait mode image scale"
 *                setting) and the ring switched off, because portraits are
 *                cinematic images that shouldn't be clipped into a ring.
 * In both modes the token's size in grid squares is NOT changed.
 *
 * Tokens the user isn't allowed to change are skipped with a warning.
 *
 * @param {Actor} actor
 * @param {string} imagePath
 * @param {string} mode        MODE_TOKEN or MODE_PORTRAIT
 */
export async function applyImageToSceneTokens(actor, imagePath, mode) {
  const tokens = findLinkedTokensOnViewedScene(actor);
  if (tokens.length === 0) {
    log.debug(`No linked tokens for "${actor.name}" on the viewed scene.`);
    return;
  }

  // Work out the scale and ring once; they're the same for every token.
  let scale = 1;
  let ringEnabled = actor.prototypeToken.ring.enabled;
  if (mode === MODE_PORTRAIT) {
    scale = game.settings.get(MODULE_ID, "portraitScale");
    ringEnabled = false;
  }

  // Update tokens one at a time, so one failure doesn't stop the others.
  for (const token of tokens) {
    if (!token.canUserModify(game.user, "update")) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.NoTokenPermission", { name: token.name }));
      continue;
    }

    // Read the saved (_source) scale for the sign check. dnd5e changes the
    // displayed scale for ringed tokens, but never its sign, so either would
    // work; _source is what we are actually overwriting.
    const oldTexture = token._source.texture;
    const changes = {
      "texture.src": imagePath,
      "texture.scaleX": keepSign(oldTexture.scaleX, scale),
      "texture.scaleY": keepSign(oldTexture.scaleY, scale),
      "ring.enabled": ringEnabled,
      [`flags.${MODULE_ID}.mode`]: mode
    };

    try {
      await token.update(changes);
      log.debug(`Updated token "${token.name}" (${mode} mode, scale ${scale}, ring ${ringEnabled}).`);
    } catch (err) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.TokenUpdateFailed", { name: token.name }));
      log.error(`Could not update token "${token.name}":`, err);
    }
  }
}

/**
 * Which mode should the picker start on? Portrait if this actor's linked
 * token on the viewed scene was last set to portrait, otherwise Token.
 * A freshly placed token has no flag, so it starts on Token.
 * @param {Actor} actor
 * @returns {string} MODE_TOKEN or MODE_PORTRAIT
 */
export function getCurrentMode(actor) {
  const tokens = findLinkedTokensOnViewedScene(actor);
  for (const token of tokens) {
    if (token.getFlag(MODULE_ID, "mode") === MODE_PORTRAIT) {
      return MODE_PORTRAIT;
    }
  }
  return MODE_TOKEN;
}

/**
 * All tokens on the scene this user is currently looking at that are linked
 * to this actor. canvas.scene is the scene being viewed (it is null if no
 * scene is open, e.g. the canvas is turned off).
 * @param {Actor} actor
 * @returns {TokenDocument[]}
 */
function findLinkedTokensOnViewedScene(actor) {
  const scene = canvas.scene;
  if (!scene) {
    return [];
  }
  const result = [];
  for (const token of scene.tokens) {
    if (token.actorLink && token.actorId === actor.id) {
      result.push(token);
    }
  }
  return result;
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
