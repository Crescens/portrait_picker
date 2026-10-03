# CLAUDE.md — Portrait Picker (Foundry VTT module)

Context for future Claude sessions. Keep this file updated as the project changes.

## What this module does
Players click the portrait on a dnd5e actor sheet and a custom picker opens (instead of
Foundry's FilePicker). Choosing an image sets, in one go:
1. the actor portrait (`img`)
2. the prototype token image (`prototypeToken.texture.src`), always at 1x
3. every LINKED token for that actor on the scene the user is currently VIEWING

Tokens on other scenes and unlinked tokens are never changed. A "Token" / "Portrait" choice
controls how scene tokens are drawn (see Scale rules).

## Target versions (strict)
- Foundry VTT v14, build 367 — module.json `compatibility`: minimum "14", verified "14.367"
- dnd5e system 5.3.3 — ONLY its default (non-legacy) actor sheets. No Tidy 5e, no legacy sheets.
- Hosting: a standard hosted Foundry server on Linux, so paths are case-sensitive.

## Test world
- Players have the **Trusted Player** role (which has "Use File Browser"). Their user names
  exactly match their folders under `assets/`.
- When writing player-permission tests, test as a Trusted Player, not the GM (GM has more
  permissions and would hide problems).
- Dev builds before a release exists: download the branch ZIP from GitHub and upload the folder
  (renamed `portrait-picker`, matching the module id) to `Data/modules/` on the server.

## Privacy rules (the repo is public)
- NEVER commit real player/user names, the hosting provider's name, IP addresses, server
  addresses, emails, passwords, keys or tokens. Use generic examples (Alice, Bob, "assets/Alice").
- Do not put Claude session links in commit messages (omit the `Claude-Session:` trailer).
- Before each push, grep for the above.

## Module id (renamed in 1.0.0)
- id is **`portrait-picker`** (hyphen). Foundry's module guide: ids "must be an all lower-case
  string with no special characters and should use hyphens (not underscores)". Up to 0.7.1 it
  was `portrait_picker`; renamed before listing on Foundry's package directory.
- The GitHub repo is still `Crescens/portrait_picker` (URLs unchanged). Lang keys stay
  `PORTRAIT_PICKER.*`; CSS classes were always `portrait-picker-*`.
- `constants.js`: `MODULE_ID = "portrait-picker"`, `OLD_MODULE_ID = "portrait_picker"`,
  `LOG_PREFIX = "portrait-picker |"`.
- `migration.js` (`migrateOldData`, called on `ready`): GM only, and only the
  `game.users.activeGM`; runs once per world (hidden world setting `oldDataMigrated`). Copies
  `_source.flags.portrait_picker` → `flags.portrait-picker` on all world actors
  (`Actor.implementation.updateDocuments`) and all tokens on all scenes
  (`scene.updateEmbeddedDocuments("Token", …)`). Reads `_source` because `getFlag()` rejects
  scopes of inactive packages. Old flags are left in place (harmless). On error the setting
  isn't saved, so it retries next load. If the old module is still active, the GM gets a
  permanent warning every load. Settings are NOT migrated (user re-checks portraitScale).
- Upgrading users must uninstall 0.7.x and install 1.0.0 (README "Upgrading from 0.7.x").

## Versioning
- From 1.0.0 on (semantic versioning): bug fix → patch (1.0.0 → 1.0.1), new feature → minor
  (1.0.1 → 1.1.0). Update `module.json` version/download and the README Changelog each time.
- Before 1.0.0: each phase bumped `module.json` `version` to `0.<phase>.0` (Phase 5 → 0.5.0) and the
  `download` URL to the matching `v0.<phase>.0` tag. Fixes within a phase bump the patch
  number (0.5.0 → 0.5.1). After Phase 6 the user decides on stretch
  goals and when to go to 1.0.0.
- History was reset to a single clean commit at 0.4.0 (end of Phase 4) before going public.

## The user's preferences (important)
- The user is new to Foundry module development and will not use code they don't understand.
- Plain JavaScript ES modules. No build step, no TypeScript, no libraries, no module dependencies.
- Simple, safe, well-commented code. Comments explain WHY in beginner-friendly language.
  Avoid clever one-liners and advanced JS features when a simpler version works.
- Small files, each with a short header comment explaining its purpose.
- All user-facing text lives in `lang/en.json` (keys under `PORTRAIT_PICKER.*`).
- Console logging uses the prefix `portrait-picker |` (see `scripts/logger.js`);
  `log.debug()` only prints when the "Debug logging" client setting is on.
- Friendly `ui.notifications` messages instead of silent failures.
- Work in small phases. After EVERY phase stop and wait for approval, and give:
  (1) plain-language walkthrough of each new/changed file, (2) step-by-step manual Foundry
  test instructions (beginner level, e.g. how to open the console), (3) what to report back.
- If unsure, or an assumption looks wrong, ask instead of guessing.
- Do not rely on memory for Foundry APIs; v14 changed a lot. Check https://foundryvtt.com/api/
  and the dnd5e source (tag `release-5.3.3`).

## File layout
```
module.json                  manifest (id portrait-picker)
scripts/main.js              entry point; init/ready hooks
scripts/constants.js         MODULE_ID, LOG_PREFIX
scripts/logger.js            debug/warn/error console helpers
scripts/settings.js          registers settings
scripts/sheet-hook.js        intercepts the portrait click
scripts/folders.js           owner lookup, start folder, safe browse, path helpers
scripts/picker-app.js        the picker window (ApplicationV2 + Handlebars)
scripts/image-updater.js     actor, prototype, scene-token updates; Token/Portrait modes
scripts/uploader.js          uploads (drag-and-drop, Upload button, paste) into a folder
scripts/migration.js         one-time move of saved data from the old id (portrait_picker)
docs/picker.png              screenshot for README / Foundry listing (not shipped in the zip)
templates/picker.hbs         picker HTML
styles/portrait-picker.css   picker styles
lang/en.json                 all user-facing strings
LICENSE                      MIT, "Copyright (c) 2026 Crescens" (shipped in the zip)
.github/workflows/release.yml release packaging
```

## Settings
| key | scope | default | notes |
|---|---|---|---|
| `enabled` | user | true | "Use Portrait Picker on my sheets" |
| `portraitScale` | world, restricted | 6 | Portrait-mode texture multiplier, range 1–10 step 0.5 |
| `debug` | client | false | Enables `log.debug` output |
| `oldDataMigrated` | world, hidden | false | Set true once `migration.js` has run |

## Flags
- `flags.portrait-picker.lastFolder` (Actor): folder the actor's image was last chosen from.
- `flags.portrait-picker.mode` (scene TokenDocument): `"token"` or `"portrait"`. Never set on
  the prototype token, so freshly placed tokens have no flag and the picker preselects Token.
- `flags.portrait-picker.ringBeforePortrait` (scene TokenDocument): boolean, the token's
  `ring.enabled` saved when ENTERING Portrait mode (not overwritten portrait→portrait);
  restored on Portrait→Token. Left in place afterwards (harmless; overwritten next time).

## Design decisions (agreed with the user)
- **Hooking the click:** `Hooks.on("renderActorSheetV2", (app, element) => ...)`. Find
  `.portrait [data-action="editImage"]` and add a click listener on that `<img>`. On a normal
  click, `event.stopPropagation()` so ApplicationV2's action handler (one listener on the
  sheet element) never sees it, then open our picker. Shift+click, setting off, or
  `app.actor.isToken` (unlinked token sheet) → do nothing, so dnd5e opens the standard picker.
  Sheets can redraw only some parts, so the element is marked with
  `data-portrait-picker-bound="true"` to avoid adding a second listener. No monkey-patching.
  The `enabled` setting is read at click time, so toggling it needs no sheet reopen.
