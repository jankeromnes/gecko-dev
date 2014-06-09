/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
Cu.import('resource:///modules/devtools/gDevTools.jsm');
const {require} = Cu.import('resource://gre/modules/devtools/Loader.jsm', {}).devtools;
const {AppManager} = require('devtools/webide/app-manager');

window.addEventListener('load', function() {
  let client = AppManager.connection.client;
  for (let manifest in AppManager._runningApps.keys()) {
    AppManager.getTargetForManifest(manifest).then(target => {
    });
  }
  client.addListener('monitorUpdate', update);

  // TODO listen for websocket

  // DEBUG 50Hz
  setInterval(function() {
    update('monitorUpdate', [{curveID: 'homescreen', values: [{time: Date.now(), value: Math.ceil(Math.random()*100)}]}]);
  }, 25);
});

window.addEventListener('unload', function() {
  AppManager.connection.client.removeListener('monitorUpdate', update);
});

let graphs = new Map();

function update(type, message) {
  let dirty = new Set();

  for (let data of message) {
    let graph = graphs.get(data.graphID);
    if (!graph) {
      let element = document.createElement('div');
      element.classList.add('graph');
      document.body.appendChild(element);

      graph = new Graph(element);
      graphs.set(data.graphID, graph);
    }
    graph.update(data);
    dirty.add(graph);
  }

  for (let graph of dirty) {
    graph.render();
  }
}


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
    left: 30
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

    let id = data.curveID;

    let curve = this.curves.get(id);
    if (!curve) {
      curve = { id: id, values: [] };
      this.curves.set(id, curve);
      this.data.push(curve);
    }
    
    for (let v of data.values) {
      curve.values.push({time: new Date(v.time), value: +v.value});
    }
    // TODO sort curve.values?
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
      .attr('transform', function(d) { var last = d.values[d.values.length - 1]; return 'translate(' + self.x(last.time) + ',' + self.y(last.value) + ')'; })

    var newcurve = curves.enter().append('g').attr('class', 'curve');
    newcurve.append('path')
      .attr('d', function(d) { return self.line(d.values); })
      .style('stroke', function(d) { return self.color(d.id) });
    newcurve.append('text')
      .attr('transform', function(d) { var last = d.values[d.values.length - 1]; return 'translate(' + self.x(last.time) + ',' + self.y(last.value) + ')'; })
      .attr('x', 3)
      .attr('dy', '.35em')
      .text(function(d) { return d.id; });

    curves.exit().remove();
  }
}
