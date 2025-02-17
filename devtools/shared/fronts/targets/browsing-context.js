/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {browsingContextTargetSpec} = require("devtools/shared/specs/targets/browsing-context");
const { FrontClassWithSpec, registerFront } = require("devtools/shared/protocol");

loader.lazyRequireGetter(this, "ThreadClient", "devtools/shared/client/thread-client");

class BrowsingContextTargetFront extends FrontClassWithSpec(browsingContextTargetSpec) {
  constructor(client, form) {
    super(client, form);

    this.thread = null;

    // Cache the value of some target properties that are being returned by `attach`
    // request and then keep them up-to-date in `reconfigure` request.
    this.configureOptions = {
      javascriptEnabled: null,
    };

    // TODO: remove once ThreadClient becomes a front
    this.client = client;

    // Save the full form for Target class usage
    // Do not use `form` name to avoid colliding with protocol.js's `form` method
    this.targetForm = form;
  }

  /**
   * Attach to a thread actor.
   *
   * @param object options
   *        Configuration options.
   *        - useSourceMaps: whether to use source maps or not.
   */
  attachThread(options = {}) {
    if (this.thread) {
      return Promise.resolve([{}, this.thread]);
    }

    const packet = {
      to: this._threadActor,
      type: "attach",
      options,
    };
    return this.client.request(packet).then(response => {
      this.thread = new ThreadClient(this, this._threadActor);
      this.client.registerClient(this.thread);
      return [response, this.thread];
    });
  }

  async attach() {
    const response = await super.attach();

    this._threadActor = response.threadActor;
    this.configureOptions.javascriptEnabled = response.javascriptEnabled;
    this.traits = response.traits || {};

    return response;
  }

  async reconfigure({ options }) {
    const response = await super.reconfigure({ options });

    if (typeof options.javascriptEnabled != "undefined") {
      this.configureOptions.javascriptEnabled = options.javascriptEnabled;
    }

    return response;
  }

  async detach() {
    let response;
    try {
      response = await super.detach();
    } catch (e) {
      console.warn(
        `Error while detaching the browsing context target front: ${e.message}`);
    }

    if (this.thread) {
      try {
        await this.thread.detach();
      } catch (e) {
        console.warn(`Error while detaching the thread front: ${e.message}`);
      }
    }

    this.destroy();

    return response;
  }
}

exports.BrowsingContextTargetFront = BrowsingContextTargetFront;
registerFront(BrowsingContextTargetFront);
