/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;
Cu.import('resource:///modules/devtools/gDevTools.jsm');
const {require} = Cu.import('resource://gre/modules/devtools/Loader.jsm', {}).devtools;
const {AppManager} = require('devtools/webide/app-manager');
const {AppActorFront} = require('devtools/app-actor-front');
const {Services} = Cu.import("resource://gre/modules/Services.jsm");

let Monitor = {

  apps: new Map(),
  graphs: new Map(),
  front: null,
  socket: null,

  update: function(data, overwrite) {
    if (Array.isArray(data)) {
      data.forEach(d => Monitor.update(d, overwrite));
      return;
    }

    if (overwrite) {
      for (let key in overwrite) {
        data[key] = overwrite[key];
      }
    }

    let graph = Monitor.graphs.get(data.graph);
    if (!graph) {
      let element = document.createElement('div');
      element.classList.add('graph');
      document.body.appendChild(element);

      graph = new Graph(data.graph, element);
      Monitor.resize(); // a scrollbar might have dis/reappeared
      Monitor.graphs.set(data.graph, graph);
    }
    graph.update(data);
  },

  load: function() {

    // DEBUG
    setInterval(function() {
      let start = Date.now();
      Monitor.update({
        graph: 'test',
        time: Date.now(),
        homescreen: Math.ceil(Math.random()*100),
        settings: Math.ceil(Math.random()*100)
      });
      let stop = Date.now();
      Monitor.update({graph:'performance',time:stop,update2x:stop-start});
    }, 30);

    setInterval(function() {
      Monitor.update({graph:'performance', event:'second', time:Date.now()});
    }, 1000);

    AppManager.on('app-manager-update', Monitor.onAppManagerUpdate);

    Monitor.connectToWebSocket();
  },

  unload: function() {
    AppManager.off('list-tabs-response', Monitor.connectToRuntime);
    Monitor.disconnectFromRuntime();
    Monitor.disconnectFromWebSocket();
  },

  resize: function() {
    for (let graph of Monitor.graphs.values()) {
      graph.resize();
    }
  },

  onAppManagerUpdate: function(event, what, details) {
    if (what === 'list-tabs-response') {
      Monitor.connectToRuntime();
    }
  },

  connectToRuntime: function() {
    let client = AppManager.connection && AppManager.connection.client;
    let resp = AppManager._listTabsResponse;
    if (!client) {
      return;
    }
    client.addListener('monitorUpdate', Monitor.onRuntimeUpdate);
    if (resp && !Monitor.front) {
      Monitor.front = new AppActorFront(client, resp);
      Monitor.front.watchApps(Monitor.onRuntimeAppEvent);
    }
  },

  disconnectFromRuntime: function() {
    let client = AppManager.connection && AppManager.connection.client;
    if (client) {
      client.removeListener('monitorUpdate', Monitor.onRuntimeUpdate);
    }
    if (Monitor.front) {
      Monitor.front.unwatchApps(Monitor.onRuntimeAppEvent);
      Monitor.front = null;
    }
  },

  connectToWebSocket: function() {
    let webSocketURL = Services.prefs.getCharPref("devtools.webide.monitorWebSocketURL");
    try {
      Monitor.socket = new WebSocket(webSocketURL);
      Monitor.socket.onmessage = function(event) {
        Monitor.update(JSON.parse(event.data));
      };
      Monitor.socket.onclose = function() {
        setTimeout(Monitor.connectToWebsocket, 1000);
      };
    } catch(e) {
      setTimeout(Monitor.connectToWebsocket, 1000);
    }
  },

  disconnectFromWebSocket: function() {
    if (Monitor.socket) {
      Monitor.socket.onclose = () => {};
      Monitor.socket.close();
    }
  },

  onRuntimeAppEvent: function(type, app) {
    let action;
    switch (type) {
      case 'appOpen':
        action = 'start';
        break;

      case 'appClose':
        action = 'stop';
        break;

      default:
        return;
    }

    app.getForm().then(form => {
      if (action === 'start') {
        Monitor.apps.set(form.monitorActor, app);
      } else {
        Monitor.apps.delete(form.monitorActor);
      }

      AppManager.connection.client.request({
        to: form.monitorActor,
        type: action
      });
    });
  },

  onRuntimeUpdate: function(type, packet) {
    let overwrite = {
      curve: Monitor.apps.get(packet.from).manifest.name
    };
    Monitor.update(packet.data, overwrite);
  }

};

