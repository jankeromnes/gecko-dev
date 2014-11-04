/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cc,Ci,Cu,Cr} = require("chrome");
const {DeviceProfiles} = Cu.import("resource:///modules/devtools/DeviceProfiles.jsm", {});

/**
 * The current target and the timeline front, set by this tool's host.
 */
let gToolbox, gTarget;
