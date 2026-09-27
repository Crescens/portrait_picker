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
 * - whether "Token" or "Portrait" is chosen (this.mode)
 * Changing folder re-reads the folder and redraws the window.
 *
 * Confirm hands the chosen image to image-updater.js, which saves it.
 * New images can be added by dragging files onto the window, the Upload
 * button, or pasting (Ctrl+V); uploader.js does the uploading.
 */

import { MODULE_ID } from "./constants.js";
import { browseFolder, findStartingFolder, parentFolder, displayName, samePath } from "./folders.js";
import { applyImageToActor, applyImageToSceneTokens, getCurrentMode, findLinkedTokensOnViewedScene, MODE_PORTRAIT } from "./image-updater.js";
import { canUpload, uploadImages } from "./uploader.js";
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

    // Start on the mode the actor's token on this scene is already in.
    // A freshly placed token has never been set, so it starts on Token.
    this.mode = getCurrentMode(actor);
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
      upload: PortraitPickerApp.onUploadButton,
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
    context.canUpload = canUpload();
    context.isPortrait = this.mode === MODE_PORTRAIT;
    // If this actor has no linked token on the scene being viewed, the
    // Token/Portrait choice won't change anything, so the template says so.
    context.hasSceneTokens = findLinkedTokensOnViewedScene(this.actor).length > 0;
    // e.g. "Portrait (6× image)", using the GM's current scale setting.
    context.portraitLabel = game.i18n.format("PORTRAIT_PICKER.Picker.Mode.Portrait", {
      scale: game.settings.get(MODULE_ID, "portraitScale")
    });
    return context;
  }

  /**
   * Runs after every redraw. Hooks up the filter box and the Token/Portrait
   * choice. (They're form inputs, not buttons, so they aren't handled by the
   * "actions" list above.)
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const filterInput = this.element.querySelector(".portrait-picker-filter");
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        this.applyFilter(filterInput.value);
      });
    }

    this.activateUploads();

    // Remember the chosen mode on the window, so it survives moving between
    // folders (which redraws the window).
    const modeInputs = this.element.querySelectorAll('input[name="portrait-picker-mode"]');
    for (const input of modeInputs) {
      input.addEventListener("change", () => {
        if (input.checked) {
          this.mode = input.value;
          log.debug(`Mode set to "${this.mode}".`);
        }
      });
    }
  }

  /**
   * Set up the three ways to add images: drag-and-drop, the hidden file
   * chooser behind the Upload button, and paste.
   * The listeners go on the window's contents (".portrait-picker-body"),
   * which is rebuilt on every redraw, so they never pile up.
   */
  activateUploads() {
    const body = this.element.querySelector(".portrait-picker-body");
    const grid = this.element.querySelector(".portrait-picker-grid");
    if (!body || !grid) {
      return;
    }

    // Drag-and-drop. "dragover" must call preventDefault() or the browser
    // won't allow a drop (it would open the image in a new tab instead).
    body.addEventListener("dragover", (event) => {
      if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
        grid.classList.add("drag-over");
      }
    });
    body.addEventListener("dragleave", (event) => {
      // Only clear the highlight when the pointer really leaves the window
      // contents, not when it moves between tiles inside it.
      if (!body.contains(event.relatedTarget)) {
        grid.classList.remove("drag-over");
      }
    });
    body.addEventListener("drop", (event) => {
      grid.classList.remove("drag-over");
      const files = event.dataTransfer ? event.dataTransfer.files : null;
      if (!files || files.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.handleNewFiles(Array.from(files));
    });

    // The Upload button opens this hidden file chooser (see onUploadButton).
    const fileInput = this.element.querySelector(".portrait-picker-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const files = Array.from(fileInput.files);
        fileInput.value = "";
        if (files.length > 0) {
          this.handleNewFiles(files);
        }
      });
    }

    // Paste (Ctrl+V). Only images are handled; pasting text (for example
    // into the filter box) works as normal.
    body.addEventListener("paste", (event) => {
      const files = event.clipboardData ? Array.from(event.clipboardData.files) : [];
      if (files.length === 0) {
        return;
      }
      // Stop here, so nothing else in Foundry (like the canvas) also reacts
      // to this paste.
      event.preventDefault();
      event.stopPropagation();
      this.handleNewFiles(files);
    });

    // Put the keyboard focus on the grid, so Ctrl+V works straight away
    // without clicking into the window first.
    grid.focus({ preventScroll: true });
  }

  /**
   * Upload files into the folder being shown, then show the folder again
   * with the last uploaded image selected, ready for Confirm.
   * @param {File[]} files
   */
  async handleNewFiles(files) {
    // Ignore new files while an upload is still running.
    if (this.uploading) {
      return;
    }
    this.uploading = true;
    try {
      const uploaded = await uploadImages(files, this.folder, this.files);
      if (uploaded.length > 0) {
        await this.goToFolder(this.folder, uploaded[uploaded.length - 1]);
      }
    } finally {
      this.uploading = false;
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
   * @param {string|null} selectPath   optional: select this image (used after an upload)
   */
  async goToFolder(folder, selectPath = null) {
    const contents = await browseFolder(folder);
    if (!contents) {
      ui.notifications.warn(game.i18n.format("PORTRAIT_PICKER.Warnings.FolderUnreadable", { folder: folder }));
      return;
    }
    this.showFolder(contents);

    if (selectPath) {
      for (const file of this.files) {
        if (samePath(file, selectPath)) {
          this.selectedPath = file;
        }
      }
    }
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

  /** The Upload button: open the computer's file chooser. */
  static onUploadButton(event, target) {
    const fileInput = this.element.querySelector(".portrait-picker-file-input");
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Confirm button: save the selected image to the actor, then to the
   * actor's linked tokens on the scene being viewed, then close.
   * If saving the actor fails, the window stays open so the user can try
   * again (applyImageToActor has already shown them a message), and the
   * tokens are left alone so they don't get out of step with the actor.
   */
  static async onConfirm(event, target) {
    if (!this.selectedPath) {
      return;
    }

    // Disable Confirm while saving, so a double-click can't save twice.
    target.disabled = true;
    const saved = await applyImageToActor(this.actor, this.selectedPath, this.folder);
    if (!saved) {
      target.disabled = false;
      return;
    }

    await applyImageToSceneTokens(this.actor, this.selectedPath, this.mode);
    await this.close();
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
