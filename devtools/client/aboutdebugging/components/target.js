/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global alert, BrowserToolboxProcess, gDevTools, React, TargetFactory,
   Toolbox */

"use strict";

loader.lazyRequireGetter(this, "React",
  "devtools/client/shared/vendor/react");
loader.lazyRequireGetter(this, "TargetFactory",
  "devtools/client/framework/target", true);
loader.lazyRequireGetter(this, "Toolbox",
  "devtools/client/framework/toolbox", true);
loader.lazyRequireGetter(this, "Services");

loader.lazyImporter(this, "BrowserToolboxProcess",
  "resource://devtools/client/framework/ToolboxProcess.jsm");
loader.lazyImporter(this, "gDevTools",
  "resource://devtools/client/framework/gDevTools.jsm");

const Strings = Services.strings.createBundle(
  "chrome://devtools/locale/aboutdebugging.properties");

exports.TargetComponent = React.createClass({
  displayName: "TargetComponent",

  render() {
    let target = this.props.target;
    let isServiceWorker = (target.type === "serviceworker");
    let isRunning = (!isServiceWorker || target.workerActor);
    return React.createElement("div", { className: "target" },
      React.createElement("img", {
        className: "target-icon",
        src: target.icon }),
      React.createElement("div", { className: "target-details" },
        React.createElement("div", { className: "target-name" }, target.name)
      ),
      (isRunning ?
        React.createElement("button",
          { className: "target-button-debug", onClick: this.debug },
          Strings.GetStringFromName("debug")) :
        null
      )
    );
  },

  debug() {
    let client = this.props.client;
    let target = this.props.target;
    switch (target.type) {
      case "extension":
        BrowserToolboxProcess.init({ addonID: target.addonID });
        break;
      case "serviceworker":
        if (target.workerActor) {
          this.openWorkerToolbox(target.workerActor);
        }
        break;
      case "sharedworker":
        this.openWorkerToolbox(target.workerActor);
        break;
      case "worker":
        this.openWorkerToolbox(target.workerActor);
        break;
      default:
        alert("Not implemented yet!");
        break;
    }
  },

  openWorkerToolbox(workerActor) {
    let client = this.props.client;
    client.attachWorker(workerActor, (response, workerClient) => {
      gDevTools.showToolbox(TargetFactory.forWorker(workerClient),
        "jsdebugger", Toolbox.HostType.WINDOW)
        .then(toolbox => {
          toolbox.once("destroy", () => workerClient.detach());
        });
    });
  },
});
