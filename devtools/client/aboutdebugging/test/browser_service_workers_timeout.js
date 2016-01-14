/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

// Service workers can't be loaded from chrome://,
// but http:// is ok with dom.serviceWorkers.testing.enabled turned on.
const HTTP_ROOT = CHROME_ROOT.replace("chrome://mochitests/content/",
                                      "http://mochi.test:8888/");
const SERVICE_WORKER = HTTP_ROOT + "service-workers/empty-sw.js";
const TAB_URL = HTTP_ROOT + "service-workers/empty-sw.html";

const SW_TIMEOUT = 1000;

function waitForDOMMutation(element) {
  return new Promise(done => {
    var observer = new MutationObserver(function(mutations) {
      observer.disconnect();
      done();
    });
    observer.observe(element, { childList: true });
  });
}

function assertHasRegistration(expected, document, name) {
  let names = [...document.querySelectorAll("#service-workers .target-name")];
  names = names.map(element => element.textContent);
  is(names.includes(name), expected, "The service worker registration url appears in the list: " + names);
}

add_task(function *() {
  yield new Promise(done => {
    let options = {"set": [
                    // Accept workers from mochitest's http
                    ["dom.serviceWorkers.testing.enabled", true],
                    // Reduce the timeout to expose issues when service worker
                    // freezing is broken
                    ["dom.serviceWorkers.idle_timeout", SW_TIMEOUT],
                    ["dom.serviceWorkers.idle_extended_timeout", SW_TIMEOUT],
                  ]};
    SpecialPowers.pushPrefEnv(options, done);
  });

  let { tab, document } = yield openAboutDebugging("workers");

  let swTab = yield addTab(TAB_URL);

  yield waitForDOMMutation(document.querySelector("#service-workers"));

  assertHasRegistration(true, document, SERVICE_WORKER);

  // Ensure that the registration resolved before trying to connect to the sw
  let frameScript = function () {
    // Retrieve the `sw` promise created in the html page
    let { sw } = content.wrappedJSObject;
    sw.then(function (registration) {
      sendAsyncMessage("sw-registered");
    });
  };
  let mm = swTab.linkedBrowser.messageManager;
  mm.loadFrameScript("data:,(" + encodeURIComponent(frameScript) + ")()", true);

  yield new Promise(done => {
    mm.addMessageListener("sw-registered", function listener() {
      mm.removeMessageListener("sw-registered", listener);
      done();
    });
  });
  ok(true, "Service worker registration resolved");

  // Retrieve the DEBUG button for the worker
  let names = [...document.querySelectorAll("#service-workers .target-name")];
  let name = names.filter(element => element.textContent === SERVICE_WORKER)[0];
  ok(name, "Found the service worker in the list");
  let debugBtn = name.parentNode.parentNode.querySelector(".target-button-debug");
  ok(debugBtn, "Found its debug button");
  let workerBtns = debugBtn.parentNode;

  // Click on it and wait for the toolbox to be ready
  let onToolboxReady = new Promise(done => {
    gDevTools.once("toolbox-ready", function (e, toolbox) {
      done(toolbox);
    });
  });
  debugBtn.click();

  let toolbox = yield onToolboxReady;

  // Wait for more than the regular timeout,
  // so that if the worker freezing doesn't work,
  // it will be destroyed and removed from the list
  yield new Promise(done => {
    setTimeout(done, SW_TIMEOUT * 2);
  });

  assertHasRegistration(true, document, SERVICE_WORKER);
  ok(workerBtns.querySelector(".target-button-debug"), "Still has a debug button");

  yield toolbox.destroy();
  toolbox = null;

  // Now ensure that the worker is correctly destroyed
  // after we destroy the toolbox.
  yield waitForDOMMutation(workerBtns);

  ok(!workerBtns.querySelector(".target-button-debug"), "Debug button successfully removed after worker was killed");

  // Finally, unregister the service worker itself
  // Use message manager to work with e10s
  frameScript = function () {
    // Retrieve the `sw` promise created in the html page
    let { sw } = content.wrappedJSObject;
    sw.then(function (registration) {
      registration.unregister().then(function (success) {
        sendAsyncMessage("sw-unregistered");
      },
      function (e) {
        dump("SW not unregistered; " + e + "\n");
      });
    });
  };
  mm = swTab.linkedBrowser.messageManager;
  mm.loadFrameScript("data:,(" + encodeURIComponent(frameScript) + ")()", true);

  yield new Promise(done => {
    mm.addMessageListener("sw-unregistered", function listener() {
      mm.removeMessageListener("sw-unregistered", listener);
      done();
    });
  });
  ok(true, "Service worker registration unregistered");

  // Now ensure that the worker registration is correctly removed.
  // The list should update once the registration is destroyed.
  yield waitForDOMMutation(document.querySelector("#service-workers"));

  assertHasRegistration(false, document, SERVICE_WORKER);

  yield removeTab(swTab);
  yield closeAboutDebugging(tab);
});