window.addEventListener('load', Monitor.load);
window.addEventListener('unload', Monitor.unload);
window.addEventListener('resize', Monitor.resize);


function Graph(name, element) {
  let width = element.offsetWidth - this.margin.left - this.margin.right,
      height = element.offsetHeight - this.margin.top - this.margin.bottom,
      self = this;

  this.name = name;
  this.element = element;
  this.curves = new Map();
  this.events = new Map();
  this.ignored = new Set();
  this.enabled = true;
  this.request = null;

  this.x = d3.time.scale();
  this.y = d3.scale.linear();

  this.xaxis = d3.svg.axis().scale(this.x).orient('bottom');
  this.yaxis = d3.svg.axis().scale(this.y).orient('left');

  this.xformat = this.xaxis.tickFormat();
  this.yformat = this.formatter(1);
  this.yaxis.tickFormat(this.formatter(0));

  this.line = d3.svg.line().interpolate('linear')
    .x(function(d) { return this.x(d.time); })
    .y(function(d) { return this.y(d.value); });

  this.color = d3.scale.category10();

  this.svg = d3.select(element).append('svg').append('g')
    .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

  this.svg.append('g').attr('class', 'x axis')
    .attr('transform', 'translate(0,' + height + ')')
    .call(this.xaxis);
  this.svg.append('g').attr('class', 'y axis').call(this.yaxis);

  // TODO bisectDate http://bl.ocks.org/mbostock/3902569

  // RULERS on axes
  let xruler = this.xruler = this.svg.select('.x.axis').append('g').attr('class', 'x ruler');
  xruler.append('line').attr('y2', 6);
  xruler.append('line').attr('stroke-dasharray', '1,1').attr('y2', -height);
  //xruler.append('text').attr('y', 9).attr('dy', '.71em');

  let yruler = this.yruler = this.svg.select('.y.axis').append('g').attr('class', 'y ruler');
  yruler.append('line').attr('x2', -6);
  yruler.append('line').attr('stroke-dasharray', '1,1').attr('x2', width);
  yruler.append('text').attr('x', -9).attr('dy', '.32em');

  d3.select(element).select('svg')
    .on('mousemove', function() {
      let mouse = d3.mouse(this),
          x = mouse[0] - self.margin.left,
          y = mouse[1] - self.margin.top;

      xruler.attr('transform', 'translate(' + x + ',0)');
      //xruler.select('text').text(self.xformat(self.x.invert(mouse[0])));
      yruler.attr('transform', 'translate(0,' + y + ')');
      yruler.select('text').text(self.yformat(self.y.invert(y)));
    });
    /*.on('mouseout', function() {
      self.xruler.attr('transform', 'translate(-500,0)');
      self.yruler.attr('transform', 'translate(0,-500)');
    });*/

  let sidebar = d3.select(this.element).append('div').attr('class', 'sidebar');
  let title = sidebar.append('label').attr('class', 'title');

  title.append('input')
    .attr('type', 'checkbox')
    .attr('checked', 'true')
    .on('click', function() { self.toggle(); });
  title.append('span').text(this.name);

  this.legend = sidebar.append('div').attr('class', 'legend');

  this.resize = this.resize.bind(this);
  this.render = this.render.bind(this);

  this.resize();
}

