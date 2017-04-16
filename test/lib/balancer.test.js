const expect = require('chai').expect;
const vicodin = require('../../lib/balancer');

const balancer = vicodin();

describe('Default Balancer', () => {
  describe('.onAdd', () => {
    it('should initialize with required fields', () => {
      const proxy = balancer._init({ url: 'http://127.0.0.1:3333' });

      expect(proxy.url).to.be.eql('http://127.0.0.1:3333');
      expect(proxy.blockCount).to.be.eql(0);
      expect(proxy.unblockDateTime).to.be.eql(0);
      expect(proxy.usedDateTime).to.be.eql(0);
    });
  });

  describe('.onResponse', () => {
    it('should block proxy on failure', () => {
      const proxy = balancer._init({});
      expect(proxy.blockCount).to.be.eql(0);

      balancer._response(proxy, { statusCode: 403 });
      balancer._response(proxy, { statusCode: 403 });
      balancer._response(proxy, { statusCode: 403 });

      expect(proxy.blockCount).to.be.eql(3);
      expect(proxy.unblockDateTime).to.be.gt(Date.now());
    });

    it('should unblock proxy on success', () => {
      const node = balancer._init({});
      expect(node.blockCount).to.be.eql(0);

      balancer._response(node, { statusCode: 403 });
      balancer._response(node, { statusCode: 403 });
      balancer._response(node, { statusCode: 403 });

      expect(node.blockCount).to.be.eql(3);
      expect(node.unblockDateTime).to.be.gt(Date.now());

      balancer._response(node, { statusCode: 200 });

      expect(node.blockCount).to.be.eql(0);
      expect(node.unblockDateTime).to.be.lt(Date.now());
    });
  });

  describe('.onNext', () => {
    it('should return least used unblocked proxy', () => {
      const proxies = [
        balancer._init({}),
        balancer._init({}),
        balancer._init({})
      ];

      // recently used
      proxies[0].usedDateTime = Date.now();
      // blocked
      proxies[1].unblockDateTime = Date.now() + 60000;

      // should return proxies[2]
      const next = balancer._next(proxies);
      expect(next).to.be.equal(proxies[2]);
      expect(next.usedDateTime).to.be.gt(0);
    });

    it('should return least used available proxy when all proxies are blocked', () => {
      const proxies = [
        balancer._init({}),
        balancer._init({})
      ];

      // recently used and blocked
      proxies[0].usedDateTime = Date.now();
      proxies[0].unblockDateTime = Date.now() + 60000;
      // blocked
      proxies[1].usedDateTime = 0;
      proxies[1].unblockDateTime = Date.now() + 60000;

      // should return proxies[1]
      const next = balancer._next(proxies);

      expect(next).to.be.equal(proxies[0]);
      expect(next.usedDateTime).to.be.gt(0);
    });
  });
});
