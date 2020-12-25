const { expect, spy: createSpy } = require("chai");
const http = require("http");
const https = require("https");
const fs = require("fs");

const {
  ROTATOR_PORT,
  TARGET_PORT,
  PROXY_PORT,
  default: ensureServers
} = require("../tools/servers");

const { connect, request } = require("../tools/request");
const defineProxy = require("../tools/proxy");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const lib = require("../..");

const TARGET_HEADER = "proxy-target-url";

describe("(TARGET_MODE) Integrational HTTPS", () => {
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
  const spy = createSpy();
  const middleware = balancer.proxy({
    timeout: 250,
    targetHeader: TARGET_HEADER
  });
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
        https.request({
          hostname: "127.0.0.1",
          port: TARGET_PORT,
          rejectUnauthorized: false
        })
      );
      expect(res.statusCode).to.be.eql(200);
      expect(spy).to.have.not.been.called;
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
      expect(spy).to.have.not.been.called;
    });

    it("() -> rotator -> proxy -> []", async () => {
      const res = await request(
        http.request({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
        })
      );
      expect(res.statusCode).to.be.eql(200);

      await delay(5);
      expect(spy).to.have.been.called.once;
    });

    it("should return 502 when no proxy is available", async () => {
      balancer.proxies = new Map();

      const res = await request(
        http.request({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
        })
      );
      expect(res.statusCode).to.be.eql(502);

      await delay(5);
      expect(spy).to.have.been.called.once;
    });

    describe("Broken target", () => {
      it("should work when not reachable", async () => {
        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            headers: { [TARGET_HEADER]: "https://localhost:23453" }
          })
        );
        expect(res.statusCode).to.be.eql(502);

        await delay(5);
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
            headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
          })
        );
        expect(res.statusCode).to.be.eql(502);

        await delay(5);
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
            headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
          })
        );
        expect(res.statusCode).to.be.eql(502);

        await delay(5);
        expect(spy).to.have.been.called.once;
      });
      it("should work when timeouts", async () => {
        proxy.redefine("connect", (res, socket) => {
          setTimeout(() => {
            socket.destroy();
          }, 1500);
        });

        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
          })
        );
        expect(res.statusCode).to.be.eql(502);

        await delay(5);
        expect(spy).to.have.been.called.once;
      });
      it("should work when proxy respond with non 2xx status code", async () => {
        proxy.redefine("connect", (res, socket) => {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
          socket.end();
        });

        const res = await request(
          http.request({
            hostname: "127.0.0.1",
            port: ROTATOR_PORT,
            headers: { [TARGET_HEADER]: "https://127.0.0.1:" + TARGET_PORT }
          })
        );
        expect(res.statusCode).to.be.eql(404);

        await delay(5);
        expect(spy).to.have.been.called.once;
      });
    });
  });
});
