/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

loader.lazyImporter(this, "Devices",
  "resource://devtools/shared/apps/Devices.jsm");

const { Ci, Cu } = require("chrome");
const { createClass, createFactory, DOM: dom } =
  require("devtools/client/shared/vendor/react");
const { RuntimeScanners, SimulatorScanner, WiFiScanner, RuntimeTypes } =
  require("devtools/client/webide/modules/runtimes");
const Services = require("Services");

const PanelHeader = createFactory(require("../panel-header"));
const RuntimeList = createFactory(require("./runtime-list"));

const Strings = Services.strings.createBundle(
  "chrome://devtools/locale/aboutdebugging.properties");

module.exports = createClass({
  displayName: "RuntimesPanel",

  update() {
    /*if (WiFiScanner.allowed) {

    }
    if (Devices.helperAddonInstalled) {
    }

    RuntimeScanners.scan();*/
  },

  render() {
    let { id } = this.props;

    dump("scanners " + WiFiScanner + " " + SimulatorScanner + "\n")

    return dom.div({
      id: id + "-panel",
      className: "panel",
      role: "tabpanel",
      "aria-labelledby": id + "-header"
    },
    PanelHeader({
      id: id + "-header",
      name: Strings.GetStringFromName("runtimes")
    }),
    RuntimeList({
      name: Strings.GetStringFromName("wifiDevices"),
      runtimeScanner: WiFiScanner
    }),
    RuntimeList({
      name: Strings.GetStringFromName("simulators"),
      runtimeScanner: SimulatorScanner
    }));
  }
});
