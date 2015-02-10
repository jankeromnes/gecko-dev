/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cu } = require("chrome");
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");
const { EventEmitter } = Cu.import("resource://gre/modules/devtools/event-emitter.js");
const { ConnectionManager } = require("devtools/client/connection-manager");
const { AddonSimulatorProcess,
        OldAddonSimulatorProcess,
        CustomSimulatorProcess } = require("devtools/webide/simulator-process");
const { GetDevices } = require("devtools/shared/devices");
const promise = require("promise");

const SimulatorRegExp = new RegExp(Services.prefs.getCharPref("devtools.webide.simulatorAddonRegExp"));
const LocaleCompare = (a, b) => {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
};

let Simulators = {
  _simulators: null,
  _defaultOptions: null,

  _load() {
    let deferred = promise.defer();
    // TODO Load a persistent list of configured simulators first.
    this._simulators = [];

    GetDevices().then(devices => {
      // Use the first device (featured) as reference for emulation options.
      this._defaultOptions = devices[devices.TYPES[0]][0];

      // Add default simulators to the list for each new (unused) addon.
      this.findSimulatorAddons().then(addons => {
        addons.forEach(this.addIfUnusedAddon.bind(this));
        deferred.resolve(this._simulators);
      });
    });
    return deferred.promise;
  },

  // List all available simulators.
  findAll() {
    if (this._simulators) {
      return promise.resolve(this._simulators);
    }
    return this._load();
  },

  // List all installed simulator addons.
  findSimulatorAddons() {
    let deferred = promise.defer();
    AddonManager.getAllAddons(all => {
      let addons = [];
      for (let addon of all) {
        if (this.isSimulatorAddon(addon)) {
          addons.push(addon);
        }
      }
      // Sort simulator addons by name.
      addons.sort(LocaleCompare);
      deferred.resolve(addons);
    });
    return deferred.promise;
  },

  // Detect simulator addons, including "unofficial" ones
  isSimulatorAddon(addon) {
    return SimulatorRegExp.exec(addon.id);
  },

  // Add a new simulator to the list. Caution: `name` may change.
  // @return Promise to added simulator.
  add(simulator) {
    let simulators = this._simulators;
    if (!simulators) {
      return this.findAll().then(this.add.bind(this, simulator));
    }
    // TODO Ensure `simulator.name` is unique by appending to it if necessary.
    let concat = simulators.concat([simulator]).sort(LocaleCompare);
    this._simulators = concat;
    this.emitUpdated();
    return promise.resolve(simulator);
  },

  remove(simulator) {
    let simulators = this._simulators;
    if (!simulators) {
      return this.findAll().then(this.remove.bind(this, simulator));
    }
    let remaining = simulators.filter(s => s !== simulator); // FIXME Deep compare?
    this._simulators = remaining;
    if (this._simulators.length !== simulators.length) {
      this.emitUpdated();
    }
  },

  // Add a new default simulator for `addon` if no other simulator uses it.
  addIfUnusedAddon(addon) {
    let simulators = this._simulators;
    if (!simulators) {
      return this.findAll.then(this.addIfUnusedAddon.bind(this, addon));
    }
    let matching = simulators.filter(s => s.addon && s.addon.id == addon.id);
    if (matching.length > 0) {
      return promise.resolve(null);
    }
    let name = addon.name.replace(" Simulator", "");
    return this.add(new Simulator({name}, addon));
  },

  // TODO Find a more conservative way to deal with uninstalled addons.
  removeIfUsingAddon(addon) {
    let simulators = this._simulators;
    if (!simulators) {
      return this.findAll().then(this.removeIfUsingAddon.bind(this, addon));
    }
    let remaining = simulators.filter(s => !s.addon || s.addon.id != addon.id);
    this._simulators = remaining;
    if (this._simulators.length !== simulators.length) {
      this.emitUpdated();
    }
  },

  emitUpdated() {
    this.emit("updated");
  },

  onConfigure(e, simulator) {
    this._lastConfiguredSimulator = simulator;
  },

  onInstalled(addon) {
    if (this.isSimulatorAddon(addon)) {
      this.addIfUnusedAddon(addon);
    }
  },

  onEnabled(addon) {
    if (this.isSimulatorAddon(addon)) {
      this.addIfUnusedAddon(addon);
    }
  },

  onDisabled(addon) {
    if (this.isSimulatorAddon(addon)) {
      this.removeIfUsingAddon(addon);
    }
  },

  onUninstalled(addon) {
    if (this.isSimulatorAddon(addon)) {
      this.removeIfUsingAddon(addon);
    }
  },
};
exports.Simulators = Simulators;
AddonManager.addAddonListener(Simulators);
EventEmitter.decorate(Simulators);
Simulators.on("configure", Simulators.onConfigure.bind(Simulators));

function Simulator(options = {}, addon = null) {
  this.addon = addon;
  this.options = options;

  // Fill `this.options` with default values where needed.
  let defaults = Simulators._defaultOptions;
  for (let option in defaults) {
    if (this.options[option] == null) {
      this.options[option] = defaults[option];
    }
  }
}
Simulator.prototype = {
  launch() {
    // Close already opened simulation.
    if (this.process) {
      return this.kill().then(this.launch.bind(this));
    }

    this.options.port = ConnectionManager.getFreeTCPPort();

    // Choose simulator process type.
    if (this.addon == null) {
      // Custom binary.
      this.process = new CustomSimulatorProcess(this.options);
    } else if (this.version > "1.3") {
      // Recent simulator addon.
      this.process = new AddonSimulatorProcess(this.addon, this.options);
    } else {
      // Old simulator addon.
      this.process = new OldAddonSimulatorProcess(this.addon, this.options);
    }
    this.process.run();

    return promise.resolve(this.options.port);
  },

  kill() {
    let process = this.process;
    if (!process) {
      return promise.resolve();
    }
    this.process = null;
    return process.kill();
  },

  get id() {
    return this.name;
  },

  get name() {
    return this.options.name;
  },

  get version() {
    return this.addon ? this.addon.name.match(/\d+\.\d+/)[0] : "Unknown";
  },
};
exports.Simulator = Simulator;
