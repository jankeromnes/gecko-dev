/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');

function FakeGeoPositionCoords(lat = 37.78937, lon = -122.38912) {
  // Default the initial custom coordinates to Mozilla's SF office.
  this.latitude = lat;
  this.longitude = lon;
  this.accuracy = 1;
  this.altitude = 0;
  this.altitudeAccuracy = 0;
}

FakeGeoPositionCoords.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGeoPositionCoords]),

  classInfo: XPCOMUtils.generateCI({
    interfaces: [Ci.nsIDOMGeoPositionCoords],
    flags: Ci.nsIClassInfo.DOM_OBJECT,
    classDescription: 'FakeGeoPositionCoords'
  }),
};

function FakeGeoPosition(lat, lon) {
  this.coords = new FakeGeoPositionCoords(lat, lon);
  this.address = null;
  this.timestamp = Date.now();
}

FakeGeoPosition.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGeoPosition]),

  // Class info is required to be able to pass objects back into the DOM.
  classInfo: XPCOMUtils.generateCI({
    interfaces: [Ci.nsIDOMGeoPosition],
    flags: Ci.nsIClassInfo.DOM_OBJECT,
    classDescription: 'FakeGeoPosition'
  }),
};

function FakeGeolocationProvider() {
  this.position = new FakeGeoPosition();
  this.watcher = null;

  Services.obs.addObserver((function onUpdateGeolocation(message) {
    let {lat, lon} = message.wrappedJSObject;
    this.position = new FakeGeoPosition(lat, lon);
    this.update();
  }).bind(this), 'fake-geolocation:spoof', false);
}

FakeGeolocationProvider.prototype = {
  classID: Components.ID('{a93105f2-8169-4790-a455-4701ce867aa8}'),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIGeolocationProvider]),

  // startup() and setHighAccuracy() both need to be defined to implement
  // the nsIGeolocationProvider interface, even though we don't actually
  // implement them.
  startup: function() {},
  setHighAccuracy: function(enable) {},

  watch: function(callback) {
    this.watcher = callback;

    // Update the watcher with the most recent position as soon as possible.
    // We have to do this after a timeout because the nsGeolocationService
    // watcher doesn't expect an update until after this function returns,
    // so it won't accept one until then.
    Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer).initWithCallback(
      (function() this.update()).bind(this), 0, Ci.nsITimer.TYPE_ONE_SHOT
    );
  },

  update: function() {
    if (this.watcher) {
      this.watcher.update(this.position);
    }
  },

  shutdown: function() {
    this.watcher = null;
  },
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FakeGeolocationProvider]);
