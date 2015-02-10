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
const promise = require("promise");

const SimulatorRegExp = new RegExp(Services.prefs.getCharPref("devtools.webide.simulatorAddonRegExp"));

let Simulators = {
  _simulators: null,

  // TODO Allow the user to add/remove simulators.

  getAll() {
    if (this._simulators) {
      return promise.resolve(this._simulators);
    }
    let deferred = promise.defer();
    // TODO Instead of mapping this._simulators to addons, use a persistant list
    // of configured simulators, then add a default-configured simulator for
    // each unused addon (for convenience).
    this.getSimulatorAddons().then(addons => {
      this._simulators = addons.map(addon => {
        let name = addon.name.replace(" Simulator", "");
        let s = new Simulator({name});
        s.addon = addon;
        return s;
      });
      deferred.resolve(this._simulators);
    });
    return deferred.promise;
  },

  // Return the list of installed simulator addons, including "unofficial" ones.
  getSimulatorAddons() {
    let deferred = promise.defer();
    AddonManager.getAllAddons(all => {
      let addons = [];
      for (let addon of all) {
        if (SimulatorRegExp.exec(addon.id)) {
          addons.push(addon);
        }
      }
      // Sort simulator addons by name.
      addons.sort((a, b) => {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      deferred.resolve(addons);
    });
    return deferred.promise;
  },

  // TODO Actually update the simulator list.
  onEnabled(addon) {
    this.emit("updated");
  },
  onDisabled(addon) {
    this.emit("updated");
  },
  onInstalled(addon) {
    this.emit("updated");
  },
  onUninstalled(addon) {
    this.emit("updated");
  },
};
EventEmitter.decorate(Simulators);
AddonManager.addAddonListener(Simulators);
exports.Simulators = Simulators;


function Simulator(options) {
  this.addon = null;
  this.options = options || {};
  // TODO Fill `this.options` with default values where needed.
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
    return this.options.name || "Unknown";
  },

  get version() {
    return this.addon ? this.addon.name.match(/\d+\.\d+/)[0] : "Unknown";
  },
};
exports.Simulator = Simulator;
