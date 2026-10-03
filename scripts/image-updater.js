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
// flags.portrait-picker.mode so the picker can preselect it next time.
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
 * Token mode:    image at 1x. The dynamic ring is left as the token has it,
 *                except when coming back from Portrait mode: then the ring is
 *                put back the way it was before Portrait mode. (For ringed
 *                tokens, dnd5e adds its own size adjustment on top, e.g.
 *                smaller for Small creatures.)
 * Portrait mode: image drawn larger (the GM's "Portrait mode image scale"
 *                setting) and the ring switched off, because portraits are
 *                cinematic images that shouldn't be clipped into a ring.
 *                Whether the ring was on is saved on the token first.
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

  // Update tokens one at a time, so one failure doesn't stop the others.
  for (const token of tokens) {
    if (!token.canUserModify(game.user, "update")) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.NoTokenPermission", { name: token.name }));
      continue;
    }

    const changes = buildTokenChanges(actor, token, imagePath, mode);

    try {
      await token.update(changes);
      log.debug(`Updated token "${token.name}" (${mode} mode):`, changes);
    } catch (err) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.TokenUpdateFailed", { name: token.name }));
      log.error(`Could not update token "${token.name}":`, err);
    }
  }
}

/**
 * Work out the changes for one token.
 * For scale we read the token's SAVED values (_source), not the displayed
 * ones, because dnd5e shrinks the displayed scale of ringed Small tokens.
 * (dnd5e never changes ring.enabled, so token.ring.enabled is safe to read.)
 * @param {Actor} actor
 * @param {TokenDocument} token
 * @param {string} imagePath
 * @param {string} mode        MODE_TOKEN or MODE_PORTRAIT
 * @returns {object}           changes to pass to token.update()
 */
function buildTokenChanges(actor, token, imagePath, mode) {
  const saved = token._source;
  const wasPortrait = token.getFlag(MODULE_ID, "mode") === MODE_PORTRAIT;

  let scale = 1;
  if (mode === MODE_PORTRAIT) {
    scale = game.settings.get(MODULE_ID, "portraitScale");
  }

  const changes = {
    "texture.src": imagePath,
    "texture.scaleX": keepSign(saved.texture.scaleX, scale),
    "texture.scaleY": keepSign(saved.texture.scaleY, scale),
    [`flags.${MODULE_ID}.mode`]: mode
  };

  if (mode === MODE_PORTRAIT) {
    // Remember the ring, but only when ENTERING Portrait mode. If the token
    // is already a portrait its ring is off, and saving that would lose the
    // real setting.
    if (!wasPortrait) {
      changes[`flags.${MODULE_ID}.ringBeforePortrait`] = token.ring.enabled;
    }
    changes["ring.enabled"] = false;
  } else if (wasPortrait) {
    // Leaving Portrait mode: put the ring back how it was. If nothing was
    // saved (e.g. the token became a portrait with an older version of this
    // module), fall back to the prototype token's ring setting.
    const remembered = token.getFlag(MODULE_ID, "ringBeforePortrait");
    if (typeof remembered === "boolean") {
      changes["ring.enabled"] = remembered;
    } else {
      changes["ring.enabled"] = actor.prototypeToken.ring.enabled;
    }
  }
  // Token -> Token: "ring.enabled" isn't in the changes, so the ring stays
  // exactly as the token has it.

  return changes;
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
 * Also used by the picker to decide whether to show the "no tokens" note.
 * @param {Actor} actor
 * @returns {TokenDocument[]}
 */
export function findLinkedTokensOnViewedScene(actor) {
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