- **FilePicker source:** `"data"`. Extensions: `.png .jpg .jpeg .webp` only. We call
  `FilePicker.browse("data", folder)` WITHOUT the `extensions` option and filter in
  `folders.js` ourselves, so the check ignores capital letters (`Smile.PNG`).
- **Browsing is defensive** (`folders.js` `browseFolder`): any throw or a result without
  `dirs`/`files` arrays → `null`; bare names get the folder prepended; paths are
  compared/displayed decoded (`samePath`, `displayName`). The top of User Data is `""` (shown as "/").
  **Confirmed on the user's server (v14.367):** a missing folder THROWS
  (`Directory assets/NoSuchFolder does not exist or is not accessible in this storage location`);
  `target` is `"assets/Alice"`; `dirs`/`files` are FULL paths (`"assets/Alice/Pet"`,
  `"assets/Alice/Cache.png"`); non-image files (e.g. `README.txt`) are returned when no
  `extensions` option is passed, so our own filter is needed.
- **Picker UI:** filter box hides tiles (`hidden` attribute) instead of re-rendering, so focus
  and typing aren't lost. Selecting an image only toggles CSS classes (no re-render). Changing
  folder re-browses and re-renders (the filter is cleared). On entering a folder, the actor's
  current image is preselected if it's there, so Confirm works immediately.
