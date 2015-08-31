/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/ToolboxProcess.jsm");
let { loader, require } = Cu.import("resource://gre/modules/devtools/Loader.jsm");


const { RuntimeScanners, RuntimeTypes } = require("devtools/webide/runtimes");
const { TargetFactory } = require("devtools/framework/target");
const { WorkerActorList } = require("devtools/server/actors/worker");

const bundle = Services.strings.createBundle(
  "chrome://global/locale/aboutdebug.properties");
const LocaleCompare = (a, b) => {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
};

var RuntimeList = React.createClass({
  displayName: "RuntimeList",
  getInitialState: function() {
    return { runtimes: [] };
  },
  render: function() {
    var createRuntime = function(runtime) {
      return React.createElement(Runtime, { runtime: runtime });
    }
    return (
      React.createElement("div", null,
        React.createElement("h2", null, this.props.name), 
        this.state.runtimes.sort(LocaleCompare).map(createRuntime)
      )
    );
  }
});

var Runtime = React.createClass({
  displayName: "Runtime",
  connect: function() {
    let runtime = this.props.runtime;
    runtime.connect();
  },
  render: function() {
    return (
      React.createElement("div", { className: "runtime" },
        React.createElement("img", { className: "runtime-logo", src: "chrome://browser/skin/preferences/in-content/icons.svg#applications-native" }),
        React.createElement("h3", { className: "runtime-name" }, this.props.runtime.name),
        React.createElement("button", { onClick: this.connect }, "Connect")
      )
    );
  }
});

var TargetList = React.createClass({
  displayName: "TargetList",
  getInitialState: function() {
    return { targets: [] };
  },
  render: function() {
    var createTarget = function(target) {
      return React.createElement(Target, { target: target });
    }
    return (
      React.createElement("div", null,
        React.createElement("h4", null, this.props.name), 
        this.state.targets.sort(LocaleCompare).map(createTarget)
      )
    );
  }
});

var Target = React.createClass({
  displayName: "Target",
  debug: function() {
    let target = this.props.target;
    switch (target.type) {
      case "extension":
        BrowserToolboxProcess.init({ addonID: target.id });
        // Only one because one profile: ToolboxProcess.jsm debuggingProfileDir "ProfLD"
        break;
      default:
        alert("Not implemented yet!");
    }
  },
  render: function() {
    return (
      React.createElement("div", { className: "target" },
        React.createElement("img", { className: "target-logo", src: this.props.target.icon }),
        React.createElement("div", { className: "target-details" },
          React.createElement("div", { className: "target-name" }, this.props.target.name),
          React.createElement("div", { className: "target-url" }, this.props.target.url)
        ),
        React.createElement("button", { onClick: this.debug }, "Debug")
      )
    );
  }
});

let categories = [];

function show(category) {
  if (categories.length < 1) {
    // If needed, initialize the list of available categories.
    categories = [].map.call(document.querySelectorAll(".category"), el => {
      let value = el.getAttribute("value");
      el.addEventListener("click", show.bind(null, value));
      return value;
    });
  }
  if (!category) {
    // If no category was specified, use the URL hash.
    category = location.hash.substr(1);
  }
  if (categories.indexOf(category) < 0) {
    // If no valid category was found, use the first available.
    category = categories[0];
  }
  document.querySelector(".tab.active").classList.remove("active");
  document.querySelector("#tab-" + category).classList.add("active");
  document.querySelector(".category[selected]").removeAttribute("selected");
  document.querySelector(".category[value=" + category + "]").setAttribute("selected", "true");
  location.hash = "#" + category;
}

