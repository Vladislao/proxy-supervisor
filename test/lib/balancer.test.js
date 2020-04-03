const { expect } = require("chai");
const lib = require("../../");

const PROXY = "http://proxy.com/";
const TARGET = "http://google.com/";

describe("Default Balancer", () => {
  describe(".onResponse", () => {
    it("should block proxy on failure", () => {
      const balancer = lib.balancer().add(PROXY);
      const proxy = balancer.proxies.values()[0];

      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });
      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });
      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });

      const params = balancer.__resolver.get("google.com").get(proxy);

      expect(params.blockCount).to.be.eql(3);
      expect(params.unblockDateTime).to.be.gt(Date.now());
    });

    it("should unblock proxy on success", () => {
      const balancer = lib.balancer().add(PROXY);
      const proxy = balancer.proxies.values()[0];

      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });
      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });
      balancer._response(proxy, { statusCode: 403 }, { url: TARGET });

      const params1 = balancer.__resolver.get("google.com").get(proxy);
      expect(params1.blockCount).to.be.eql(3);
      expect(params1.unblockDateTime).to.be.gt(Date.now());

      balancer._response(proxy, { statusCode: 200 }, { url: TARGET });

      const params2 = balancer.__resolver.get("google.com").get(proxy);
      expect(params2.blockCount).to.be.eql(0);
      expect(params2.unblockDateTime).to.be.lt(Date.now());
    });
  });

  describe(".onError", () => {
    it("should block proxy on failure", () => {
      const balancer = lib.balancer().add(PROXY);
      const proxy = balancer.proxies.values()[0];

      balancer._error(proxy, {}, { url: TARGET });
      balancer._error(proxy, {}, { url: TARGET });
      balancer._error(proxy, {}, { url: TARGET });

      const params = balancer.__resolver.get("google.com").get(proxy);

      expect(params.blockCount).to.be.eql(3);
      expect(params.unblockDateTime).to.be.gt(Date.now());
    });
  });

  describe(".onNext", () => {
    it("should return least used unblocked proxy", () => {
      const balancer = lib
        .balancer()
        .add([
          "http://proxy1.com/",
          "http://proxy2.com/",
          "http://proxy3.com/"
        ]);

      const proxies = Array.from(balancer.proxies.values());
      balancer.__resolver
        .update("google.com", proxies[0], v => ({
          ...v,
          // recently used
          usedDateTime: Date.now()
        }))
        .update("google.com", proxies[1], v => ({
          ...v,
          // blocked
          blockCount: 3,
          unblockDateTime: Date.now() + 60000
        }));

      // should return proxies[2]
      const next = balancer._next(proxies, { url: TARGET });
      expect(next).to.be.equal(proxies[2]);

      const params = balancer.__resolver.get("google.com").get(proxies[2]);
      expect(params.usedDateTime).to.be.gt(0);
    });

    it("should return least used available proxy when all proxies are blocked", () => {
      const balancer = lib
        .balancer()
        .add(["http://proxy1.com/", "http://proxy2.com/"]);

      const proxies = Array.from(balancer.proxies.values());
      balancer.__resolver
        .update("google.com", proxies[0], v => ({
          ...v,
          // used and blocked
          usedDateTime: Date.now(),
          blockCount: 3,
          unblockDateTime: Date.now() + 60000
        }))
        .update("google.com", proxies[1], v => ({
          ...v,
          // blocked
          blockCount: 3,
          unblockDateTime: Date.now() + 60000
        }));

      // should return proxies[1]
      const next = balancer._next(proxies, { url: TARGET });
      expect(next).to.be.equal(proxies[1]);

      const params = balancer.__resolver.get("google.com").get(proxies[1]);
      expect(params.usedDateTime).to.be.gt(0);
    });
  });
});
