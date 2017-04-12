const expect = require('chai').expect;
const ProxyNode = require('../../lib/node');
const strategy = require('../../lib/strategy');

describe('Default strategy', () => {
  describe('onInit', () => {
    it('should initialize with required fields', () => {
      const initialized = strategy.onInit(new ProxyNode('http://127.0.0.1:3333'));

      expect(initialized.update).to.be.not.undefined;
      expect(initialized.blockCount).to.be.eql(0);
      expect(initialized.unblockDateTime).to.be.eql(0);
      expect(initialized.usedDateTime).to.be.eql(0);
      expect(initialized.available).to.be.eql(true);
    });
  });

  describe('onResponse', () => {
    it('should block proxy on failure', () => {
      const node = strategy.onInit(new ProxyNode('http://127.0.0.1:3333'));
      expect(node.blockCount).to.be.eql(0);

      strategy.onResponse(node, { statusCode: 403 });
      strategy.onResponse(node, { statusCode: 403 });
      strategy.onResponse(node, { statusCode: 403 });

      expect(node.blockCount).to.be.eql(3);
      expect(node.unblockDateTime).to.be.gt(Date.now());
    });

    it('should unblock proxy on success', () => {
      const node = strategy.onInit(new ProxyNode('http://127.0.0.1:3333'));
      expect(node.blockCount).to.be.eql(0);

      strategy.onResponse(node, { statusCode: 403 });
      strategy.onResponse(node, { statusCode: 403 });
      strategy.onResponse(node, { statusCode: 403 });

      expect(node.blockCount).to.be.eql(3);
      expect(node.unblockDateTime).to.be.gt(Date.now());

      strategy.onResponse(node, { statusCode: 200 });

      expect(node.blockCount).to.be.eql(0);
      expect(node.unblockDateTime).to.be.lt(Date.now());
    });
  });

  describe('next', () => {
    it('should return least used unblocked proxy', () => {
      const proxies = [
        strategy.onInit(new ProxyNode('http://127.0.0.1:1')),
        strategy.onInit(new ProxyNode('http://127.0.0.1:2')),
        strategy.onInit(new ProxyNode('http://127.0.0.1:3')),
        strategy.onInit(new ProxyNode('http://127.0.0.1:4'))
      ];

      // recently used
      proxies[0].usedDateTime = Date.now();
      // unavailable
      proxies[2].available = false;
      // blocked
      proxies[3].unblockDateTime = Date.now() + 60000;

      // should return proxies[1]
      const next = strategy.next(proxies);

      expect(next).to.be.equal(proxies[1]);
      expect(next.usedDateTime).to.be.gt(0);
    });

    it('should return least used available proxy when all proxies are blocked', () => {
      const proxies = [
        strategy.onInit(new ProxyNode('http://127.0.0.1:1')),
        strategy.onInit(new ProxyNode('http://127.0.0.1:2')),
        strategy.onInit(new ProxyNode('http://127.0.0.1:3'))
      ];

      // recently used and blocked
      proxies[0].usedDateTime = Date.now();
      proxies[0].unblockDateTime = Date.now() + 60000;
      // unavailable
      proxies[2].available = false;
      // blocked
      proxies[1].unblockDateTime = Date.now() + 60000;

      // should return proxies[1]
      const next = strategy.next(proxies);

      expect(next).to.be.equal(proxies[1]);
      expect(next.usedDateTime).to.be.gt(0);
    });
  });
});
