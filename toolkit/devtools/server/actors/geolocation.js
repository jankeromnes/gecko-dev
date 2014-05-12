/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

exports.register = function(handle) {
  handle.addGlobalActor(GeolocationActor, 'geolocationActor');
};

exports.unregister = function(handle) {
  handle.removeGlobalActor(GeolocationActor);
};

let GeolocationActor = protocol.ActorClass({
  typeName: 'geolocation',

  spoof: method(function(lat, lon) {
    // send event to setup/update fake mProvider
    Services.obs.notifyObservers({
      wrappedJSObject: {
        lat: aRequest.message.lat,
        lon: aRequest.message.lon,
      }
    }, 'fake-geolocation:spoof', null);
  }, {
    request: {},
    response: {}
  }),

  unspoof: method(function() {
    // resume real geolocation
  }, {
    request: {},
    response: {}
  }),

});

exports.GeolocationFront = protocol.FrontClass(GeolocationActor, {
  initialize: function(client, form) {
    dump('DEVTOOLS: geolocation actor form ' + JSON.stringify(form) + '\n');
    protocol.Front.prototype.initialize.call(this, client); // this.conn = conn; this._requests = [];
    this.actorID = form.geolocationActor;
    this.manage(this);
  }
});
