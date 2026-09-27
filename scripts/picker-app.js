/**
 * picker-app.js
 * The Portrait Picker window.
 *
 * It is built on Foundry's ApplicationV2 window class, with the
 * HandlebarsApplicationMixin so its contents come from a Handlebars template
 * (templates/picker.hbs).
 *
 * The window remembers:
 * - which folder it is showing (this.folder, this.dirs, this.files)
 * - which image the user has clicked (this.selectedPath)
 * Changing folder re-reads the folder and redraws the window.
 *
 * Confirm hands the chosen image to image-updater.js, which saves it.
 */

import { MODULE_ID } from "./constants.js";
import { browseFolder, findStartingFolder, parentFolder, displayName, samePath } from "./folders.js";
import { applyImageToActor } from "./image-updater.js";
import * as log from "./logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PortraitPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} actor         The actor whose image is being picked.
   * @param {object} contents     The starting folder, from browseFolder().
   * @param {object} options      Normal ApplicationV2 options (optional).
   */
  constructor(actor, contents, options = {}) {
    // Give each actor's picker its own id, so opening the picker twice for
    // the same actor brings back the same window instead of making a copy.
    options.id = `${MODULE_ID}-${actor.id}`;
    super(options);
    this.actor = actor;
    this.showFolder(contents);
  }

  /**
   * Settings shared by every Portrait Picker window.
   * "actions" connects buttons in the template (data-action="...") to the
   * functions that run when they are clicked. Inside those functions,
   * "this" is the picker window.
   */
  static DEFAULT_OPTIONS = {
    classes: ["portrait-picker"],
    window: {
      icon: "fa-solid fa-image-portrait",
      resizable: true
    },
    position: {
      width: 640,
      height: 600
    },
    actions: {
      openFolder: PortraitPickerApp.onOpenFolder,
      goUp: PortraitPickerApp.onGoUp,
      selectImage: PortraitPickerApp.onSelectImage,
      confirm: PortraitPickerApp.onConfirm,
      cancel: PortraitPickerApp.onCancel
    }
  };

  /** The template file(s) that make up the window's contents. */
  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/picker.hbs`
    }
  };

  /** Window title, e.g. "Portrait Picker: Whiskers". */
  get title() {
    return game.i18n.format("PORTRAIT_PICKER.Picker.Title", { name: this.actor.name });
  }

  /**
   * Store a folder's contents on the window. If the actor's current image is
   * in this folder, start with it selected, so Confirm works straight away.
   * @param {{folder: string, dirs: string[], files: string[]}} contents
   */
  showFolder(contents) {
    this.folder = contents.folder;
    this.dirs = contents.dirs;
    this.files = contents.files;

    this.selectedPath = null;
    for (const file of this.files) {
      if (samePath(file, this.actor.img)) {
        this.selectedPath = file;
      }
    }
  }

  /**
   * Gather the data the template needs. Everything returned here can be used
   * in picker.hbs, e.g. {{folderLabel}}.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // The top of User Data is "" — show it as "/" so it isn't blank.
    context.folderLabel = this.folder === "" ? "/" : this.folder;
    context.canGoUp = this.folder !== "";

    context.folders = [];
    for (const dir of this.dirs) {
      const name = displayName(dir);
      context.folders.push({
        path: dir,
        name: name,
        searchName: name.toLowerCase()
      });
    }

    context.images = [];
    for (const file of this.files) {
      const name = displayName(file);
      context.images.push({
        path: file,
        name: name,
        searchName: name.toLowerCase(),
        isCurrent: samePath(file, this.actor.img),
        isSelected: file === this.selectedPath
      });
    }

    context.isEmpty = context.folders.length === 0 && context.images.length === 0;
    context.hasSelection = this.selectedPath !== null;
    return context;
  }

  /**
   * Runs after every redraw. Hooks up the filter box. (It's a plain text box,
   * not a button, so it isn't handled by the "actions" list above.)
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const filterInput = this.element.querySelector(".portrait-picker-filter");
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        this.applyFilter(filterInput.value);
      });
    }
  }

  /**
   * Hide every tile whose name doesn't contain the filter text.
   * We just hide/show tiles instead of redrawing the window, so the text box
   * keeps its focus and typing stays smooth.
   * @param {string} text
   */
  applyFilter(text) {
    const search = text.trim().toLowerCase();
    const tiles = this.element.querySelectorAll(".portrait-picker-tile");
    for (const tile of tiles) {
      const matches = search === "" || tile.dataset.searchName.includes(search);
      tile.hidden = !matches;
    }
  }

  /**
   * Read a folder and redraw the window with it. If the folder can't be read,
   * warn the user and stay where we are.
   * @param {string} folder
   */
  async goToFolder(folder) {
    const contents = await browseFolder(folder);
    if (!contents) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.FolderUnreadable", { folder: folder }));
      return;
    }
    this.showFolder(contents);
    await this.render();
  }

  /* ---------------- button handlers ("this" is the window) ---------------- */

  /** A folder tile was clicked: open that folder. */
  static async onOpenFolder(event, target) {
    await this.goToFolder(target.dataset.path);
  }

  /** The Up button: open the parent folder. */
  static async onGoUp(event, target) {
    await this.goToFolder(parentFolder(this.folder));
  }

  /**
   * An image tile was clicked: mark it as selected.
   * Only the highlight changes, so we update the tiles directly instead of
   * redrawing the whole window (that would clear the filter box).
   */
  static onSelectImage(event, target) {
    this.selectedPath = target.dataset.path;

    const tiles = this.element.querySelectorAll(".portrait-picker-tile.image");
    for (const tile of tiles) {
      tile.classList.toggle("selected", tile === target);
    }

    const confirmButton = this.element.querySelector('[data-action="confirm"]');
    if (confirmButton) {
      confirmButton.disabled = false;
    }
    log.debug(`Selected "${this.selectedPath}".`);
  }

  /**
   * Confirm button: save the selected image to the actor, then close.
   * If saving fails, the window stays open so the user can try again
   * (applyImageToActor has already shown them a message).
   */
  static async onConfirm(event, target) {
    if (!this.selectedPath) {
      return;
    }

    // Disable Confirm while saving, so a double-click can't save twice.
    target.disabled = true;
    const saved = await applyImageToActor(this.actor, this.selectedPath, this.folder);
    if (saved) {
      await this.close();
    } else {
      target.disabled = false;
    }
  }

  /** Cancel button: close without changing anything. */
  static onCancel(event, target) {
    log.debug("Cancel clicked.");
    this.close();
  }
}

// Actors whose picker is still being opened (reading the starting folder
// takes a moment). Stops a quick double-click from opening two windows.
const actorsBeingOpened = new Set();

/**
 * Open the picker for an actor. If one is already open for this actor, bring
 * it to the front instead of opening a second copy.
 * @param {Actor} actor
 */
export async function openPortraitPicker(actor) {
  const existing = foundry.applications.instances.get(`${MODULE_ID}-${actor.id}`);
  if (existing) {
    existing.bringToFront();
    return;
  }
  if (actorsBeingOpened.has(actor.id)) {
    return;
  }

  actorsBeingOpened.add(actor.id);
  try {

    // Without the "Use File Browser" permission the server refuses to list
    // folders, so say so clearly instead of showing an empty window.
    if (!game.user.can("FILES_BROWSE")) {
      ui.notifications.warn("PORTRAIT_PICKER.Warnings.NoBrowsePermission", { localize: true });
      return;
    }

    const contents = await findStartingFolder(actor);
    if (!contents) {
      ui.notifications.error("PORTRAIT_PICKER.Errors.NoFolder", { localize: true });
      return;
    }

    const picker = new PortraitPickerApp(actor, contents);
    await picker.render({ force: true });
    log.debug(`Opened the picker for "${actor.name}" in "${contents.folder}".`);
  } catch (err) {
    // Show a friendly message, and put the technical details in the console.
    ui.notifications.error("PORTRAIT_PICKER.Errors.OpenFailed", { localize: true });
    log.error("Could not open the picker:", err);
  } finally {
    // Runs whether opening worked or failed, so the actor is never stuck.
    actorsBeingOpened.delete(actor.id);
  }
}
