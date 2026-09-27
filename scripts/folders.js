/**
 * folders.js
 * Everything to do with folders and file paths:
 * - reading a folder's contents safely (never crashing if it's missing)
 * - working out which folder the picker should open in
 * - small path helpers (parent folder, file name, comparing two paths)
 */

import { MODULE_ID, FILE_SOURCE, ASSETS_ROOT, IMAGE_EXTENSIONS } from "./constants.js";
import * as log from "./logger.js";

/**
 * Read the contents of one folder.
 * Returns { folder, dirs, files } on success, or null if the folder can't be
 * read (it doesn't exist, or the user isn't allowed to browse it).
 * Returning null instead of throwing lets the caller simply try the next folder.
 *
 * @param {string} folder   e.g. "assets/Alice"
 * @returns {Promise<{folder: string, dirs: string[], files: string[]} | null>}
 */
export async function browseFolder(folder) {
  let result;
  try {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    result = await FilePicker.browse(FILE_SOURCE, folder);
  } catch (err) {
    log.debug(`Could not browse "${folder}":`, err);
    return null;
  }

  // Be careful: if the server answered with something unexpected, treat it as
  // "could not read" rather than crashing later.
  if (!result || !Array.isArray(result.dirs) || !Array.isArray(result.files)) {
    log.debug(`Unexpected browse result for "${folder}":`, result);
    return null;
  }

  // The server tells us the folder it actually opened; prefer that spelling.
  let openedFolder = trimSlashes(result.target ?? folder);
  if (openedFolder === ".") {
    // Some servers call the top folder "." — we use "" for the top.
    openedFolder = "";
  }

  const dirs = [];
  for (const dir of result.dirs) {
    dirs.push(toFullPath(openedFolder, dir));
  }

  // Keep only image files. We filter here (instead of asking the server to)
  // so the check ignores capital letters: "Smile.PNG" still counts.
  const files = [];
  for (const file of result.files) {
    if (isImageFile(file)) {
      files.push(toFullPath(openedFolder, file));
    }
  }

  log.debug(`Browsed "${openedFolder}": ${dirs.length} folders, ${files.length} images.`);
  return { folder: openedFolder, dirs: dirs, files: files };
}

/**
 * Find the folder the picker should open in, trying in this order:
 *   1. the folder this actor's image was last chosen from (saved on the actor)
 *   2. assets/<owner's user name>
 *   3. assets
 * The first one that can actually be read wins.
 *
 * Returns the browse result for that folder, or null if none of them work.
 * @param {Actor} actor
 */
export async function findStartingFolder(actor) {
  const candidates = [];

  const lastFolder = actor.getFlag(MODULE_ID, "lastFolder");
  if (lastFolder) {
    candidates.push(lastFolder);
  }

  const owner = findOwnerUser(actor);
  if (owner) {
    candidates.push(`${ASSETS_ROOT}/${owner.name}`);
  }

  candidates.push(ASSETS_ROOT);

  for (const folder of candidates) {
    const contents = await browseFolder(folder);
    if (contents) {
      // If we had to skip a folder the user would expect (their own, or the
      // remembered one), tell them why they're somewhere else.
      if (folder !== candidates[0]) {
        ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.FolderMissing", {
          missing: candidates[0],
          shown: contents.folder
        }));
      }
      return contents;
    }
  }
  return null;
}

/**
 * Find the player who owns this actor, to guess their assets folder.
 * Prefer the non-GM user whose assigned character is this actor; otherwise
 * take the first non-GM user with Owner permission. Returns null if there is
 * no such player (e.g. an NPC only the GM controls).
 * @param {Actor} actor
 * @returns {User|null}
 */
export function findOwnerUser(actor) {
  for (const user of game.users) {
    if (!user.isGM && user.character && user.character.id === actor.id) {
      return user;
    }
  }
  for (const user of game.users) {
    if (!user.isGM && actor.testUserPermission(user, "OWNER")) {
      return user;
    }
  }
  return null;
}

/**
 * The folder one level up, e.g. "assets/Alice/Whiskers" -> "assets/Alice".
 * The top of the User Data folder is "" (empty text).
 * @param {string} folder
 */
export function parentFolder(folder) {
  const parts = trimSlashes(folder).split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * The last part of a path, made readable, e.g.
 * "assets/Alice/Big%20Smile.png" -> "Big Smile.png".
 * @param {string} path
 */
export function displayName(path) {
  const parts = trimSlashes(path).split("/");
  return safeDecode(parts[parts.length - 1]);
}

/**
 * Do two paths point to the same file? Paths can be stored with or without
 * URL encoding ("Big%20Smile.png" vs "Big Smile.png"), so compare the decoded forms.
 */
export function samePath(pathA, pathB) {
  if (!pathA || !pathB) {
    return false;
  }
  return safeDecode(trimSlashes(pathA)) === safeDecode(trimSlashes(pathB));
}

/* ---------------- small internal helpers ---------------- */

/** Is this file name one of our allowed image types? (ignores capital letters) */
function isImageFile(path) {
  const lower = path.toLowerCase();
  for (const extension of IMAGE_EXTENSIONS) {
    if (lower.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

/**
 * The server should give full paths ("assets/Alice/smile.png"), but if it ever
 * gives just a name ("smile.png"), put the folder in front so it still works.
 */
function toFullPath(folder, entry) {
  const cleaned = trimSlashes(entry);
  if (cleaned.includes("/") || folder === "") {
    return cleaned;
  }
  return `${folder}/${cleaned}`;
}

/** Remove slashes from the start and end: "/assets/Alice/" -> "assets/Alice". */
function trimSlashes(path) {
  let result = String(path);
  while (result.startsWith("/")) {
    result = result.slice(1);
  }
  while (result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}

/** decodeURIComponent, but a badly encoded name returns as-is instead of crashing. */
function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch (err) {
    return text;
  }
}
