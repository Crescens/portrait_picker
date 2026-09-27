/**
 * uploader.js
 * Uploads images from the player's computer into a folder on the Foundry
 * server. Used by the picker for drag-and-drop, the Upload button and paste.
 *
 * Safety rules:
 * - The user needs Foundry's "Upload New Files" permission.
 * - Only .png, .jpg, .jpeg and .webp images are accepted.
 * - An existing file is never replaced: if "smile.png" is already in the
 *   folder, the new one is saved as "smile-1.png" (then "smile-2.png", ...).
 */

import { FILE_SOURCE, IMAGE_EXTENSIONS, IMAGE_MIME_EXTENSIONS } from "./constants.js";
import { displayName } from "./folders.js";
import * as log from "./logger.js";

/** Can the current user upload files at all? */
export function canUpload() {
  return game.user.can("FILES_UPLOAD");
}

/**
 * Upload some image files into a folder.
 * Returns the server paths of the files that uploaded successfully (it may be
 * empty). The user is told about anything that was skipped or failed.
 *
 * @param {File[]} files             the files to upload
 * @param {string} folder            where to put them, e.g. "assets/Alice"
 * @param {string[]} existingFiles   paths already in that folder (to avoid replacing them)
 * @returns {Promise<string[]>}
 */
export async function uploadImages(files, folder, existingFiles) {
  if (!canUpload()) {
    ui.notifications.warn("PORTRAIT_PICKER.Warnings.NoUploadPermission", { localize: true });
    return [];
  }

  // Don't drop files into the very top of the User Data folder, where
  // Foundry keeps its own worlds, modules and systems folders.
  if (folder === "") {
    ui.notifications.warn("PORTRAIT_PICKER.Warnings.UploadNeedsFolder", { localize: true });
    return [];
  }

  // Names already taken in this folder, in lower case so "Smile.png" and
  // "smile.png" count as the same (avoids confusing near-duplicates).
  const takenNames = new Set();
  for (const path of existingFiles) {
    takenNames.add(displayName(path).toLowerCase());
  }

  const uploaded = [];
  for (const file of files) {
    const extension = getImageExtension(file);
    if (!extension) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.NotAnImage", { name: file.name }));
      continue;
    }

    const name = chooseFreeName(file, extension, takenNames);
    takenNames.add(name.toLowerCase());

    // A File's name can't be changed, so make a copy with the new name.
    const renamed = new File([file], name, { type: file.type });

    const path = await uploadOneFile(renamed, folder);
    if (path) {
      uploaded.push(path);
    }
  }

  if (uploaded.length > 0) {
    ui.notifications.info(game.i18n.format("PORTRAIT_PICKER.Picker.Uploaded", { count: uploaded.length }));
  }
  return uploaded;
}

/**
 * Upload one file. Returns its path on the server, or null if it failed.
 * @param {File} file
 * @param {string} folder
 */
async function uploadOneFile(file, folder) {
  let result;
  try {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    // notify: false turns off Foundry's own "uploaded" popup; we show one
    // summary message instead of one per file.
    result = await FilePicker.upload(FILE_SOURCE, folder, file, {}, { notify: false });
  } catch (err) {
    log.error(`Upload of "${file.name}" to "${folder}" failed:`, err);
    result = null;
  }

  // A successful upload answers with the new file's path.
  if (!result || !result.path) {
    ui.notifications.error(game.i18n.format("PORTRAIT_PICKER.Errors.UploadFailed", { name: file.name }));
    log.debug("Upload response was:", result);
    return null;
  }

  log.debug(`Uploaded "${file.name}" to "${result.path}".`);
  return result.path;
}

/**
 * Which extension should this file be saved with? Returns e.g. ".png", or
 * null if it isn't an allowed image.
 * Files from the computer have a real name ("smile.PNG"), so we check that.
 * Pasted images are usually called "image.png", but to be safe we also
 * accept a file whose type the browser reports as an image we allow.
 * @param {File} file
 */
function getImageExtension(file) {
  const lowerName = file.name.toLowerCase();
  for (const extension of IMAGE_EXTENSIONS) {
    if (lowerName.endsWith(extension)) {
      return extension;
    }
  }
  const fromType = IMAGE_MIME_EXTENSIONS[file.type];
  if (fromType) {
    return fromType;
  }
  return null;
}

/**
 * Pick a file name that isn't already used in the folder.
 * - Pasted images get a dated name, e.g. "pasted-2026-09-27-153045.png".
 * - Other files keep their name, with "-1", "-2", ... added if needed.
 * @param {File} file
 * @param {string} extension     e.g. ".png"
 * @param {Set<string>} takenNames   lower-case names already in the folder
 */
function chooseFreeName(file, extension, takenNames) {
  let baseName;
  if (isPastedImage(file)) {
    baseName = `pasted-${timestamp()}`;
  } else {
    // Remove the extension: "smile.PNG" -> "smile".
    baseName = file.name.slice(0, file.name.length - extension.length);
    if (!file.name.toLowerCase().endsWith(extension)) {
      baseName = file.name;
    }
  }

  let name = `${baseName}${extension}`;
  let counter = 1;
  while (takenNames.has(name.toLowerCase())) {
    name = `${baseName}-${counter}${extension}`;
    counter = counter + 1;
  }
  return name;
}

/**
 * Browsers name pasted pictures "image.png" (or have no name at all), which
 * would give every pasted image the same name.
 * @param {File} file
 */
function isPastedImage(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName === "" || lowerName.startsWith("image.");
}

/** Current date and time as "2026-09-27-153045" (safe to use in a file name). */
function timestamp() {
  const now = new Date();
  const date = `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;
  return `${date}-${time}`;
}

/** 7 -> "07", 12 -> "12". (getMonth() counts from 0, hence the + 1 above.) */
function twoDigits(number) {
  return String(number).padStart(2, "0");
}
