const { expect, spy: createSpy } = require("chai");
const http = require("http");
const https = require("https");
const fs = require("fs");

const promisify = require("./tools/promisify");
const { request, connect } = require("./tools/request");
const defineProxy = require("./tools/proxy");
const patch = require("./tools/server");

const lib = require("../index");

const ROTATOR_PORT = 23450;
const PROXY_PORT = 23451;
const TARGET_PORT = 23452;

process.on("uncaughtException", function(err) {
  console.log("uncaughtException");
  console.log(err);
});
process.on("unhandledRejection", function(err) {
  console.log("unhandledRejection");
  console.log(err);
});

const ensureServers = (protocol, options) => {
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

  after(async () => {
    await Promise.all([
      promisify(rotator.close, [], rotator),
      promisify(proxy.close, [], proxy),
      promisify(target.close, [], target)
    ]);
  });

  return { rotator, proxy, target };
};

describe("HTTP", () => {
  const { rotator, proxy, target } = ensureServers(http);

  // create balancer
  const balancer = lib.balancer();

  // create default proxy handlers
  defineProxy(proxy);

  // create default rotator handlers
  const spy = createSpy();
  const middleware = balancer.proxy({ timeout: 250 });
  rotator.on("request", (req, res) => {
    middleware(req, res, spy);
  });

  // create default target handlers
  target.on("request", (req, res) => {
    res.writeHead(200);
    res.end();
  });

  describe("GET", () => {
    beforeEach(() => {
      balancer.proxies = new Map();
      balancer.add("http://127.0.0.1:" + PROXY_PORT);
      spy.reset();
    });

    it("() -> []", async () => {
      const res = await request(
        http.request({
          hostname: "127.0.0.1",
          port: TARGET_PORT
        })
      );
      expect(res.statusCode).to.be.eql(200);
      expect(spy).to.have.not.been.called;
    });

    it("() -> proxy -> []", async () => {
      const res = await request(
        http.request({
          hostname: "127.0.0.1",
          port: PROXY_PORT,
          path: "http://localhost:" + TARGET_PORT
        })
      );
      expect(res.statusCode).to.be.eql(200);
      expect(spy).to.have.not.been.called;
    });

    it("() -> rotator -> proxy -> []", async () => {
      const res = await request(
        http.request({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "http://localhost:" + TARGET_PORT
        })
      );
      expect(res.statusCode).to.be.eql(200);
      expect(spy).to.have.been.called.once;
    });

    describe("Broken target", () => {
      it("should work when not reachable", async () => {
        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            path: "http://localhost:23453"
          })
        );
        expect(res.statusCode).to.be.eql(502);
        expect(spy).to.have.been.called.once;
      });
      it("should work when timeouts", async () => {
        target.redefine("request", (req, res) => {
          setTimeout(() => {
            res.destroy();
          }, 1500);
        });

        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            path: "http://localhost:" + TARGET_PORT
          })
        );
        expect(res.statusCode).to.be.eql(502);
        expect(spy).to.have.been.called.once;
      });
    });
    describe("Broken proxy", () => {
      it("should work when not reachable", async () => {
        balancer.proxies = new Map();
        balancer.add("http://127.0.0.1:23453");

        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            path: "http://localhost:" + TARGET_PORT
          })
        );
        expect(res.statusCode).to.be.eql(502);
        expect(spy).to.have.been.called.once;
      });
      it("should work when timeouts", async () => {
        proxy.redefine("request", (req, res) => {
          setTimeout(() => {
            res.destroy();
          }, 1500);
        });

        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            path: "http://localhost:" + TARGET_PORT
          })
        );
        expect(res.statusCode).to.be.eql(502);
        expect(spy).to.have.been.called.once;
      });
    });
  });
});

describe("HTTPS", () => {
  // start servers
  const { rotator, proxy, target } = ensureServers(https, {
    key: fs.readFileSync("test/keys/key.pem"),
    cert: fs.readFileSync("test/keys/cert.pem")
  });

  // create balancer
  const balancer = lib.balancer();

  // create default proxy handlers
  defineProxy(proxy);

  // create default rotator handlers
  rotator.on("request", balancer.proxy({ timeout: 250 }));
  rotator.on("connect", balancer.connect({ timeout: 250 }));

  // create default target handlers
  target.on("request", (req, res) => {
    res.writeHead(200);
    res.end();
  });

  describe("GET", () => {
    beforeEach(() => {
      balancer.proxies = new Map();
      balancer.add("http://127.0.0.1:" + PROXY_PORT);
    });

    it("() -> []", async () => {
      const res = await request(
        https.request({
          hostname: "127.0.0.1",
          port: TARGET_PORT,
          rejectUnauthorized: false
        })
      );
      expect(res.statusCode).to.be.eql(200);
    });

    it("() -> proxy -> []", async () => {
      const connection = await connect({
        hostname: "127.0.0.1",
        port: PROXY_PORT,
        path: "https://localhost:" + TARGET_PORT
      });
      expect(connection.res.statusCode).to.be.eql(200);

      const res = await request(
        https.request({
          hostname: "127.0.0.1",
          port: TARGET_PORT,
          socket: connection.socket,
          rejectUnauthorized: false,
          agent: false
        })
      );

      expect(res.statusCode).to.be.eql(200);
    });

    it("() -> rotator -> proxy -> []", async () => {
      const connection = await connect({
        hostname: "127.0.0.1",
        port: ROTATOR_PORT,
        path: "https://localhost:" + TARGET_PORT
      });
      expect(connection.res.statusCode).to.be.eql(200);

      const res = await request(
        https.request({
          hostname: "127.0.0.1",
          port: TARGET_PORT,
          socket: connection.socket,
          rejectUnauthorized: false,
          agent: false
        })
      );

      expect(res.statusCode).to.be.eql(200);
    });

    describe("Broken target", () => {
      it("should work when not reachable", async () => {
        const connection = await connect({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "https://localhost:23453"
        });
        expect(connection.res.statusCode).to.be.eql(502);
      });
      it("should work when timeouts", async () => {
        target.redefine("request", (req, res) => {
          setTimeout(() => {
            res.destroy();
          }, 1500);
        });

        const connection = await connect({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "https://localhost:" + TARGET_PORT
        });
        expect(connection.res.statusCode).to.be.eql(200);

        await expect(
          request(
            https.request({
              hostname: "127.0.0.1",
              port: TARGET_PORT,
              socket: connection.socket,
              rejectUnauthorized: false,
              agent: false
            })
          )
        ).to.eventually.be.rejected;
      });
    });
    describe("Broken proxy", () => {
      it("should work when not reachable", async () => {
        balancer.proxies = new Map();
        balancer.add("http://127.0.0.1:23453");

        const connection = await connect({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "https://localhost:" + TARGET_PORT
        });
        expect(connection.res.statusCode).to.be.eql(502);
      });
      it("should work when timeouts", async () => {
        proxy.redefine("connect", (res, socket) => {
          setTimeout(() => {
            socket.destroy();
          }, 1500);
        });

        const connection = await connect({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "https://localhost:" + TARGET_PORT
        });
        expect(connection.res.statusCode).to.be.eql(502);
      });
    });
  });
});
