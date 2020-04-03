const { expect, spy } = require("chai");
const url = require("url");
const { BalancerCore: Balancer } = require("../../../");

describe("Core Balancer", () => {
  describe(".add", () => {
    it("should create new proxy with http://admin:123@127.0.0.1:3333/", () => {
      const balancer = new Balancer().add(["http://admin:123@127.0.0.1:3333/"]);
      expect(balancer.proxies.get("127.0.0.1:3333")).to.exist;
    });
    it("should create new proxy with http://127.0.0.1:3333/", () => {
      const balancer = new Balancer().add(["http://127.0.0.1:3333/"]);
      expect(balancer.proxies.get("127.0.0.1:3333")).to.exist;
    });
    it("should create new proxy with http://127.0.0.1:3333", () => {
      const balancer = new Balancer().add(["http://127.0.0.1:3333"]);
      expect(balancer.proxies.get("127.0.0.1:3333")).to.exist;
    });
    it("should create new proxy with http://127.0.0.1", () => {
      const balancer = new Balancer().add(["http://127.0.0.1"]);
      const proxy = balancer.proxies.get("127.0.0.1");

      expect(proxy).to.exist;
      expect(proxy.url.protocol).to.be.eql("http:");
    });
    it("should create new proxy with 127.0.0.1", () => {
      const balancer = new Balancer().add(["127.0.0.1"]);
      const proxy = balancer.proxies.get("127.0.0.1");

      expect(proxy).to.exist;
      expect(proxy.url.protocol).to.be.eql("http:");
    });
    it("should create new proxy with `google`", () => {
      const balancer = new Balancer().add(["google"]);
      const proxy = balancer.proxies.get("google");

      expect(proxy).to.exist;
      expect(proxy.url.protocol).to.be.eql("http:");
    });
    it("should create new proxy with Url", () => {
      const address = url.parse("http://127.0.0.1:3000");
      const balancer = new Balancer().add([address]);
      const proxy = balancer.proxies.get("127.0.0.1:3000");

      expect(proxy).to.exist;
      expect(proxy.url.protocol).to.be.eql("http:");
    });
    it("should work with non-array parameter", () => {
      const balancer = new Balancer().add("google");
      const proxy = balancer.proxies.get("google");

      expect(proxy).to.exist;
      expect(proxy.url.protocol).to.be.eql("http:");
    });
    it("should update node address", () => {
      const balancer = new Balancer().add([
        "http://user1:pass1@127.0.0.1:3333"
      ]);

      const proxy1 = balancer.proxies.get("127.0.0.1:3333");
      expect(proxy1.url.auth).to.be.eql("user1:pass1");

      balancer.add(["http://user2@127.0.0.1:3333"]);
      const proxy2 = balancer.proxies.get("127.0.0.1:3333");

      expect(proxy1).to.be.equal(proxy2);
      expect(proxy2.url.auth).to.be.eql("user2");
    });
  });

  describe(".remove", () => {
    it("should delete proxy by host", () => {
      const balancer = new Balancer()
        .add(["127.0.0.1:3333"])
        .remove(["127.0.0.1"]);

      expect(balancer.proxies.values()).to.be.empty;
    });
    it("should delete proxy by Url", () => {
      const address = url.parse("http://127.0.0.1:3333");

      const balancer = new Balancer().add(["127.0.0.1:3333"]).remove([address]);

      expect(balancer.proxies.values()).to.be.empty;
    });
    it("should work with non-array parameter", () => {
      const balancer = new Balancer()
        .add(["127.0.0.1:3333"])
        .remove("127.0.0.1");

      expect(balancer.proxies.values()).to.be.empty;
    });
    it("should not throw when proxy not found", () => {
      const balancer = new Balancer().remove(["127.0.0.1"]);

      expect(balancer.proxies.values()).to.be.empty;
    });
  });

  describe(".proxy", () => {
    it("should return function", () => {
      const fn = new Balancer().proxy();
      expect(typeof fn).to.be.eql("function");
    });
  });

  describe("._next", () => {
    it("should throw if not provided", () => {
      const balancer = new Balancer();
      expect(balancer._next).to.throw();
    });
  });

  describe(".onAdd", () => {
    it("should overwrite ._init logic", () => {
      const fn = spy.on(proxy => proxy);
      new Balancer().onAdd(fn).add("127.0.0.1");

      expect(fn).to.be.called.once;
    });
  });
});
