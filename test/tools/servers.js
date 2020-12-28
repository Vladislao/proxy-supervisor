const { expect } = require("chai");
const http = require("http");

const promisify = require("./promisify");

const ROTATOR_PORT = 23450;
const PROXY_PORT = 23451;
const TARGET_PORT = 23452;

const patch = server => {
  const connections = [];
  server.redefine = (event, fn) => {
    const listeners = server.listeners(event);

    server.removeAllListeners(event);

    server.once(event, fn);
    server.once(event, () => {
      server.removeAllListeners(event);
      listeners.forEach(v => {
        server.on(event, v);
      });
    });
  };
  server.on("connection", c => {
    var key = c.remoteAddress + ":" + c.remotePort;
    connections[key] = c;
    c.on("close", function() {
      delete connections[key];
    });
  });
  server.destroy = function(cb) {
    server.close(cb);
    for (var key in connections) connections[key].destroy();
  };
  return server;
};

module.exports.default = (protocol, options) => {
  const rotator = patch(http.createServer());
  const proxy = patch(http.createServer());
  const target = patch(protocol.createServer(options));

  before(async () => {
    await Promise.all([
      promisify(rotator.listen, [ROTATOR_PORT, "127.0.0.1"], rotator),
      promisify(proxy.listen, [PROXY_PORT, "127.0.0.1"], proxy),
      promisify(target.listen, [TARGET_PORT, "127.0.0.1"], target)
    ]);
  });

  describe("Environment", () => {
    it("rotator should be available", () => {
      const conf = rotator.address();
      expect(conf).to.be.not.null;
      expect(conf.port).to.be.eql(ROTATOR_PORT);
    });
    it("proxy should be available", () => {
      const conf = proxy.address();
      expect(conf).to.be.not.null;
      expect(conf.port).to.be.eql(PROXY_PORT);
    });
    it("endserver should be available", () => {
      const conf = target.address();
      expect(conf).to.be.not.null;
      expect(conf.port).to.be.eql(TARGET_PORT);
    });
  });

  after(async function() {
    this.timeout(5000);
    await Promise.all([
      promisify(rotator.destroy, [], rotator),
      promisify(proxy.destroy, [], proxy),
      promisify(target.destroy, [], target)
    ]);
  });

  return { rotator, proxy, target };
};

module.exports.TARGET_PORT = TARGET_PORT;
module.exports.PROXY_PORT = PROXY_PORT;
module.exports.ROTATOR_PORT = ROTATOR_PORT;