function init() {
  show();

  // RUNTIMES

  let runtimeList = {
    usb: React.render(React.createElement(RuntimeList, { name: "USB Devices" }), document.querySelector("#usb")),
    wifi: React.render(React.createElement(RuntimeList, { name: "Wi-Fi Devices" }), document.querySelector("#wifi")),
    simulators: React.render(React.createElement(RuntimeList, { name: "Simulators" }), document.querySelector("#simulators"))
  }

  RuntimeScanners.on("runtime-list-updated", function() {
    let list = RuntimeScanners.listRuntimes();
    let runtimes = { usb: [], wifi: [], simulators: [] };
    for (let runtime of list) {
      switch (runtime.type) {
        case RuntimeTypes.USB:
          runtimes.usb.push(runtime);
          break;
        case RuntimeTypes.WIFI:
          runtimes.wifi.push(runtime);
          break;
        case RuntimeTypes.SIMULATOR:
          runtimes.simulators.push(runtime);
          break;
      }
    }
    runtimeList.usb.setState({ runtimes: runtimes.usb });
    runtimeList.wifi.setState({ runtimes: runtimes.wifi });
    runtimeList.simulators.setState({ runtimes: runtimes.simulators });
  });
  RuntimeScanners.enable();
  RuntimeScanners.scan();

  // ADDONS

  let extensionsList = React.render(React.createElement(TargetList, { name: "Extensions" }), document.querySelector("#extensions"));

  AddonManager.getAllAddons(function (addons) {
    let targets = addons.filter(addon => addon.isDebuggable).map(addon => {
      return {
        id: addon.id,
        name: addon.name,
        icon: addon.iconURL || "chrome://mozapps/skin/extensions/extensionGeneric.png",
        type: addon.type
      }
    });
    console.log('addons', targets);
    extensionsList.setState({ targets: targets });
  });

  // WORKERS

  let serviceWorkersList = React.render(React.createElement(TargetList, { name: "Service Workers" }), document.querySelector("#serviceworkers"));
  let sharedWorkersList = React.render(React.createElement(TargetList, { name: "Shared Workers" }), document.querySelector("#sharedworkers"));
  let otherWorkersList = React.render(React.createElement(TargetList, { name: "Other Workers" }), document.querySelector("#otherworkers"));

  let serviceworkers = [];
  let sharedworkers = [];
  let otherworkers = [];

  let wdm = Cc["@mozilla.org/dom/workers/workerdebuggermanager;1"].getService(Ci.nsIWorkerDebuggerManager);
  let e = wdm.getWorkerDebuggerEnumerator();
  while (e.hasMoreElements()) {
    let dbg = e.getNext().QueryInterface(Ci.nsIWorkerDebugger);
    // puts 1 threadactor into the worker
    let worker = {
      id: dbg.url,
      name: dbg.url
    };
    switch (dbg.type) {
      case dbg.TYPE_SHARED:
        console.log("shared worker", dbg);
        worker.type = "sharedworker";
        sharedworkers.push(worker);
        break;
      case dbg.TYPE_SERVICE:
        console.log("service worker", dbg);
        worker.type = "serviceworker";
        serviceworkers.push(worker);
        break;
      default:
        console.log("other worker", dbg);
        worker.type = "worker";
        otherworkers.push(worker);
    }
  }
  serviceWorkersList.setState({ targets: serviceworkers });
  sharedWorkersList.setState({ targets: sharedworkers });
  otherWorkersList.setState({ targets: otherworkers });

  let gSWM = Cc["@mozilla.org/serviceworkers/manager;1"].getService(Ci.nsIServiceWorkerManager);
  let data = gSWM.getAllRegistrations();
  for (let i = 0; i < data.length; i++) {
    let info = data.queryElementAt(i, Ci.nsIServiceWorkerInfo);
    console.log('serviceworker', info);
    serviceworkers.push({
      name: info.currentWorkerURL,
      type: "serviceworker"
    });
  }
  serviceWorkersList.setState({ targets: serviceworkers });

  // TABS

  let windows = [];
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let en = wm.getEnumerator(null);
  while (en.hasMoreElements()) {
    windows.push(en.getNext());
  }

  console.log('windows', windows);

  /*let targets = TargetFactory.allTargets();
  console.log('targets', targets);*/
}

window.addEventListener("DOMContentLoaded", function load() {
  window.removeEventListener("DOMContentLoaded", load);
  init();
});
