/**
 * settings.js
 * Registers the module's settings with Foundry. They show up under
 * Game Settings > Configure Settings > Portrait Picker.
 *
 * Setting "scope" decides who a setting belongs to:
 * - "world":  one value for the whole game, saved on the server (GM controls it)
 * - "user":   one value per Foundry user, saved on the server, so it follows
 *             that user to any browser they log in from
 * - "client": one value per browser, saved only on that computer
 *
 * The name and hint values are keys into lang/en.json. Foundry translates
 * them automatically when it draws the settings window.
 */

import { MODULE_ID } from "./constants.js";

export function registerSettings() {
  // Each user decides for themselves whether clicking a portrait opens our
  // picker. "user" scope so a GM turning it off doesn't affect players.
  game.settings.register(MODULE_ID, "enabled", {
    name: "PORTRAIT_PICKER.Settings.Enabled.Name",
    hint: "PORTRAIT_PICKER.Settings.Enabled.Hint",
    scope: "user",
    config: true,
    type: Boolean,
    default: true
  });

  // How much bigger the token IMAGE is drawn in "Portrait" mode.
  // "world" scope + restricted so only the GM can change it for everyone.
  // This only scales the picture, never the token's size in grid squares.
  game.settings.register(MODULE_ID, "portraitScale", {
    name: "PORTRAIT_PICKER.Settings.PortraitScale.Name",
    hint: "PORTRAIT_PICKER.Settings.PortraitScale.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    range: {
      min: 1,
      max: 10,
      step: 0.5
    },
    default: 6
  });

  // Hidden: remembers that saved data from the old "portrait_picker" id has
  // already been moved to the new id, so migration.js only does it once.
  game.settings.register(MODULE_ID, "oldDataMigrated", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Extra console messages for troubleshooting. "client" scope because it's
  // about this one browser's console, and nobody else needs to see it.
  game.settings.register(MODULE_ID, "debug", {
    name: "PORTRAIT_PICKER.Settings.Debug.Name",
    hint: "PORTRAIT_PICKER.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}
