/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
const { EventEmitter } = Cu.import("resource://gre/modules/devtools/event-emitter.js", {});
const { Promise: promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
const { require } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
const Environment = require("sdk/system/environment").env;
const Runtime = require("sdk/system/runtime");
const Subprocess = require("sdk/system/child_process/subprocess");
const URL = require("sdk/url");

const EXPORTED_SYMBOLS = ["Simulator", "SimulatorProcess"];

const Simulator = {
  _simulators: {},

  register: function (name, simulator) {
    // simulators register themselves as "Firefox OS X.Y"
    this._simulators[name] = simulator;
    this.emit("register", name);
  },

  unregister: function (name) {
    delete this._simulators[name];
    this.emit("unregister", name);
  },

  availableNames: function () {
    return Object.keys(this._simulators).sort();
  },

  getByName: function (name) {
    return this._simulators[name];
  },
};

EventEmitter.decorate(Simulator);


// Log subprocess error and debug messages to the console.  This logs messages
// for all consumers of the API.  We trim the messages because they sometimes
// have trailing newlines.  And note that registerLogHandler actually registers
// an error handler, despite its name.
Subprocess.registerLogHandler(s => { dump("subprocess error: " + s.trim() + "\n") });
Subprocess.registerDebugHandler(s => { dump("subprocess error: " + s.trim() + "\n") });

function SimulatorProcess(params) {
  EventEmitter.decorate(this);
  this.params = params;
  this.on("stdout", data => { dump(data.trim() + "\n") });
  this.on("stderr", data => { dump(data.trim() + "\n") });
}

SimulatorProcess.prototype = {

  // check if b2g is running
  get isRunning() !!this.process,

  /**
   * Start the process and connect the debugger client.
   */
  run: function() {
    // kill before start if already running
    if (this.process != null) {
      this.process.kill().then(this.run.bind(this));
      return;
    }

    // resolve b2g binaries path (raise exception if not found)
    let b2gExecutable = this.b2gExecutable;

    this.once("stdout", function () {
      if (Runtime.OS == "Darwin") {
          dump("WORKAROUND run osascript to show b2g-desktop window"+
                        " on Runtime.OS=='Darwin'\n");
        // Escape double quotes and escape characters for use in AppleScript.
        let path = b2gExecutable.path
          .replace(/\\/g, "\\\\").replace(/\"/g, '\\"');

        Subprocess.call({
          command: "/usr/bin/osascript",
          arguments: ["-e", 'tell application "' + path + '" to activate'],
        });
      }
    });

    let environment;
    if (Runtime.OS == "Linux") {
      environment = ["TMPDIR=" + Services.dirsvc.get("TmpD", Ci.nsIFile).path];
      if ("DISPLAY" in Environment) {
        environment.push("DISPLAY=" + Environment.DISPLAY);
      }
    }

    // spawn a b2g instance
    this.process = Subprocess.call({
      command: b2gExecutable,
      arguments: this.b2gArguments,
      environment: environment,

      // emit stdout event
      stdout: data => {
        this.emit("stdout", data);
      },

      // emit stderr event
      stderr: data => {
        this.emit("stderr", data);
      },

      // on b2g instance exit, reset tracked process, remote debugger port and
      // shuttingDown flag, then finally emit an exit event
      done: result => {
        dump(this.b2gFilename + " terminated with " + result.exitCode + "\n");
        this.process = null;
        this.emit("exit", result.exitCode);
      },
    });
  },

  // request a b2g instance kill
  kill: function() {
    let deferred = promise.defer();
    if (this.process) {
      this.once("exit", exitCode => {
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

  // compute current b2g filename
  get b2gFilename() {
    return this._executable ? this._executableFilename : "B2G";
  },

  // compute current b2g file handle
  get b2gExecutable() {
    if (this._executable) {
      return this._executable;
    }

    let path = this.params.b2gBinary;

    if (!path) {
      // Simulator addon.
      let id = this.params.addon.id;

      let customRuntime;
      try {
        let pref = "extensions." + id + ".customRuntime";
        customRuntime = Services.prefs.getComplexValue(pref, Ci.nsIFile);
      } catch(e) {}

      if (customRuntime) {
        this._executable = customRuntime;
        this._executableFilename = "Custom runtime";
        return this._executable;
      }

      path = URL.toFilename(this.params.addon.binURL);
      let executables = {
        WINNT: "b2g-bin.exe",
        Darwin: "B2G.app/Contents/MacOS/b2g-bin",
        Linux: "b2g-bin",
      };

      path += Runtime.OS == "WINNT" ? "\\" : "/";
      path += executables[Runtime.OS];
    }

    dump("simulator path: " + path + "\n");

    let executable = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    executable.initWithPath(path);

    if (!executable.exists()) {
      // B2G binary not found!
      throw Error("b2g-desktop Executable not found.");
    }

    this._executable = executable;
    this._executableFilename = "b2g-bin";

    return executable;
  },

  // compute b2g CLI arguments
  get b2gArguments() {
    let args = [];

    let profile = this.params.gaiaProfile;

    if (!profile) {
      // Simulator addon.
      let id = this.params.addon.id;

      let gaiaProfile;
      try {
        let pref = "extensions." + id + ".gaiaProfile";
        gaiaProfile = Services.prefs.getComplexValue(pref, Ci.nsIFile).path;
      } catch(e) {}
      profile = gaiaProfile || URL.toFilename(this.params.addon.profileURL);
    }

    args.push("-profile", profile);
    dump("profile: " + profile + "\n");

    // NOTE: push dbgport option on the b2g-desktop commandline
    args.push("-start-debugger-server", "" + this.params.port);

    // Ignore eventual zombie instances of b2g that are left over
    args.push("-no-remote");

    return args;
  },
};

