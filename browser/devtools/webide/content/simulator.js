/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
const {Services} = Cu.import("resource://gre/modules/Services.jsm");
const {require} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
const {GetAvailableAddons} = require("devtools/webide/addons");
const {DeviceProfiles} = Cu.import("resource:///modules/devtools/DeviceProfiles.jsm", {})
const Strings = Services.strings.createBundle("chrome://browser/locale/devtools/webide.properties");

window.addEventListener("load", function onLoad() {
  document.querySelector("#close").onclick = e => {
    window.parent.UI.openProject();
  };

  let form = document.querySelector("#options");

  form.useCustomRuntime.addEventListener("change", e => {
    document.querySelector("#runtime").classList.toggle("custom", form.useCustomRuntime.checked);
  });

  form.addon.addEventListener("change", e => {
    form.name.setAttribute("placeholder", form.addon[form.addon.selectedIndex].dataset.name);
  });

  GetAvailableAddons().then(addons => {
    for (let simulator of addons.simulators) {
      let option = document.createElement("option");
      option.value = simulator.version;
      let stability = Strings.GetStringFromName("addons_" + simulator.stability);
      option.textContent = Strings.formatStringFromName("addons_simulator_label", [simulator.version, stability], 2);
      option.dataset.name = Strings.formatStringFromName("addons_simulator_shortlabel", [simulator.version], 1);
      form.addon.appendChild(option);
    }
    form.selectedIndex = form.addon.options.length - 1;
    form.addon.dispatchEvent(new Event("change"));
  }, (e) => {
    // Oops.
  });

  form.device.addEventListener("change", e => {
    let id = form.device.value.split("-");
    let device = DeviceProfiles._devices[id[0]][parseInt(id[1])];
    form.width.value = device.width;
    form.height.value = device.height;
  });

  DeviceProfiles._types.forEach(group => {
    let optgroup = document.createElement("optgroup");
    optgroup.setAttribute("label", DeviceProfiles._strings[group]);
    DeviceProfiles._devices[group].forEach((device, i) => {
      let option = document.createElement("option");
      option.value = group + "-" + i;
      option.textContent = device.name;
      optgroup.appendChild(option);
    });
    form.device.appendChild(optgroup);
  });
  form.device.dispatchEvent(new Event("change"));

  form.addEventListener("submit", e => {
    let runtime = {
      version: form.addon.value,
      name: form.name.value || form.name.getAttribute("placeholder"),
      device: {
        width: form.width.value,
        height: form.height.value,
      },
    };

    if (form.useCustomRuntime.checked) {
      // Custom B2G + Gaia path.
      runtime.version = null;
      runtime.b2g = form.b2g.value;
      runtime.gaia = form.gaia.value;
    }

    if (!runtime.name) {
      // TODO complain loudly.
      return false;
    }

    // TODO cause the addition / update of a SimulatorRuntime.
    return false;
  });
});
