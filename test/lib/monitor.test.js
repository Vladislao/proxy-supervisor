const { expect, spy } = require("chai");

const { default: create, reset, Monitor } = require("../../lib/monitor");

describe("Monitor", () => {
  beforeEach(() => {
    reset();
  });

  it("should throw when target is not provided", () => {
    expect(create).to.throw();
  });

  it("should expose singleton instance", () => {
    expect(typeof create).to.be.eql("function");

    const instance = create({ target: "test" });
    instance.stop();

    expect(instance).to.be.instanceof(Monitor);

    const instance2 = create({ target: "test" });
    expect(instance2).to.be.equal(instance);
  });

  it("should be started after creation", done => {
    const monitor = create({ target: "test", interval: 0 });
    const check = spy.on(monitor, "check");

    setTimeout(() => {
      monitor.stop();

      expect(check).to.be.spy;
      expect(check).to.have.been.called();
      done();
    }, 10);
  });

  it("should check periodically even if empty", done => {
    const monitor = create({ target: "test", interval: 0 });
    const check = spy.on(monitor, "check");

    setTimeout(() => {
      monitor.stop();

      expect(check).to.be.spy;
      expect(check).to.have.been.called.gt(2);
      done();
    }, 10);
  });

  it.skip("(slow) should not trigger stack overflow", done => {
    const monitor = create({ target: "test", interval: 0 });
    const check = spy.on(monitor, "check");

    const interval = setInterval(() => {
      if (check.__spy.calls.length > 12000) {
        monitor.stop();
        done();
        clearInterval(interval);
      }
    }, 100);
  }).timeout(30000);
});
