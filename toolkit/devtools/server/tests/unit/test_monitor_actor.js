/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test the monitor actor.
 */

"use strict";

function run_test()
{
  DebuggerServer.init(function () { return true; });
  DebuggerServer.addBrowserActors();

  let client = new DebuggerClient(DebuggerServer.connectPipe());

  let monitor;

  // Start tracking event loop lags.
  client.connect(function () {
    client.listTabs(function(resp) {
      monitor = resp.monitorActor;
      client.request({
        to: monitor,
        type: "start"
      });
      do_execute_soon(update);
    });
  });

  let time = new Date().getTime();

  function update() {
    let event = {
      time: time,
      value: 42
    };
    Services.obs.notifyObservers(null, "devtools-monitor-update", JSON.stringify(event));
  }

  client.addListener("monitorUpdate", gotUpdate);

  function gotUpdate(type, obj) {
    do_check_eq(obj.data.length, 1);
    let evt = obj.data[0];
    do_check_eq(evt.value, 42);
    do_check_eq(evt.time, time);
    client.request({
      to: monitor,
      type: "stop"
    }, function (aResponse) {
      client.removeListener("monitorUpdate", gotUpdate);
      finishClient(client);
    });
  }

  do_test_pending();
}