- **Starting-folder warning:** if the first candidate (remembered folder, or the owner folder
  when nothing is remembered) can't be read, a warning names the missing folder and the one
  shown instead.
- **Opening guard:** `actorsBeingOpened` Set in `picker-app.js` stops a double-click from
  opening two windows while the starting folder is still loading.
- **Start folder:** actor flag `lastFolder` → `assets/<owner user name>` → `assets/`.
  Owner = the non-GM user whose assigned `character` is this actor, else the first non-GM with
  OWNER permission. Folder names must exactly match Foundry user names (case-sensitive).
- **Saving (Phase 4, `image-updater.js` `applyImageToActor`):** checks
  `actor.canUserModify(game.user, "update")`, then ONE `actor.update()` with dotted keys:
  `img`, `prototypeToken.texture.src`, `prototypeToken.texture.scaleX/Y` (1, sign kept via
  `keepSign`), `flags.portrait-picker.lastFolder` (the picker's current folder). Returns
  true/false; on failure the picker stays open and Confirm is re-enabled. dnd5e's
  `getPreferredArtwork` cache is cleared by `_clearCachedValues` on data prep, so the sheet
  shows the new image without extra work.
- **Prototype token:** new image at scale 1 (keep sign of scaleX/scaleY so mirroring survives).
  Never touch the prototype's `ring.enabled`.
- **Scale rules for scene tokens (linked, current scene only):**
  - Token mode: `texture.scaleX/Y` = 1 (sign kept). dnd5e then applies its own size factor
    for ringed tokens at data preparation. Ring: Token→Token = NOT touched (not in the
    update). Portrait→Token = restore `ringBeforePortrait`; if missing (token made a portrait
    by 0.5.0), fall back to the prototype's `ring.enabled`.
  - WHY (0.5.1 fix): 0.5.0 copied the prototype's ring into every Token-mode update. The
    user's Small character had the ring ON on the scene token but OFF on the prototype, so
    every image change / Portrait→Token turned the ring off. Confirmed via console:
    `prototypeRing:false, tokenRing:true, savedScale:1, shownScale:0.8, size:"sm"`. A fresh
    token (copied from the ringless prototype) looks bigger simply because dnd5e's 0.8 Small
    factor only applies with a ring — expected, documented as a README tip.
  - Portrait mode: `texture.scaleX/Y` = `portraitScale` setting (sign kept), `ring.enabled`
    = false (portraits are cinematic images with transparency; they must not use a ring).
    Entering Portrait saves the current ring state in `ringBeforePortrait` first.
  - User confirmed: tokens dragged onto a scene while other tokens are in Portrait mode come
    in at Token scale (from the prototype). This is the desired behaviour.
  - Never change `width`/`height` (grid footprint).
- **Scene tokens (Phase 5, `image-updater.js` `applyImageToSceneTokens`):** runs AFTER a
  successful actor update (if the actor update fails, tokens are left alone). Finds tokens with
  `canvas.scene.tokens` filtered by `actorLink && actorId === actor.id` (canvas.scene = viewed
  scene; null → nothing to do). Per token: `canUserModify(game.user, "update")` else warn and
  skip; one `token.update()` each in try/catch (one failure doesn't stop others). Sign check
  reads `token._source.texture` (dnd5e alters the prepared scale for ringed tokens, not the
  sign). Picker mode: `getCurrentMode(actor)` in the constructor; radio `change` listener in
  `_onRender` stores `this.mode` so it survives folder navigation re-renders.
- **Ring subject texture:** never modified by this module. If a token has an explicit
  `ring.subject.texture`, it intentionally overrides the token image inside the ring.
- **Permissions:** only update documents the user can update (`canUserModify(game.user,
  "update")`); skip others with a warning. Check `game.user.can("FILES_BROWSE")` before
  browsing.
- **Picker window:** one per actor (window id `portrait-picker-<actorId>`); opening it again
  calls `bringToFront()` on the existing one (found via `foundry.applications.instances`).
- **Picker preselect:** Portrait if the actor's linked token on the current scene has
  `flags.portrait-picker.mode === "portrait"`, otherwise Token.
- **Uploads (0.7.0, `uploader.js` + `picker-app.js` `activateUploads`/`handleNewFiles`):**
  - Needs `game.user.can("FILES_UPLOAD")` ("Upload New Files"; Foundry default role is
    Assistant GM, the user granted it to Trusted Player). Without it the Upload button and
    drop hint are hidden and drop/paste show `Warnings.NoUploadPermission`.
  - `FilePicker.implementation.upload("data", folder, file, {}, { notify: false })`; success
    = response has `path` (v14 docs only say "the response object"). Throw / falsy / no path
    → `Errors.UploadFailed` per file; others continue. One summary `Picker.Uploaded` info.
  - Target = the folder being shown; refuses `""` (top of User Data).
  - Allowed by lower-cased extension, or by MIME via `IMAGE_MIME_EXTENSIONS` (pasted blobs).
    Extension is always written lower-case.
  - NEVER overwrite: names already in the folder (compared lower-case) get `-1`, `-2`, ...
    Pasted images (name "" or "image.*") are renamed `pasted-YYYY-MM-DD-HHMMSS.ext`.
  - Listeners live on `.portrait-picker-body` (rebuilt each render, so no duplicates):
    dragover (only when `dataTransfer.types` includes "Files") / dragleave / drop; hidden
    `<input type=file multiple>` opened by the `upload` action; `paste` (only when the
    clipboard holds files; `stopPropagation` so nothing else reacts). Thumbnails are
    `draggable="false"` so dragging a tile isn't mistaken for a file drop.
  - PASTE (0.7.1 fix): 0.7.0 focused the grid (`tabindex="0"`) and paste never fired in the
    user's browser (tested from a web page, Discord, and a copied .png file). Cause: Foundry's
    KeyboardManager handles Ctrl+V as its core "paste objects" keybinding unless focus is in
    a text field (v14 docs: `hasFocus` = input/select/textarea, contentEditable, a
    `data-keyboard-focus="true"` element, or a button inside a form), which stops the
    browser's native paste. Fix: focus the FILTER `<input>` after each render, and a body
    `keydown` listener moves focus to the filter input when Ctrl/Cmd+V is pressed elsewhere in
    the picker (focus change before the default action redirects the paste). Files are read
    from `clipboardData.files`, falling back to `clipboardData.items` (kind "file");
    `log.debug` prints `clipboardData.types` on each paste.
  - After upload: re-browse the folder and select the last uploaded file (`goToFolder(folder,
    selectPath)`); `this.uploading` blocks overlapping uploads.
  - README has a Permissions section warning that Upload New Files is not limited to a
    player's own folder (user asked for this to be documented for other groups).
- **No-tokens note (0.6.0):** if `findLinkedTokensOnViewedScene(actor)` is empty, the picker
  shows `PORTRAIT_PICKER.Picker.Mode.NoTokens` under the Token/Portrait radios (the choice
  would change nothing).

## Key API findings
### dnd5e 5.3.3 (tag release-5.3.3)
- Default sheets (`dnd5e.mjs` ~153–177): character → `CharacterActorSheet`, npc →
  `NPCActorSheet`, vehicle → `VehicleActorSheet`, group → `GroupActorSheet`, encounter →
  `EncounterActorSheet`. All extend `BaseActorSheet`
  (`module/applications/actor/api/base-actor-sheet.mjs`), which extends
  `foundry.applications.sheets.ActorSheetV2`. All five show a portrait.
- Portrait markup: `templates/actors/character-sidebar.hbs`, `npc-header.hbs`,
  `vehicle/sidebar.hbs`, `group/header.hbs`, `encounter/header.hbs`. `<img>` inside
  `div.portrait` with `data-action="editImage"` (only if editable, else `showArtwork`) and
  `data-edit="img"` (or `prototypeToken.texture.src` when the sheet's Token/Portrait toggle
  `flags.dnd5e.showTokenPortrait` is on). If the token uses random wildcard images the action
  is `configurePrototypeToken` — we leave that alone.
- Click handler: `editImage` → `module/applications/api/primary-sheet-mixin.mjs:22` →
  `_onEditImage` in `module/applications/api/application-v2-mixin.mjs:327`, which does
  `new foundry.applications.apps.FilePicker.implementation({...}).browse()`.
- Ring scale: `module/documents/token.mjs` `prepareData()` multiplies the SOURCE
  `texture.scaleX/Y` by `CONFIG.DND5E.actorSizes[size].dynamicTokenScale` when the ring is on
  (only `sm` defines it: 0.8). Grid footprint comes from `actorSizes[size].token`.
### Foundry v14 API (https://foundryvtt.com/api/, checked against 14.365 docs)
- `foundry.applications.apps.FilePicker.implementation`; static
  `browse(source, target, { bucket, extensions, wildcard })` → Promise of `{ dirs, files, target, ... }`.
- `foundry.applications.instances`: `Map` of rendered ApplicationV2 windows by id.
  ApplicationV2 has `bringToFront()`, `rendered`, `close()`. Action handlers are static
  functions where `this` is the window (same pattern dnd5e uses).
- `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin` (`static PARTS`,
  `DEFAULT_OPTIONS` with `id, classes, window, position, actions`, `_prepareContext`, `_onRender`).
- Render hooks: `render{ClassName}` for each class in the inheritance chain, args
  `(application, element, context, options)`.
- `ActorSheetV2`: `actor`, `token` (unlinked token sheets only), `isEditable`.
- `Actor`: `img`, `prototypeToken`, `isToken`, `getDependentTokens({ scenes, linked })`,
  `testUserPermission`, `getFlag/setFlag/unsetFlag`.
- `TokenDocument`: `texture { src, scaleX, scaleY }`, `ring { enabled, subject { texture, scale } }`,
  `actorLink`, `width/height` (plus v14 `depth`, `level`), `canUserModify`, `isOwner`.
- `game.settings.register(ns, key, { name, hint, scope: world|client|user, config, type,
  default, range, restricted, onChange, requiresReload })`.
- `User`: `isGM`, `character`, `can(action)`. `CONST.USER_PERMISSIONS.FILES_BROWSE` and
  `TOKEN_CONFIGURE` exist.

## Phase status
1. Skeleton (module.json, settings, logger, lang, CLAUDE.md, README) — DONE, tested by user
2. Click hook + placeholder window — DONE, tested by user (incl. as a Trusted Player)
3. Real folder browsing — DONE, tested by user (GM and Trusted Player)
4. Actor + prototype token update, remember folder — DONE, tested by user (v0.4.0).
5. Scene tokens + Token/Portrait scale + rings + GitHub release workflow — 0.5.0 released
   via the workflow and installed through Foundry's updater (workflow proven on a real
   release). Console logging confirmed working (user had debug off). 0.5.1 fixes the ring
   being turned off (see Scale rules) — DONE, tested by user.
6. Polish (0.6.0): code review pass (no bugs found), no-tokens note in the picker, README
   rewritten (troubleshooting, changelog), `bugs` URL in module.json — DONE, tested by user.

## 1.0.0
- Module id renamed + migration (above), version 1.0.0, README screenshot (`docs/picker.png`,
  user-provided, generic test art), upgrade notes, GIF-paste note, "Listing on Foundry's
  package directory" maintainer section, `readme`/`changelog` URLs in module.json. No `media`
  entry: the v14 docs only document type `setup` (setup-screen background), so images go on
  the Foundry package admin page instead. RELEASED (v1.0.0) and in use by the user's group;
  package submission ON HOLD (see below).
- Listing per release: admin page needs the RELEASE-SPECIFIC manifest URL
  (`…/releases/download/vX.Y.Z/module.json`), notes URL, compatibility min 14 / verified 14.367.
  Optional future: automate via the Package Release API (`fvttp_` token as a GitHub secret).

## Foundry package listing: ON HOLD (user decision)
- 1.0.0 is released on GitHub and used by the user's own group. Listing on foundryvtt.com is
  on hold because of Foundry's AI Content Policy (https://foundryvtt.com/article/ai-policy/,
  revised 2026-03-18). Do not push the user toward listing; they'll raise it if they want it.
