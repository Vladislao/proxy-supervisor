const { expect, spy: createSpy } = require("chai");
const http = require("http");

const {
  ROTATOR_PORT,
  TARGET_PORT,
  PROXY_PORT,
  default: ensureServers
} = require("../tools/servers");

const { request } = require("../tools/request");
const defineProxy = require("../tools/proxy");

const lib = require("../../");

describe("Integrational HTTP", () => {
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

    it("should return 502 when no proxy is available", async () => {
      balancer.proxies = new Map();

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
      it("should work when response is broken", async () => {
        target.redefine("request", (req, res) => {
          res.writeHead(200, { "Content-Length": 5 });
          res.write("One");

          setTimeout(() => {
            res.destroy();
          }, 1500);
        });

        try {
          await request(
            http.request({
              hostname: "127.0.0.1",
              port: ROTATOR_PORT,
              path: "http://localhost:" + TARGET_PORT
            })
          );
          expect.fail("should not resolve with inconsistent data");
        } catch (e) {
          expect(spy).to.have.been.called.once;
        }
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
