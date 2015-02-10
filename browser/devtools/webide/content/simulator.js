/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
const {Services} = Cu.import("resource://gre/modules/Services.jsm");
const {require} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
const {GetAvailableAddons} = require("devtools/webide/addons");
const Strings = Services.strings.createBundle("chrome://browser/locale/devtools/webide.properties");

window.addEventListener("load", function onLoad() {
  document.querySelector("#close").onclick = e => {
    window.parent.UI.openProject();
  };

  let form = document.querySelector("#options");

  form.useCustomB2G.addEventListener("change", e => {
    document.querySelector("#runtime").classList.toggle("custom", form.useCustomB2G.checked);
  });

  form.useCustomGaia.addEventListener("change", e => {
    document.querySelector("#runtime-gaia").classList.toggle("custom", form.useCustomGaia.checked);
  });

  form.addon.addEventListener("change", e => {
    form.name.setAttribute("placeholder", form.addon[form.addon.selectedIndex].dataset.name);
  });

  GetAvailableAddons().then(addons => {
    form.addon.innerHTML = "";
    for (let simulator of addons.simulators) {
      let option = document.createElement("option");
      option.value = simulator.version;
      let stability = Strings.GetStringFromName("addons_" + simulator.stability);
      option.textContent = Strings.formatStringFromName("addons_simulator_label", [simulator.version, stability], 2);
      option.dataset.name = Strings.formatStringFromName("addons_simulator_shortlabel", [simulator.version], 1);
      form.addon.appendChild(option);
    }
    form.addon.dispatchEvent(new Event("change"));
  }, (e) => {
    // Oops.
  });

  form.addEventListener("submit", e => {
    // TODO.
  });
});
