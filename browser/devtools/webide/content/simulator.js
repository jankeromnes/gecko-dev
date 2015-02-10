/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
const { EventEmitter } = Cu.import("resource://gre/modules/devtools/event-emitter.js");
const { require } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const { Simulators, Simulator } = require("devtools/webide/simulators");
const promise = require("promise");
const utils = require("devtools/webide/utils");

const Strings = Services.strings.createBundle("chrome://browser/locale/devtools/webide.properties");

let SimulatorEditor = {
  _addons: {},
  _form: null,
  _simulator: null,

  // Generate the dynamic form elements.
  init() {
    let deferred = promise.defer();

    // Append a new <option> to a <select> element.
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
    form.device.classList.add("custom");
    opt(form.device, "custom", Strings.GetStringFromName("simulator_custom_device"));

    return deferred.promise;
  },

  // Edit the configuration of an existing Simulator, or create a new one.
  edit(simulator) {
    if (simulator && simulator === this._simulator) {
      return promise.resolve();
    }

    let deferred = promise.defer();

    // If no Simulator was given to edit, we're creating a new one.
    simulator = simulator || new Simulator(null);

    this.clear();
    this.init().then(() => {

      this._simulator = simulator;

      // Update the form fields.
      let form = this._form;
      form.name.value = simulator.name;

      if (simulator.addon) {
        form.version.value = simulator.addon.id;
      } else {
        form.classList.add("custom");
        form.version.value = "custom";
        form.version[form.version.selectedIndex].textContent = simulator.options.b2gBinary;
      }

      if (simulator.options.gaiaProfile) {
        form.profile.classList.add("custom");
        form.profile.value = "custom";
        form.profile[form.profile.selectedIndex].textContent = simulator.options.gaiaProfile;
      } else {
        form.profile.value = "default";
      }

      form.device.value = "custom";
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

  clear() {
    this._simulator = null;
  },

  // Handle a change in our form's fields.
  update(event) {
    let s = this._simulator;
    if (!s) {
      return;
    }
    let input = event.target;
    switch (input.name) {
      case "version":
        switch (input.value) {
          case "pick":
            let file = utils.getCustomBinary(window);
            if (!file) {
              // Abort, revert to initial state.
              input.value = s.addon ? s.addon.id : "custom";
              return false;
            }
            input.classList.add("custom");
            input.value = "custom";
            input[input.selectedIndex].textContent = file.path;
            // fall through:
          case "custom":
            s.addon = null;
            s.options.b2gBinary = input[input.selectedIndex].textContent;
            break;
          default:
            s.addon = this._addons[input.value];
            s.options.b2gBinary = null;
        }
        break;
      case "profile":
        switch (input.value) {
          case "pick":
            let directory = utils.getCustomProfile(window);
            if (!directory) {
              // Abort, revert to initial state.
              input.value = s.options.gaiaProfile ? "custom" : "default";
              return false;
            }
            input.classList.add("custom");
            input.value = "custom";
            input[input.selectedIndex].textContent = directory.path;
            // fall through:
          case "custom":
            s.options.gaiaProfile = input[input.selectedIndex].textContent;
            break;
          default:
            s.options.gaiaProfile = null;
        }
      case "device":
        if (input.value !== "custom") {
          // TODO set height & width
        }
        break;
      default:
        // TODO form.device.value = "custom"
        s.options[input.name] = input.value || null;
    }
  },
}

window.addEventListener("load", function onLoad() {
  document.querySelector("#close").onclick = e => {
    clear();
    window.parent.UI.openProject();
  };

  let form = SimulatorEditor._form = document.querySelector("#simulator-editor");
  form.addEventListener("change", SimulatorEditor.update.bind(SimulatorEditor));

  // FIXME
  Simulators.getAll().then(simulators => {
    SimulatorEditor.edit(simulators[0]);
  });
});
