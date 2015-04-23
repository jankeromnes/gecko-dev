/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests whether copying a request item's parameters works.
 */

function test() {
  initNetMonitor(PARAMS_URL).then(([aTab, aDebuggee, aMonitor]) => {
    info("Starting test... ");

    let { document, L10N, EVENTS, Editor, NetMonitorView } = aMonitor.panelWin;
    let { RequestsMenu, NetworkDetails } = NetMonitorView;

    RequestsMenu.lazyUpdate = false;

    Task.spawn(function () {
      yield waitForNetworkEvents(aMonitor, 0, 6);

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(0);
      yield testCopyUrlParams('a');

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(1);
      yield testCopyUrlParams('a=b');

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(2);
      yield testCopyUrlParams('a=b');

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(3);
      yield testCopyUrlParams('a');

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(4);
      yield testCopyUrlParams('a=b');

      RequestsMenu.selectedItem = RequestsMenu.getItemAtIndex(5);
      yield testCopyUrlParams('a=b');

      yield teardown(aMonitor);
      finish();
    });

    function testCopyUrlParams(aQueryString) {
      RequestsMenu.copyUrlParams();

      is(SpecialPowers.getClipboardData("text/unicode"), aQueryString,
        "The url query string copied from the selected item is correct.");
    }

    aDebuggee.performRequests();
  });
}

