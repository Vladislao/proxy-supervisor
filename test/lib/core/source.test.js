const expect = require("chai").expect;
const { SourceCore: Source, BalancerCore: Balancer } = require("../../..");

describe("Core Source", () => {
  describe(".addListener", () => {
    it("should add listner", () => {
      const source = new Source();
      source.addListener({});
      expect(source.listeners).to.be.not.empty;
    });
  });

  describe(".proxies", () => {
    it("should return list of proxy urls from listener", () => {
      const source = new Source();

      const listener = new Balancer().add([
        "http://localhost:23451",
        "http://localhost:23452",
        "http://localhost:23453"
      ]);

      source.addListener(listener);

      const proxies = source.proxies();
      expect(proxies).to.have.lengthOf(3);
    });
    it("should return merged list of proxy urls from multiple listeners", () => {
      const source = new Source();

      const listener1 = new Balancer().add([
        "http://localhost:23451",
        "http://localhost:23452"
      ]);
      const listener2 = new Balancer().add([
        "http://localhost:23452",
        "http://localhost:23453"
      ]);

      source.addListener(listener1);
      source.addListener(listener2);

      const proxies = source.proxies();
      expect(proxies).to.have.lengthOf(3);
    });
  });
});
