/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const { Cc, Ci, Cu } = require("chrome");

const Environment = require("sdk/system/environment").env;
const Subprocess = require("sdk/system/child_process/subprocess");
const { EventEmitter } = Cu.import("resource://gre/modules/devtools/event-emitter.js", {});
const { Promise: promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

let platform = Services.appShell.hiddenDOMWindow.navigator.platform;
let OS = "";
if (platform.indexOf("Win") != -1) {
  OS = "win32";
} else if (platform.indexOf("Mac") != -1) {
  OS = "mac64";
} else if (platform.indexOf("Linux") != -1) {
  if (platform.indexOf("x86_64") != -1) {
    OS = "linux64";
  } else {
    OS = "linux32";
  }
}

// Log subprocess error and debug messages to the console.  This logs messages
// for all consumers of the API.  We trim the messages because they sometimes
// have trailing newlines.  And note that registerLogHandler actually registers
// an error handler, despite its name.
//Subprocess.registerLogHandler(s => console.error("subprocess: " + s.trim()));
//Subprocess.registerDebugHandler(s => console.debug("subprocess: " + s.trim()));

function SimulatorProcess() {}
SimulatorProcess.prototype = {

  // Check if B2G is running.
  get isRunning() !!this.process,

  // Start the process and connect the debugger client.
  run() {

    // Resolve B2G binary.
    let b2g = this.getB2GBinary();
    if (!b2g || !b2g.exists()) {
      throw Error("B2G executable not found.");
    }

    this.once("stdout", function () {
      if (OS == "mac64") {
        console.debug("WORKAROUND run osascript to show b2g-desktop window on OS=='mac64'");
        // Escape double quotes and escape characters for use in AppleScript.
        let path = b2g.path.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');

        Subprocess.call({
          command: "/usr/bin/osascript",
          arguments: ["-e", 'tell application "' + path + '" to activate'],
        });
      }
    });

    let environment;
    if (OS.indexOf("linux") > -1) {
      environment = ["TMPDIR=" + Services.dirsvc.get("TmpD", Ci.nsIFile).path];
      if ("DISPLAY" in Environment) {
        environment.push("DISPLAY=" + Environment.DISPLAY);
      }
    }

    // Spawn a B2G instance.
    this.process = Subprocess.call({
      command: b2g,
      arguments: this.args,
      environment: environment,
      stdout: data => this.emit("stdout", data),
      stderr: data => this.emit("stderr", data),
      // On B2G instance exit, reset tracked process, remote debugger port and
      // shuttingDown flag, then finally emit an exit event.
      done: result => {
        console.log("B2G terminated with " + result.exitCode);
        this.process = null;
        this.emit("exit", result.exitCode);
      }
    });
  },

  // Request a B2G instance kill.
  kill() {
    let deferred = promise.defer();
    if (this.process) {
      this.once("exit", (e, exitCode) => {
        this.shuttingDown = false;
        deferred.resolve(exitCode);
      });
      if (!this.shuttingDown) {
        this.shuttingDown = true;
        this.emit("kill", null);
        this.process.kill();
      }
      return deferred.promise;
    } else {
      return promise.resolve(undefined);
    }
  },

  // Compute B2G CLI arguments.
  get args() {
    let args = [];

    let gaia = this.getGaiaProfile();
    if (!gaia || !gaia.exists()) {
      throw Error("Gaia profile directory not found.");
    }
    args.push("-profile", gaia.path);

    args.push("-start-debugger-server", "" + this.options.port);

    // Ignore eventual zombie instances of b2g that are left over.
    args.push("-no-remote");

    return args;
  },
};
EventEmitter.decorate(SimulatorProcess.prototype);


function CustomSimulatorProcess(options) {
  this.options = options;
}
CustomSimulatorProcess.prototype = Object.create(SimulatorProcess.prototype);
CustomSimulatorProcess.prototype.getB2GBinary = function() {

  // Compute B2G binary file handle.
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(this.options.b2gBinary);
  return file;
}
CustomSimulatorProcess.prototype.getGaiaProfile = function() {

  // Compute Gaia profile file handle.
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(this.options.gaiaProfile);
  return file;
}
exports.CustomSimulatorProcess = CustomSimulatorProcess;


function AddonSimulatorProcess(addon, options) {
  this.addon = addon;
  this.options = options;

  //this.on("stdout", (e, data) => { console.log(data.trim()) });
  //this.on("stderr", (e, data) => { console.error(data.trim()) });
}
AddonSimulatorProcess.prototype = Object.create(SimulatorProcess.prototype);
AddonSimulatorProcess.prototype.getB2GBinary = function() {

  // Compute B2G binary file handle.
  let file;
  try {
    let pref = "extensions." + this.addon.id + ".customRuntime";
    file = Services.prefs.getComplexValue(pref, Ci.nsIFile);
  } catch(e) {}

  if (!file) {
    let binaries = {
      win32: "b2g-bin.exe",
      mac64: "B2G.app/Contents/MacOS/b2g-bin",
      linux32: "b2g-bin",
      linux64: "b2g-bin",
    };
    file = this.addon.getResourceURI().QueryInterface(Ci.nsIFileURL).file;
    file.append("b2g");
    file.append(binaries[OS]);
  }

  return file;
};
AddonSimulatorProcess.prototype.getGaiaProfile = function() {

  // Compute Gaia profile file handle.
  let file;
  try {
    let pref = "extensions." + this.addon.id + ".gaiaProfile";
    file = Services.prefs.getComplexValue(pref, Ci.nsIFile);
  } catch(e) {}

  if (!file) {
    file = this.addon.getResourceURI().QueryInterface(Ci.nsIFileURL).file;
    file.append("profile");
  }
  return file;
};
exports.AddonSimulatorProcess = AddonSimulatorProcess;


function OldAddonSimulatorProcess(addon, options) {
  this.addon = addon;
  this.options = options;

  //this.on("stdout", (e, data) => { console.log(data.trim()) });
  //this.on("stderr", (e, data) => { console.error(data.trim()) });
}
OldAddonSimulatorProcess.prototype = Object.create(AddonSimulatorProcess.prototype);
OldAddonSimulatorProcess.prototype.getB2GBinary = function() {

  // Compute B2G binary file handle.
  let file;
  try {
    let pref = "extensions." + this.addon.id + ".customRuntime";
    file = Services.prefs.getComplexValue(pref, Ci.nsIFile);
  } catch(e) {}

  if (!file) {
    let version = this.addon.name.match(/\d+\.\d+/)[0].replace(/\./, "_");
    file = this.addon.getResourceURI().QueryInterface(Ci.nsIFileURL).file;
    file.append("resources");
    file.append("fxos_" + version + "_simulator");
    file.append("data");
    file.append(OS == "linux32" ? "linux" : OS);
    if (OS == "mac64") {
      file.append("B2G.app");
      file.append("Contents");
      file.append("MacOS");
    } else {
      file.append("b2g");
    }
    file.append("b2g-bin" + (OS == "win32" ? ".exe" : ""));
  }
  return file;
};
Object.defineProperty(OldAddonSimulatorProcess.prototype, "args", {

  // Compute B2G CLI arguments.
  get: function() {
    let args = [];

    let gaia = this.getGaiaProfile();
    if (!gaia || !gaia.exists()) {
      throw Error("Gaia profile directory not found.");
    }
    args.push("-profile", gaia.path);

    args.push("-dbgport", "" + this.options.port);

    // Ignore eventual zombie instances of b2g that are left over.
    args.push("-no-remote");

    return args;
  }
});
exports.OldAddonSimulatorProcess = OldAddonSimulatorProcess;
