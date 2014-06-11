/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
Cu.import('resource:///modules/devtools/gDevTools.jsm');
const {require} = Cu.import('resource://gre/modules/devtools/Loader.jsm', {}).devtools;
const {AppManager} = require('devtools/webide/app-manager');

let Monitor = {

  graphs: new Map(),
  front: null,
  socket: null,

  update: function(data) {
    if (Array.isArray(data)) {
      data.forEach(Monitor.update);
      return;
    }

    let graph = Monitor.graphs.get(data.graph);
    if (!graph) {
      let element = document.createElement('div');
      element.classList.add('graph');
      document.body.appendChild(element);

      graph = new Graph(element);
      Monitor.graphs.set(data.graph, graph);
    }
    graph.update(data);
    graph.render(); // TODO optimize with requestAnimationFrame?
  },

  load: function() {
    // DEBUG
    setInterval(function() {
      Monitor.update({graph: 'test', curve: 'homescreen', values: [{time: Date.now(), value: Math.ceil(Math.random()*100)}]});
    }, 250);

    Monitor.connectToWebSocket();
  },

  unload: function() {
    Monitor.disconnectFromWebSocket();
  },

  connectToWebSocket: function() {
    Monitor.socket = new WebSocket('ws://localhost:9000');
    Monitor.socket.onmessage = function(event) {
      Monitor.update(JSON.parse(event.data));
    };
    Monitor.socket.onclose = function() {
      setTimeout(Monitor.websocket, 1000);
    };
  },

  disconnectFromWebSocket: function() {
    if (Monitor.socket) {
      Monitor.socket.onclose = function(){};
      Monitor.socket.close();
    }
  }
};

window.addEventListener('load', Monitor.load);
window.addEventListener('unload', Monitor.unload);


function Graph(element) {

  var width = element.offsetWidth - this.margin.left - this.margin.right,
      height = element.offsetHeight - this.margin.top - this.margin.bottom;

  this.element = element;
  this.curves = new Map();
  this.data = []; // TODO delete, use this.curves.values() instead?

  this.x = d3.time.scale().range([0, width]);
  this.y = d3.scale.linear().range([height, 0]);

  this.xaxis = d3.svg.axis().scale(this.x).orient('bottom');
  this.yaxis = d3.svg.axis().scale(this.y).orient('left');

  this.line = d3.svg.line().interpolate('linear')
    .x(function(d) { return this.x(d.time); })
    .y(function(d) { return this.y(d.value); });

  this.color = d3.scale.category10();

  this.svg = d3.select(element).append('svg')
    .attr('width', element.offsetWidth)
    .attr('height', element.offsetHeight)
  .append('g')
    .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

  this.svg.append('g').attr('class', 'x axis')
    .attr('transform', 'translate(0,' + height + ')')
    .call(this.xaxis);
  this.svg.append('g').attr('class', 'y axis').call(this.yaxis);
}

Graph.prototype = {

  margin: {
    top: 10,
    right: 100,
    bottom: 30,
    left: 40
  },

  /*resize: function() {
    this.svg.parentNode
      .attr('width', this.element.offsetWidth)
      .attr('height', this.element.offsetHeight);
  },*/

  rescale: function() {
    var gettime = function (v) { return v.time; },
        getvalue = function (v) { return v.value; };

    this.x.domain([
      d3.min(this.data, function(c) { return d3.min(c.values, gettime); }),
      d3.max(this.data, function(c) { return d3.max(c.values, gettime); })
    ]);

    this.y.domain([
      d3.min(this.data, function(c) { return d3.min(c.values, getvalue); }),
      d3.max(this.data, function(c) { return d3.max(c.values, getvalue); })
    ]);

    this.svg.select('.x.axis').call(this.xaxis);
    this.svg.select('.y.axis').call(this.yaxis);
  },

  update: function(data) {
    delete data.graph;

    let curve = data.curve;
    delete data.curve;

    let time = data.time || Date.now();
    delete data.time;

    if (data.value) {
      this.push(curve, [{time: time, value: data.value}]);
      delete data.value;
    }

    if (data.values) {
      this.push(curve, data.values);
      delete data.values;
    }

    for (let key in data) {
      this.push(key, [{time: time, value: data[key]}]);
    }
  },

  push: function(curve, values) {
    let c = this.curves.get(curve);

    if (!c) {
      c = { id: curve, values: [] };
      this.curves.set(curve, c);
      this.data.push(c);
    }

    for (let v of values) {
      c.values.push({time: new Date(v.time), value: +v.value});
    }
    // TODO sort c.values ?
  },

  render: function() {
    var self = this,
        getid = function (c) { return c.id; };

    this.rescale();

    var curves = this.svg.selectAll('.curve').data(this.data, getid);

    var oldcurve = curves; //.transition()
    oldcurve.select('path')
      .attr('d', function(d) { return self.line(d.values); });
    oldcurve.select('text')
      .attr('transform', function(d) { var last = d.values[d.values.length - 1]; return 'translate(' + self.x(last.time) + ',' + self.y(last.value) + ')'; });

    var newcurve = curves.enter().append('g').attr('class', 'curve');
    newcurve.append('path')
      .attr('d', function(d) { return self.line(d.values); })
      .style('stroke', function(d) { return self.color(d.id); });
    newcurve.append('text')
      .attr('transform', function(d) { var last = d.values[d.values.length - 1]; return 'translate(' + self.x(last.time) + ',' + self.y(last.value) + ')'; })
      .attr('x', 3)
      .attr('dy', '.35em')
      .text(function(d) { return d.id; });

    curves.exit().remove();
  }

};
