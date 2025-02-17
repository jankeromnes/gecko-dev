/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
/* import-globals-from ../../../shared/test/shared-head.js */

"use strict";

/**
 * Temporarily flip all the preferences necessary for service worker testing.
 */
async function enableServiceWorkerDebugging() {
  // Enable service workers.
  await pushPref("dom.serviceWorkers.enabled", true);

  // Accept workers from mochitest's http (normally only available in https).
  await pushPref("dom.serviceWorkers.testing.enabled", true);

  // Force single content process. Necessary until sw e10s refactor is done (Bug 1231208).
  await pushPref("dom.ipc.processCount", 1);
  Services.ppmm.releaseCachedProcesses();
}

/**
 * Helper to listen once on a message sent using postMessage from the provided tab.
 *
 * @param {Tab} tab
 *        The tab on which the message will be received.
 * @param {String} message
 *        The name of the expected message.
 */
function onTabMessage(tab, message) {
  const mm = tab.linkedBrowser.messageManager;
  return new Promise(resolve => {
    mm.addMessageListener(message, function listener() {
      mm.removeMessageListener(message, listener);
      resolve();
    });
  });
}

/**
 * Helper to listen once on a message sent using postMessage from the provided tab.
 *
 * @param {Tab} tab
 *        The tab on which the message will be received.
 * @param {String} message
 *        The name of the expected message.
 */
function forwardServiceWorkerMessage(tab) {
  info("Make the test page notify us when the service worker sends a message.");
  return ContentTask.spawn(tab.linkedBrowser, {}, function() {
    const win = content.wrappedJSObject;
    win.navigator.serviceWorker.addEventListener("message", function(event) {
      sendAsyncMessage(event.data);
    });
  });
}

/**
 * Unregister the service worker from the content page
 *
 * @param {Tab} tab
 *        The tab on which the service worker should be removed.
 * @param {String} reference
 *        The reference to the service worker registration promise created on the content
 *        window.
 */
async function unregisterServiceWorker(tab, reference) {
  await ContentTask.spawn(tab.linkedBrowser, reference, async function(_reference) {
    // Retrieve the registration promise created in the html page
    const registration = await content.wrappedJSObject[_reference];
    await registration.unregister();
  });
}
