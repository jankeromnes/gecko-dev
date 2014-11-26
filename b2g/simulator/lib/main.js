/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { Cc, Ci, Cu } = require("chrome");

const { Promise: promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
const { Simulator, SimulatorProcess } = Cu.import("resource://gre/modules/devtools/Simulator.jsm", {});
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm", {});

const ROOT_URI = require("addon").uri;
const PROFILE_URL = ROOT_URI + "profile/";
const BIN_URL = ROOT_URI + "b2g/";

let process;

function launch(params) {
  // Close already opened simulator.
  if (process) {
    return close().then(launch.bind(null, params));
  }

  params.addon = {
    id: require("addon").id,
    binURL: BIN_URL,
    profileURL: PROFILE_URL
  };

  process = new SimulatorProcess(params);
  process.run();

  return promise.resolve();
}

function close() {
  if (!process) {
    return promise.resolve();
  }
  let p = process;
  process = null;
  return p.kill();
}

let name;

AddonManager.getAddonByID(require("addon").id, function (addon) {
  name = addon.name.replace(" Simulator", "");

  Simulator.register(name, {
    // We keep the deprecated `appinfo` object so that recent simulator addons
    // remain forward-compatible with older Firefox.
    appinfo: { label: name },
    launch: launch,
    close: close
  });
});

exports.shutdown = function () {
  Simulator.unregister(name);
  close();
}