- Policy points that matter for this package:
  - Code: AI-assisted code is allowed, but the author must "understand, explain, modify, and
    maintain every part" of it and attest to that at submission.
  - Prepared text must be human-made: "rules, lore, adventure content, journal entries, item
    descriptions, UI labels". Package descriptions on foundryvtt.com "must be human-written".
    `lang/en.json` strings and the `module.json` description were written by Claude → the user
    would have to rewrite them; README is a grey area (shipped in the zip and linked) → treat
    as needing the user's own words. AI may only proofread/format human-authored text.
  - Listing images must not be AI-generated (unconfirmed whether the test portraits in
    `docs/picker.png` are).
  - No disclosure label needed for ordinary AI assistance ("Zero AI" can't be claimed); no
    "AI Tools" tag needed (the module generates nothing at runtime).
- If the user resumes: give them a worksheet of string keys + where each appears + what it
  must convey (NOT suggested wording); they write the text; Claude proofreads and wires it in;
  release as a patch version; then they submit (Package Type `module`, Package ID
  `portrait-picker`, Package Title `Portrait Picker`, Package URL the GitHub repo, their
  Foundry Discord username — never commit that username).

## Stretch goals
- 0.7.0: upload via drag-and-drop, Upload button and paste; MIT license; author name
  "Crescens" everywhere — released; upload button, drag-and-drop and no-overwrite tested OK,
  paste failed → 0.7.1 fix — DONE, tested by user (pasting a GIF yields a still PNG of the
  first frame; user accepted, documented).
- Proposed for 1.1.0 (user to choose): token right-click (Token HUD) button to open the
  picker, a "recent images" row per actor, double-click to confirm. Also suggested: larger
  preview, thumbnail size control, "new folder" button. Lower priority: keyboard navigation,
  updating tokens on all scenes. Advised against: delete/rename from the picker; restricting
  players to their own folder (cosmetic only, implies false security).

## Testing approach
- Manual testing in Foundry by the user (GM and a Trusted Player) after every phase.
- Claude also runs throwaway Node scripts with mocked `game`/`ui`/`canvas`/documents against
  `folders.js`, `image-updater.js` and `uploader.js` (kept in the session scratchpad, NOT in the repo, to
  keep the repo tooling-free). Re-create them when changing that logic.
- Keep the README "Changelog" section updated with every release.

## Release
Manifest URL: `https://github.com/Crescens/portrait_picker/releases/latest/download/module.json`.
The repo is public. `.github/workflows/release.yml` runs on `release: published`: tag
`vX.Y.Z` → version `X.Y.Z` (rejects other formats); `jq` writes version/manifest/download
(built from `github.repository`) into module.json; zips `module.json README.md scripts styles
templates lang LICENSE` (module.json at zip root; CLAUDE.md and .github are NOT shipped); uploads both
with `gh release upload --clobber`. Only first-party `actions/checkout@v4`; no third-party
actions. The tag must point at a commit that contains the workflow file. Pre-releases are
ignored by `releases/latest`. Maintainer steps are in README "Publishing a release".
