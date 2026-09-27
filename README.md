# Portrait Picker

A Foundry VTT module for the D&D 5e system that makes it quick to switch a character's
portrait and token image, for example to show their current mood while roleplaying.

Click the portrait on an actor sheet and a picker opens showing thumbnails of your images.
Choose one and the module updates, all at once:

1. the actor's portrait
2. the actor's prototype token image (at normal scale)
3. every **linked** token for that actor on the scene you're currently viewing

Tokens on other scenes and unlinked tokens are not changed.

> **Status:** early development (Phase 4 of 6). Confirming a choice updates the actor's
> portrait and prototype token. Updating tokens already on the scene, and the Token/Portrait
> choice, are not built yet.

## Requirements
- Foundry VTT v14 (verified on build 367)
- D&D 5e system 5.3.3 or later, using its **default** actor sheets (not legacy sheets, not Tidy 5e)

## Installation
In Foundry's setup screen: **Add-on Modules → Install Module**, paste this Manifest URL, then
click **Install**:

```
https://github.com/crescens/portrait_picker/releases/latest/download/module.json
```

Then open your world, go to **Game Settings → Manage Modules**, and enable **Portrait Picker**.

> The GitHub repository must be public for the manifest URL to work.

## Usage
*(Coming in later phases.)*
- **Click** an actor's portrait to open the Portrait Picker. It opens in the folder the image
  was last chosen from, otherwise in `assets/<owner's user name>`, otherwise in `assets`.
- Click a folder to open it, and the **Up** arrow to go back. Type in the filter box to show
  only files and folders whose names contain that text.
- The actor's current image is marked **Current**. Click an image to select it, then click
  **Confirm**. The portrait and the prototype token (used for newly placed tokens) both get
  the new image, and the picker remembers that folder for next time.
- **Shift+click** the portrait to open Foundry's standard file picker instead.
- Choose **Token** (normal image size) or **Portrait** (the image is drawn larger, while the
  token still occupies its normal grid space), then click **Confirm**.

## Settings
Found under **Game Settings → Configure Settings → Portrait Picker**.

| Setting | Who | Default | What it does |
|---|---|---|---|
| Use Portrait Picker on my sheets | each user | On | Turn off to get Foundry's standard file picker when you click a portrait. |
| Portrait mode image scale | GM only | 6 | How many times larger the token image is drawn in Portrait mode. |
| Debug logging | each browser | Off | Prints extra `portrait_picker \|` messages in the browser console (F12). |

## Folder setup
Images live in Foundry's User Data folder under `assets/<player name>/`, one folder per player:

```
assets/
  Alice/            ← Alice's character images
    Whiskers/       ← images for Alice's pet, Whiskers
  Bob/
```

- The folder name must **exactly** match the player's Foundry user name, including capital
  letters and spaces. (Most Foundry hosts run on Linux, where `alice` and `Alice` are different folders.)
- Put pet or companion images in a subfolder of the owner's folder.
- Supported file types: `.png`, `.jpg`, `.jpeg`, `.webp`. No animated or video files.
- Players need Foundry's **Use File Browser** permission (the Trusted Player role has it by
  default).
- File type checks ignore capital letters, so `Smile.PNG` is shown too.

## Known limitations
- Only the dnd5e default actor sheets are supported.
- Sheets for unlinked tokens always use Foundry's standard file picker.
