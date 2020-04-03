const { expect } = require("chai");
const https = require("https");
const fs = require("fs");

const {
  ROTATOR_PORT,
  TARGET_PORT,
  PROXY_PORT,
  default: ensureServers
} = require("../tools/servers");

const { request, connect } = require("../tools/request");
const defineProxy = require("../tools/proxy");

const lib = require("../../");

describe("Integrational HTTPS", () => {
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

    it("should return 502 when no proxy is available", async () => {
      balancer.proxies = new Map();

      const connection = await connect({
        hostname: "127.0.0.1",
        port: ROTATOR_PORT,
        path: "https://localhost:" + TARGET_PORT
      });
      expect(connection.res.statusCode).to.be.eql(502);
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
      it("should work when proxy respond with non 2xx status code", async () => {
        proxy.redefine("connect", (res, socket) => {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
          socket.end();
        });

        const connection = await connect({
          hostname: "127.0.0.1",
          port: ROTATOR_PORT,
          path: "https://localhost:" + TARGET_PORT
        });
        expect(connection.res.statusCode).to.be.eql(404);
      });
    });
  });
});
