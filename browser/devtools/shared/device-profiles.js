/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci, Cc } = require("chrome");
//const { Services } = require("resource://gre/modules/Services.jsm");
//const Strings = Services.strings.createBundle("chrome://browser/locale/devtools/device.properties");

let DeviceProfiles = exports.DeviceProfiles = {};

DeviceProfiles._types = ["phones", "tablets", "televisions", "watches"];

DeviceProfiles._devices = {
  phones: [
    {
      name: "Firefox OS Flame",
      width: 320,
      height: 570,
      pixelRatio: 1.5,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Alcatel One Touch Fire, Fire C",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; ALCATELOneTouch4012X; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Alcatel Fire E",
      width: 320,
      height: 480,
      pixelRatio: 2,
      userAgent: "Mozilla/5.0 (Mobile; ALCATELOneTouch4012X; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Geeksphone Keon",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Geeksphone Peak, Revolution",
      width: 360,
      height: 640,
      pixelRatio: 1.5,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Intex Cloud Fx",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "LG Fireweb",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; LG-D300; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Spice Fire One Mi-FX1",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Symphony GoFox F15",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "Zen Fire 105",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "ZTE Open",
      width: 320,
      height: 480,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; ZTEOPEN; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "ZTE Open C",
      width: 320,
      height: 450,
      pixelRatio: 1.5,
      userAgent: "Mozilla/5.0 (Mobile; OPENC; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
  ],
  tablets: [
    {
      name: "Foxconn InFocus",
      width: 1280,
      height: 800,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
    {
      name: "VIA Vixen",
      width: 1024,
      height: 600,
      pixelRatio: 1,
      userAgent: "Mozilla/5.0 (Mobile; rv:28.0) Gecko/28.0 Firefox/28.0",
      touch: true
    },
  ],
  televisions: [
    {
      name: "720p HD Television",
      width: 1280,
      height: 720,
      pixelRatio: 1,
      userAgent: "",
      touch: false
    },
    {
      name: "1080p Full HD Television",
      width: 1920,
      height: 1080,
      pixelRatio: 1,
      userAgent: "",
      touch: false
    },
    {
      name: "4K Ultra HD Television",
      width: 3840,
      height: 2160,
      pixelRatio: 1,
      userAgent: "",
      touch: false
    },
  ],
  watches: [
    {
      name: "LG G Watch",
      width: 280,
      height: 280,
      pixelRatio: 1,
      userAgent: "",
      touch: true
    },
    {
      name: "LG G Watch R",
      width: 320,
      height: 320,
      pixelRatio: 1,
      userAgent: "",
      touch: true
    },
    {
      name: "Moto 360",
      width: 320,
      height: 290,
      pixelRatio: 1,
      userAgent: "",
      touch: true
    },
    {
      name: "Samsung Gear Live",
      width: 320,
      height: 320,
      pixelRatio: 1,
      userAgent: "",
      touch: true
    },
  ],
};

/*DeviceProfiles._strings = {};
for (let type of DeviceProfiles._types) {
  DeviceProfiles._strings[type] = Strings.GetStringFromName("device." + type);
}*/
