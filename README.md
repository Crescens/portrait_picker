# Portrait Picker

A Foundry VTT module for the D&D 5e system that makes it quick to switch a character's
portrait and token image, for example to show their current mood while roleplaying.

Click the portrait on an actor sheet and a picker opens showing thumbnails of your images.
Choose one and the module updates, all at once:

1. the actor's portrait
2. the actor's prototype token image (at normal scale)
3. every **linked** token for that actor on the scene you're currently viewing

Tokens on other scenes and unlinked tokens are not changed.

## Requirements
- Foundry VTT v14 (verified on build 367)
- D&D 5e system 5.3.3 or later, using its **default** actor sheets (not legacy sheets, not Tidy 5e)
- No other modules are needed.

## Installation
In Foundry's setup screen: **Add-on Modules → Install Module**, paste this Manifest URL, then
click **Install**:

```
https://github.com/crescens/portrait_picker/releases/latest/download/module.json
```

Then open your world, go to **Game Settings → Manage Modules**, and enable **Portrait Picker**.
To update later, use **Check for Updates** on the Add-on Modules screen.

## Usage

### Choosing an image
- **Click** an actor's portrait to open the Portrait Picker. It opens in the folder the image
  was last chosen from, otherwise in `assets/<owner's user name>`, otherwise in `assets`.
- Click a folder to open it, and the **Up** arrow to go back. Type in the filter box to show
  only files and folders whose names contain that text.
- The actor's current image is marked **Current**. Click an image to select it, then click
  **Confirm**. The portrait and the prototype token (used for newly placed tokens) both get
  the new image, and the picker remembers that folder for next time.
- **Shift+click** the portrait to open Foundry's standard file picker instead.

Works on every dnd5e actor type whose default sheet has a portrait: characters, NPCs,
vehicles, groups and encounters.

### Token or Portrait
Before confirming, choose how this actor's **linked tokens on the scene you're viewing**
should look:

- **Token**: normal size. The token's dynamic ring is left as it is. Coming back from
  Portrait mode, the ring is put back exactly as it was before. With a ring, dnd5e draws the
  image at the size it uses for the creature's size (e.g. slightly smaller for Small
  creatures).
- **Portrait**: the image is drawn larger (6× by default, set by the GM) and the dynamic ring
  is turned off, for cinematic cut-out portraits. The token still occupies its normal grid
  space, so movement and positioning are unaffected.

The picker starts on whichever of the two the token is currently in. Newly placed tokens
start as **Token**, and the prototype token always stays at normal size. If the actor has no
linked token on the scene you're viewing, the picker says so, and only the portrait and
prototype token change.

**Tip:** newly placed tokens copy the actor's **Prototype Token**. If you want new tokens to
have a dynamic ring, turn on **Dynamic Ring** in the Prototype Token settings, not just on a
token on the scene. Otherwise a fresh token has no ring and looks slightly bigger than a
ringed Small token.

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
  letters and spaces. (Most Foundry hosts run on Linux, where `alice` and `Alice` are different
  folders.)
- Put pet or companion images in a subfolder of the owner's folder. The picker remembers the
  subfolder for each actor after the first time you pick from it.
- Supported file types: `.png`, `.jpg`, `.jpeg`, `.webp`. No animated or video files. File type
  checks ignore capital letters, so `Smile.PNG` is shown too.
- Players need Foundry's **Use File Browser** permission (the Trusted Player role has it by
  default). Players aren't locked to their own folder; the picker just starts there.

## Troubleshooting
| What you see | Likely cause |
|---|---|
| The picker opens in `assets` with a yellow "couldn't open the folder" message | The player's folder name doesn't exactly match their Foundry user name, or the remembered folder was renamed or deleted. |
| "you don't have the Use File Browser permission" | Give the player's role the **Use File Browser** permission in **Game Settings → Configure Permissions**. |
| Clicking the portrait opens Foundry's normal file picker | Shift was held, **Use Portrait Picker on my sheets** is off, or it's an **unlinked** token's sheet (those always use the standard picker). |
| A token on the scene didn't change | It's unlinked, it's on a different scene from the one you're viewing, or you don't have permission to change it (you'll see a yellow message). |
| The ring shows a different picture than the one chosen | The token's ring has its own **Subject Texture** set, which Foundry shows instead. Clear it in the token's settings. |
| No `portrait_picker` lines in the console | Turn on **Debug logging**, and make sure the console's **Logs** level is shown. `portrait_picker \| Ready.` always appears on page load. |

## Known limitations
- Only the dnd5e default actor sheets are supported.
- Sheets for unlinked tokens always use Foundry's standard file picker.
- Only linked tokens on the scene **you** are currently viewing are updated. Tokens on other
  scenes keep their old image until you change it again while viewing that scene.
- If a token's dynamic ring has its own **Subject Texture** set, Foundry shows that image
  inside the ring instead of the token image. This is intentional.
- Token mode sets the image scale back to 1× (dnd5e's standard); a custom token scale is not
  kept.
- Thumbnails are the full images, loaded as you scroll. Very large folders of very large
  images may be slow.

## Changelog
- **0.6.0**: Polish. The picker notes when there's no linked token on the scene. README gains
  troubleshooting and changelog sections.
- **0.5.1**: A token's own dynamic ring setting is kept; Portrait mode remembers the ring and
  restores it when switching back to Token.
- **0.5.0**: Linked tokens on the viewed scene are updated; Token/Portrait choice; automated
  GitHub releases.
- **0.4.0**: Confirm saves the portrait and prototype token and remembers the folder;
  browsing with subfolders, filter and current-image highlight.

## Publishing a release (for the maintainer)
Releases are built automatically by a GitHub Actions workflow
(`.github/workflows/release.yml`) when a release is **published**.

1. Make sure the code you want to release is on the branch you'll release from (normally
   `main`).
2. On GitHub, open the repository → **Releases** → **Draft a new release**.
3. **Choose a tag** → type a new tag like `v0.6.0` → **Create new tag on publish**. Set
   **Target** to the branch from step 1.
4. Give it a title (e.g. `v0.6.0`) and a short description of what changed.
5. Leave **Set as a pre-release** unticked (Foundry's manifest link only follows normal
   releases), then click **Publish release**.
6. Open the repository's **Actions** tab: a **Release** run appears and should finish with a
   green tick within a minute or two. The release page then shows `module.json` and
   `module.zip` under **Assets**.
7. In Foundry's setup screen → **Add-on Modules**, click **Check for Updates** (or install
   with the manifest URL the first time).

The workflow takes the version from the tag (`v0.6.0` → `0.6.0`) and writes it, plus the
correct download link, into the released `module.json`, so the tag is what counts.
