/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci, Cu } = require("chrome");
const { createClass, createFactory, DOM: dom } =
  require("devtools/client/shared/vendor/react");
const Services = require("Services");

const PanelHeader = createFactory(require("../panel-header"));

const Strings = Services.strings.createBundle(
  "chrome://devtools/locale/aboutdebugging.properties");

module.exports = createClass({
  displayName: "ConnectPanel",

  render() {
    let { id } = this.props;

    return dom.div({
      id: id + "-panel",
      className: "panel",
      role: "tabpanel",
      "aria-labelledby": id + "-header"
    },
    PanelHeader({
      id: id + "-header",
      name: Strings.GetStringFromName("connect")
    }),
    dom.form({},
      dom.input({type: "text", name: "host", placeholder: "Host"}),
      dom.input({type: "number", name: "port", placeholder: "Port"}),
      dom.input({type: "submit", value: "Connect"}))
    );
  }
});
