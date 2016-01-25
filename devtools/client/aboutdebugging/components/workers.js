/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global React, TargetListComponent */

"use strict";

loader.lazyRequireGetter(this, "Ci",
  "chrome", true);
loader.lazyRequireGetter(this, "React",
  "devtools/client/shared/vendor/react");
loader.lazyRequireGetter(this, "TargetListComponent",
  "devtools/client/aboutdebugging/components/target-list", true);
loader.lazyRequireGetter(this, "Services");

loader.lazyImporter(this, "Task", "resource://gre/modules/Task.jsm");

const Strings = Services.strings.createBundle(
  "chrome://devtools/locale/aboutdebugging.properties");
const WorkerIcon = "chrome://devtools/skin/images/debugging-workers.svg";

exports.WorkersComponent = React.createClass({
  displayName: "WorkersComponent",

  getInitialState() {
    return {
      workers: {
        service: [],
        shared: [],
        other: []
      }
    };
  },

  componentDidMount() {
    let client = this.props.client;
    client.addListener("workerListChanged", this.update);
    client.addListener("serviceWorkerRegistrationListChanged", this.update);
    client.addListener("processListChanged", this.update);
    this.update();
  },

  componentWillUnmount() {
    let client = this.props.client;
    client.removeListener("processListChanged", this.update);
    client.removeListener("serviceWorkerRegistrationListChanged", this.update);
    client.removeListener("workerListChanged", this.update);
  },

  render() {
    let client = this.props.client;
    let workers = this.state.workers;
    return React.createElement("div", { className: "inverted-icons" },
      React.createElement(TargetListComponent, {
        id: "service-workers",
        name: Strings.GetStringFromName("serviceWorkers"),
        targets: workers.service, client }),
      React.createElement(TargetListComponent, {
        id: "shared-workers",
        name: Strings.GetStringFromName("sharedWorkers"),
        targets: workers.shared, client }),
      React.createElement(TargetListComponent, {
        id: "other-workers",
        name: Strings.GetStringFromName("otherWorkers"),
        targets: workers.other, client })
    );
  },

  update() {
    dump("WORKER UPDATE!\n");
    let workers = this.getInitialState().workers;

    this.getWorkerForms().then(forms => {

      forms.registrations.forEach(form => {
        dump("REGISTRATION: " + form.scope + "\n");
        workers.service.push({
          type: "serviceworker",
          icon: WorkerIcon,
          name: form.url,
          url: form.url,
          scope: form.scope,
          registrationActor: form.actor
        });
      });

      forms.workers.forEach(form => {
        //dump("WORKER: " + form.url + "\n");
        let worker = {
          type: "worker",
          icon: WorkerIcon,
          name: form.url,
          url: form.url,
          workerActor: form.actor
        };
        switch (form.type) {
          case Ci.nsIWorkerDebugger.TYPE_SERVICE:
            for (let registration of workers.service) {
              if (registration.scope === form.scope) {
                // XXX: Race, sometimes a ServiceWorkerRegistrationInfo doesn't
                // have a scriptSpec, but its associated WorkerDebugger does.
                if (!registration.url) {
                  registration.name = registration.url = form.url;
                }
                registration.workerActor = form.actor;
                break;
              }
            }
            break;
          case Ci.nsIWorkerDebugger.TYPE_SHARED:
            worker.type = "sharedworker";
            workers.shared.push(worker);
            break;
          default:
            workers.other.push(worker);
        }
      });

      // XXX: Filter out the service worker registrations for which we couldn't
      // find the scriptSpec.
      workers.service = workers.service.filter(reg => !!reg.url);

      this.setState({ workers });
    });
  },

  getWorkerForms: Task.async(function*() {
    let client = this.props.client;
    let registrations = [];
    let workers = [];

    try {
      // List service worker registrations
      ({ registrations } =
        yield client.mainRoot.listServiceWorkerRegistrations());

      // List workers from the Parent process
      ({ workers } = yield client.mainRoot.listWorkers());

      // And then from the Child processes
      let { processes } = yield client.mainRoot.listProcesses();
      for (let process of processes) {
        // Ignore parent process
        if (process.parent) {
          continue;
        }
        let { form } = yield client.getProcess(process.id);
        let processActor = form.actor;
        let response = yield client.request({
          to: processActor,
          type: "listWorkers"
        });
        workers = workers.concat(response.workers);
      }
    } catch (e) {
      // Something went wrong, maybe our client is disconnected?
    }

    return { registrations, workers };
  }),
});
