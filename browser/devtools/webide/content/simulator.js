/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;

const { EventEmitter } = Cu.import("resource://gre/modules/devtools/event-emitter.js");
const { require } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
const { Devices } = require("devtools/shared/devices");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const { Simulators, Simulator } = require("devtools/webide/simulators");
const promise = require("promise");
const utils = require("devtools/webide/utils");

const Strings = Services.strings.createBundle("chrome://browser/locale/devtools/webide.properties");

let SimulatorEditor = {
  _addons: {},
  _devices: {},
  _form: null,
  _simulator: null,

  // Generate the dynamic form elements.
  init() {
    let deferred = promise.defer();

    // Append a new <option> to a <select> (or <optgroup>) element.
    function opt(select, value, text) {
      let option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    }

    let form = this._form;

    // Generate B2G version selector.
    Simulators.getSimulatorAddons().then(addons => {
      this._addons = {};
      form.version.innerHTML = "";
      form.version.classList.remove("custom");
      addons.forEach(addon => {
        this._addons[addon.id] = addon;
        opt(form.version, addon.id, addon.name);
      });
      opt(form.version, "custom", "");
      opt(form.version, "pick", Strings.GetStringFromName("simulator_custom_binary"));
      deferred.resolve();
    });

    // Generate profile selector.
    form.profile.innerHTML = "";
    form.profile.classList.remove("custom");
    opt(form.profile, "default", Strings.GetStringFromName("simulator_default_profile"));
    opt(form.profile, "custom", "");
    opt(form.profile, "pick", Strings.GetStringFromName("simulator_custom_profile"));

    // Generate example devices list.
    form.device.innerHTML = "";
    form.device.classList.remove("custom");
    opt(form.device, "custom", Strings.GetStringFromName("simulator_custom_device"));
    Devices.Types.forEach(type => {
      if (!Devices.FirefoxOS[type].length) {
        return;
      }
      let optgroup = document.createElement("optgroup");
      optgroup.label = Devices.GetString(type);
      Devices.FirefoxOS[type].forEach(device => {
        this._devices[device.name] = device;
        opt(optgroup, device.name, device.name);
      });
      form.device.appendChild(optgroup);
    });

    return deferred.promise;
  },

  // Edit the configuration of an existing Simulator, or create a new one.
  edit(simulator) {
    if (simulator && simulator === this._simulator) {
      return promise.resolve();
    }

    let deferred = promise.defer();

    // If no Simulator was given to edit, we're creating a new one.
    if (!simulator) {
      simulator = new Simulator(); // Default options.
      // TODO Add it to the list of available simulators.
    }

    this.clear();
    this.init().then(() => {

      this._simulator = simulator;

      // Update the form fields.
      let form = this._form;
      form.name.value = simulator.name;
      this.updateVersionSelector();
      this.updateProfileSelector();
      this.updateDeviceSelector();
      for (let option in simulator.options) {
        let value = simulator.options[option];
        if (!form[option] || !value) {
          continue;
        }
        form[option].value = value;
      }

      deferred.resolve();
    });

    return deferred.promise;
  },

  // Reset the simulator to its default configuration.
  reset() {
    // TODO
  },

  // Stop editing this simulator's configuration.
  clear() {
    this._simulator = null;
  },

  // VERSION: Can be an installed addon.id or a custom binary path.

  get version() {
    let s = this._simulator;
    if (s.addon) {
      return s.addon.id;
    }
    return s.options.b2gBinary;
  },

  set version(value) {
    let s = this._simulator;
    if (this._addons[value]) {
      // `value` is a simulator addon ID.
      s.addon = this._addons[value];
      s.options.b2gBinary = null;
      // TODO If `form.name.value` contains a version, update it.
    } else {
      // `value` is a custom binary path.
      s.addon = null;
      s.options.b2gBinary = value;
      // TODO Indicate that a custom profile is required.
    }
  },

  updateVersionSelector() {
    this.updateSelector(this._form.version, this.version);
  },

  // PROFILE. Can be "default" or a custom profile directory path.

  get profile() {
    return this._simulator.options.gaiaProfile || "default";
  },

  set profile(value) {
    this._simulator.options.gaiaProfile = (value == "default" ? null : value);
  },

  updateProfileSelector() {
    this.updateSelector(this._form.profile, this.profile);
  },

  // DEVICE. Can be an existing device.name or "custom".

  get device() {
    // TODO Search for device name matching current properties.
    return "custom";
  },

  set device(device) {
    if (!device) {
      return;
    }
    let f = this._form;
    let s = this._simulator;
    s.options.width = f.width.value = device.width;
    s.options.height = f.height.value = device.height;
    s.options.pixelRatio = f.pixelRatio.value = device.pixelRatio;
    // TODO Indicate when `device` requires a custom profile (e.g. tablet, TV...).
  },

  updateDeviceSelector() {
    this.updateSelector(this._form.device, this.device);
  },

  // Select an available option, or set the "custom" option.
  updateSelector(selector, value) {
    selector.value = value;
    if (selector[selector.selectedIndex].value !== value) {
      selector.value = "custom";
      selector.classList.add("custom");
      selector[selector.selectedIndex].textContent = value;
    }
  },

  // Handle a change in our form's fields.
  update(event) {
    let s = this._simulator;
    if (!s) {
      return;
    }
    let form = this._form;
    let input = event.target;
    switch (input.name) {
      case "name":
        s.options.name = input.value;
        break;
      case "version":
        switch (input.value) {
          case "pick":
            let file = utils.getCustomBinary(window);
            if (file) {
              this.version = file.path;
            }
            // Whatever happens, don't stay on the "pick" option.
            this.updateVersionSelector();
            break;
          case "custom":
            this.version = input[input.selectedIndex].textContent;
            break;
          default:
            this.version = input.value;
        }
        break;
      case "profile":
        switch (input.value) {
          case "pick":
            let directory = utils.getCustomProfile(window);
            if (directory) {
              this.profile = directory.path;
            }
            // Whatever happens, don't stay on the "pick" option.
            this.updateProfileSelector();
            break;
          case "custom":
            this.profile = input[input.selectedIndex].textContent;
            break;
          default:
            this.profile = input.value;
        }
      case "device":
        this.device = this._devices[input.value];
        break;
      default:
        s.options[input.name] = input.value || null;
        this.updateDeviceSelector();
    }
  },
}

window.addEventListener("load", function onLoad() {
  document.querySelector("#close").onclick = e => {
    SimulatorEditor.clear();
    window.parent.UI.openProject();
  };
  document.querySelector("#reset").onclick = e=> {
    SimulatorEditor.reset();
  };

  let form = SimulatorEditor._form = document.querySelector("#simulator-editor");
  form.addEventListener("change", SimulatorEditor.update.bind(SimulatorEditor));

  // TODO Edit the simulator we're told to edit, not the first one in the list.
  Simulators.getAll().then(simulators => {
    SimulatorEditor.edit(simulators[0]);
  });
});
