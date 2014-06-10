/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Ci,Cu,Cc} = require('chrome');

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

const Services = require('Services');
const {setTimeout,clearTimeout} = require('sdk/timers');


function MonitorActor(aConnection) {
  this.conn = aConnection;
}

MonitorActor.prototype = {
  actorPrefix: 'monitor',

  // Registered update agents
  _agents: [],
  _addAgent: function(agent) {
    if (this._started) {
      agent.start();
    }
    this._agents.push(agent);
  },

  // Updates

  _toSend: [],
  _timeout: null,
  _started: false,
  _scheduleUpdate: function() {
    if (this._started) {
      this.conn.send({
        from: this.actorID,
        type: 'monitorUpdate',
        data: this._toSend
      });
      this._toSend = [];
    }
  },

  disconnect: function() {
    this.stop();
  },

  // Methods available from the front

  start: function() {
    if (!this._started) {
      this._started = true;
      Services.obs.addObserver(this, 'devtools-monitor-update', false);
      Services.obs.notifyObservers(null, 'devtools-monitor-start', '');
      this._agents.forEach(agent => agent.start());
    }
    return {};
  },

  stop: function() {
    if (this._started) {
      this._agents.forEach(agent => agent.stop());
      Services.obs.notifyObservers(null, 'devtools-monitor-stop', '');
      Services.obs.removeObserver(this, 'devtools-monitor-update');
      this._started = false;
    }
    return {};
  },

  // nsIObserver

  observe: function (subject, topic, data) {
    if (topic == 'devtools-monitor-update') {
      try {
        data = JSON.parse(data);
        if (!Array.isArray(data)) {
          this._toSend.push(data);
        } else {
          this._toSend = this._toSend.concat(data);
        }
        this._scheduleUpdate();
      } catch(e) {
        console.error('Observer notification data is not a valid JSON-string: ' + data);
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
};

MonitorActor.prototype.requestTypes = {
  'start': MonitorActor.prototype.start,
  'stop': MonitorActor.prototype.stop,
};

exports.MonitorActor = MonitorActor;

exports.register = function(handle) {
  handle.addGlobalActor(MonitorActor, 'monitorActor');
  handle.addTabActor(MonitorActor, 'monitorActor');
};

exports.unregister = function(handle) {
  handle.removeGlobalActor(MonitorActor, 'monitorActor');
  handle.removeTabActor(MonitorActor, 'monitorActor');
};


let USSAgent = {

  mgr: null,
  timeout: null,
  packet: {
    graph: 'uss',
    time: null,
    value: null
  },

  start: function() {
    USSAgent.mgr = Cc['@mozilla.org/memory-reporter-manager;1'].getService(Ci.nsIMemoryReporterManager);
    USSAgent.update();
  },

  update: function() {
    if (!USSAgent.mgr) {
      USSAgent.stop();
    }
    USSAgent.packet.time = Date.now();
    USSAgent.packet.value = USSAgent.mgr.residentUnique;
    Services.obs.notifyObservers(null, 'devtools-monitor-update', JSON.stringify(USSAgent.packet));
    USSAgent.timeout = setTimeout(USSAgent.update, 300);
  },

  stop: function() {
    clearTimeout(USSAgent.timeout);
    USSAgent.mgr = null;
  }

};

MonitorActor.prototype._addAgent(USSAgent);
