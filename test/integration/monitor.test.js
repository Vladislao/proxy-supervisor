const { expect, spy } = require("chai");
const http = require("http");

const {
  TARGET_PORT,
  PROXY_PORT,
  default: ensureServers
} = require("../tools/servers");

const defineProxy = require("../tools/proxy");

const { balancer } = require("../../");
const { Monitor } = require("../../lib/monitor");

const TARGET_URL = `http://127.0.0.1:${TARGET_PORT}`;
const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;

describe("Integrational Monitor", () => {
  const { proxy, target } = ensureServers(http);

  // create default proxy handlers
  defineProxy(proxy);

  // create default target handlers
  target.on("request", (req, res) => {
    res.writeHead(200);
    res.end();
  });

  describe(".check", () => {
    it("should not remove working proxies", () => {
      const monitor = new Monitor({ target: TARGET_URL });
      monitor.stop();

      const listener = balancer()
        .add([PROXY_URL])
        .subscribe(monitor);
      const remove = spy.on(listener, "remove");

      return monitor.check().then(arr => {
        expect(arr).to.be.empty;

        expect(remove).to.be.spy;
        expect(remove).to.have.not.been.called();

        expect(listener.proxies.size).to.be.eql(1);
      });
    });

    it("should remove proxy when connection from proxy to target server timed out", () => {
      const monitor = new Monitor({ target: TARGET_URL });
      monitor.stop();

      const listener = balancer()
        .add(["http://127.0.0.1:23453"])
        .subscribe(monitor);
      const remove = spy.on(listener, "remove");

      return monitor.check().then(arr => {
        expect(arr.length).to.be.eql(1);

        expect(remove).to.be.spy;
        expect(remove).to.have.been.called();

        expect(listener.proxies.size).to.be.eql(0);
      });
    });

    it("should remove proxy when connection to proxy server timed out", () => {
      const monitor = new Monitor({ target: TARGET_URL, timeout: 250 });
      monitor.stop();

      const listener = balancer()
        .add([PROXY_URL])
        .subscribe(monitor);

      proxy.redefine("request", (req, res) => {
        setTimeout(() => {
          res.destroy();
        }, 1500);
      });
      const remove = spy.on(listener, "remove");

      return monitor.check().then(arr => {
        expect(arr.length).to.be.eql(1);

        expect(remove).to.be.spy;
        expect(remove).to.have.been.called();

        expect(listener.proxies.size).to.be.eql(0);
      });
    });

    it("should work with multiple listeners", () => {
      const monitor = new Monitor({ target: TARGET_URL, timeout: 250 });
      monitor.stop();

      const listener1 = balancer()
        .add([PROXY_URL])
        .subscribe(monitor);
      const listener2 = balancer()
        .add([PROXY_URL, "http://127.0.0.1:23453"])
        .subscribe(monitor);
      const listener3 = balancer()
        .add(["http://127.0.0.1:23453"])
        .subscribe(monitor);

      const remove1 = spy.on(listener1, "remove");
      const remove2 = spy.on(listener2, "remove");
      const remove3 = spy.on(listener3, "remove");

      return monitor.check().then(arr => {
        expect(arr.length).to.be.eql(1);

        expect(remove1).to.have.been.called();
        expect(remove2).to.have.been.called();
        expect(remove3).to.have.been.called();

        expect(listener1.proxies.size).to.be.eql(1);
        expect(listener2.proxies.size).to.be.eql(1);
        expect(listener3.proxies.size).to.be.eql(0);
      });
    });
  });

  describe(".onResponse", () => {
    it("should apply custom logic", () => {
      const monitor = new Monitor({ target: TARGET_URL, timeout: 250 });
      monitor.stop();
      // we assume that every proxy is good enough
      monitor.onResponse(() => true);

      const listener = balancer()
        .add(["http://127.0.0.1:23453"])
        .subscribe(monitor);

      const remove = spy.on(listener, "remove");

      return monitor.check().then(arr => {
        expect(arr.length).to.be.eql(0);
        expect(remove).to.not.have.been.called();
        expect(listener.proxies.size).to.be.eql(1);
      });
    });
  });
});