Graph.prototype = {

  margin: {
    top: 10,
    right: 130,
    bottom: 30,
    left: 40
  },

  resize: function() {
    let element = this.element,
        width = element.offsetWidth - this.margin.left - this.margin.right,
        height = element.offsetHeight - this.margin.top - this.margin.bottom;

    d3.select(element).select('svg')
      .attr('width', element.offsetWidth - this.margin.right)
      .attr('height', element.offsetHeight);

    this.x.range([0, width]);
    this.y.range([height, 0]);
  },

  toggle: function() {
    if (this.enabled) {
      this.element.classList.add('disabled');
      this.enabled = false;
    } else {
      this.element.classList.remove('disabled');
      this.enabled = true;
    }
    Monitor.resize();
  },

  rescale: function(data) {
    let gettime = v => { return v.time; },
        getvalue = v => { return v.value; };

    this.x.domain([
      d3.min(data, c => { return d3.min(c.values, gettime); }),
      d3.max(data, c => { return d3.max(c.values, gettime); })
    ]);

    this.y.domain([
      0,
      d3.max(data, c => { return d3.max(c.values, getvalue); })
    ]).nice();

    this.svg.select('.x.axis').call(this.xaxis);
    this.svg.select('.y.axis').call(this.yaxis);
  },

  update: function(data) {
    delete data.graph;

    let time = data.time || Date.now();
    delete data.time;

    let curve = data.curve;
    delete data.curve;

    // Single curve value, e.g. { curve: 'memory', value: 42, time: 1234 }.
    if ('value' in data) {
      this.push(this.curves, curve, [{time: time, value: data.value}]);
      delete data.value;
    }

    // Several curve values, e.g. { curve: 'memory', values: [{value: 42, time: 1234}] }.
    if ('values' in data) {
      this.push(this.curves, curve, data.values);
      delete data.values;
    }

    // Punctual event, e.g. { event: 'gc', time: 1234 },
    // event with duration, e.g. { event: 'jank', duration: 425, time: 1234 }.
    if ('event' in data) {
      this.push(this.events, data.event, [{time: time, value: data.duration}]);
      delete data.event;
      delete data.duration;
    }

    // Remaining keys are curves, e.g. { time: 1234, memory: 42, battery: 13, temperature: 45 }.
    for (let key in data) {
      this.push(this.curves, key, [{time: time, value: data[key]}]);
    }

    // If no render is currently pending, request one.
    if (this.enabled && !this.request) {
      this.request = requestAnimationFrame(this.render);
    }
  },

  push: function(collection, id, values) {
    let item = collection.get(id);
    if (!item) {
      item = { id: id, values: [] };
      collection.set(id, item);
    }
    for (let v of values) {
      item.values.push({time: new Date(v.time), value: +v.value});
    }
  },

  formatter: function(decimals) {
    return value => {
      let prefix = d3.formatPrefix(value);
      return prefix.scale(value).toFixed(decimals) + prefix.symbol;
    };
  },

  render: function() {
    let start = Date.now();

    let self = this,
        getid = d => { return d.id; },
        gettime = d => { return d.time.getTime(); },
        getline = d => { return self.line(d.values); },
        getcolor = d => { return self.color(d.id); },
        getvalues = d => { return d.values; },
        ignored = d => { return self.ignored.has(d.id); };

    this.request = null;

    let curvedata = [];
    for (let c of this.curves.values()) {
      curvedata.push(c);
    }

    this.rescale(curvedata);

    let curves = this.svg.selectAll('.curve').data(curvedata, getid);
    curves.enter().append('g').attr('class', 'curve').append('path')
      .style('stroke', getcolor);
    curves.exit().remove();

    this.svg.selectAll('.curve').select('path')
      .attr('d', d => { return ignored(d) ? '' : getline(d); });

    let eventdata = [];
    for (let e of this.events.values()) {
      eventdata.push(e);
    }

    let height = this.element.offsetHeight - this.margin.top - this.margin.bottom;

    let events = this.svg.selectAll('.event-slot').data(eventdata, getid);
    events.enter().append('g').attr('class', 'event-slot');
    events.exit().remove();

    let lines = this.svg.selectAll('.event-slot')
      .style('stroke', d => { return ignored(d) ? 'none' : getcolor(d); })
    .selectAll('.event')
      .data(getvalues, gettime);
    lines.enter().append('line').attr('class', 'event').attr('y2', height);
    lines.exit().remove();

    this.svg.selectAll('.event')
      .attr('transform', d => { return 'translate(' + self.x(d.time) + ',0)'; });

    // TODO select curves and events, intersect with curves and show values/hovers
    // e.g. look like http://code.shutterstock.com/rickshaw/examples/lines.html

    let data = curvedata.concat(eventdata);

    let legends = this.legend.selectAll('label').data(data, getid);

    let newlegend = legends.enter().append('label');
    newlegend.append('input').attr('type', 'checkbox').attr('checked', 'true').on('click', function(d) {
      if (ignored(d)) {
        this.parentElement.classList.remove('disabled');
        self.ignored.delete(d.id);
      } else {
        this.parentElement.classList.add('disabled');
        self.ignored.add(d.id);
      }
      self.update({}); // if no re-render is pending, request one.
    });
    newlegend.append('span').attr('class', 'color').style('background-color', getcolor);
    newlegend.append('span').text(getid);

    legends.exit().remove();

    let stop = Date.now();
    if (this.name !== 'performance') Monitor.update({graph:'performance',time:stop,render:stop-start});
  }

};
