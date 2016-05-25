/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { createClass, DOM: dom } =
  require("devtools/client/shared/vendor/react");
const Services = require("Services");

const Strings = Services.strings.createBundle(
  "chrome://devtools/locale/aboutdebugging.properties");

const LocaleCompare = (a, b) => {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
};

module.exports = createClass({
  displayName: "RuntimeList",

  componentDidMount() {
    let { runtimeScanner } = this.props;
    runtimeScanner.on("runtime-list-updated", this.update);
    runtimeScanner.enable();
    runtimeScanner.scan().then(this.update);
  },

  componentWillUnmount() {
    let { runtimeScanner } = this.props;
    runtimeScanner.off("runtime-list-updated", this.update);
    runtimeScanner.disable();
  },

  /*refresh() {
    this.props.runtimeScanner.scan().then(() => {

    });
  },*/

  update() {
    this.setState({});
  },

  render() {
    let { name, runtimeScanner } = this.props;

    let runtimes = runtimeScanner.listRuntimes()
      .sort(LocaleCompare)
      .map(runtime => {
        return dom.div({}, runtime.name);
      });

    return dom.div({},
      dom.h2(null, name),
      (runtimes.length > 0 ?
        runtimes :
        dom.p(null, Strings.GetStringFromName("nothing"))
      )
    );
  }
});
