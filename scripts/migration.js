/**
 * migration.js
 * One-time move of saved data from the module's old id ("portrait_picker",
 * used up to version 0.7.1) to the new id ("portrait-picker", from 1.0.0).
 *
 * The module stores a little data on actors and tokens as "flags", filed
 * under the module's id:
 *   - actors: lastFolder (where the picker opens next time)
 *   - scene tokens: mode (token/portrait) and ringBeforePortrait
 * After the rename those would be filed under the wrong name, so this copies
 * them across. The old copies are left in place: they are tiny and harmless,
 * and keeping them means nothing can be lost if something goes wrong.
 *
 * Only one GM runs this, once per world. Players never need to.
 */

import { MODULE_ID, OLD_MODULE_ID } from "./constants.js";
import * as log from "./logger.js";

export async function migrateOldData() {
  if (!game.user.isGM) {
    return;
  }

  // If the old version is still switched on, both versions would react to
  // the same portrait click. Warn the GM every time until it's turned off.
  const oldModule = game.modules.get(OLD_MODULE_ID);
  if (oldModule && oldModule.active) {
    ui.notifications.warn("PORTRAIT_PICKER.Warnings.OldModuleActive", { localize: true, permanent: true });
  }

  // If several GMs are logged in, only one of them should do the work.
  // activeGM is Foundry's way of picking exactly one.
  const activeGM = game.users.activeGM;
  if (!activeGM || activeGM.id !== game.user.id) {
    return;
  }
  if (game.settings.get(MODULE_ID, "oldDataMigrated") === true) {
    return;
  }

  try {
    const actorCount = await migrateActors();
    const tokenCount = await migrateTokens();

    await game.settings.set(MODULE_ID, "oldDataMigrated", true);

    if (actorCount > 0 || tokenCount > 0) {
      ui.notifications.info(game.i18n.format("PORTRAIT_PICKER.Migration.Done", {
        actors: actorCount,
        tokens: tokenCount
      }));
    }
    log.debug(`Migration finished: ${actorCount} actors, ${tokenCount} tokens.`);
  } catch (err) {
    // The "done" setting is NOT saved, so it will try again next time.
    ui.notifications.error("PORTRAIT_PICKER.Errors.MigrationFailed", { localize: true });
    log.error("Moving saved data from the old module id failed:", err);
  }
}

/**
 * Copy the old flags on every world actor that has them.
 * @returns {Promise<number>} how many actors were updated
 */
async function migrateActors() {
  const updates = [];
  for (const actor of game.actors) {
    const oldFlags = readOldFlags(actor);
    if (oldFlags) {
      updates.push({ _id: actor.id, [`flags.${MODULE_ID}`]: oldFlags });
    }
  }
  if (updates.length > 0) {
    // One request for all actors instead of one per actor.
    await Actor.implementation.updateDocuments(updates);
  }
  return updates.length;
}

/**
 * Copy the old flags on every token, on every scene, that has them.
 * @returns {Promise<number>} how many tokens were updated
 */
async function migrateTokens() {
  let total = 0;
  for (const scene of game.scenes) {
    const updates = [];
    for (const token of scene.tokens) {
      const oldFlags = readOldFlags(token);
      if (oldFlags) {
        updates.push({ _id: token.id, [`flags.${MODULE_ID}`]: oldFlags });
      }
    }
    if (updates.length > 0) {
      await scene.updateEmbeddedDocuments("Token", updates);
      total = total + updates.length;
    }
  }
  return total;
}

/**
 * The old flags saved on a document, or null if it has none.
 * We read the raw saved data (_source) because Foundry's getFlag() refuses to
 * read flags for a module that isn't installed and active, which the old id
 * usually won't be.
 * @param {Document} doc
 * @returns {object|null}
 */
function readOldFlags(doc) {
  const flags = doc._source.flags;
  if (!flags) {
    return null;
  }
  const oldFlags = flags[OLD_MODULE_ID];
  if (!oldFlags || typeof oldFlags !== "object" || Object.keys(oldFlags).length === 0) {
    return null;
  }
  return oldFlags;
}
