const expect = require('chai').expect;
const ProxySupervisor = require('../../lib/supervisor');

describe('Proxy Supervisor', () => {
  describe('from', () => {
    it('should load proxies from file', () => {
      expect(() => {
        new ProxySupervisor().from('./test/proxy.txt');
      }).to.not.throw(TypeError);
    });
    it('should load proxies via function', () => {
      const loadProxies = () => ['http://localhost:23451'];
      expect(() => {
        new ProxySupervisor().from(loadProxies);
      }).to.not.throw(TypeError);
    });
    it('should load proxies via async function', () => {
      const loadProxies = async () => ['http://localhost:23451'];
      expect(() => {
        new ProxySupervisor().from(loadProxies);
      }).to.not.throw(TypeError);
    });
    it('should load proxies via Promise', () => {
      expect(() => {
        new ProxySupervisor().from(new Promise((res, rej) => { res(['http://localhost:23451']); }));
      }).to.not.throw(TypeError);
    });

    it('should throw TypeError otherwise', () => {
      expect(() => {
        new ProxySupervisor().from({});
      }).to.throw(TypeError);

      expect(() => {
        new ProxySupervisor().from(123);
      }).to.throw(TypeError);

      expect(() => {
        new ProxySupervisor().from(null);
      }).to.throw(TypeError);

      expect(() => {
        new ProxySupervisor().from();
      }).to.throw(TypeError);
    });
  });

  describe('initialize', () => {
    it('should load proxies', async () => {
      const supervisor = new ProxySupervisor()
        .from('./test/proxy.txt');

      expect(supervisor.started).to.be.false;
      expect(supervisor.sources).to.be.not.empty;
      expect(supervisor.proxies).to.be.empty;

      await supervisor.initialize();

      expect(supervisor.started).to.be.true;
      expect(supervisor.proxies).to.be.not.empty;
    });

    it('should load proxies from different sources', async () => {
      const supervisor = new ProxySupervisor()
        .from('./test/proxy.txt')
        .from(() => ['http://localhost:23452']);

      await supervisor.initialize();

      expect(supervisor.proxies.length).to.be.eql(2);
    });

    it('should merge proxies from different sources', async () => {
      const supervisor = new ProxySupervisor()
        .from('./test/proxy.txt')
        .from(() => ['http://localhost:23451']);

      await supervisor.initialize();

      expect(supervisor.proxies.length).to.be.eql(1);
    });

    it('should throw when source is broken', (done) => {
      const supervisor = new ProxySupervisor()
        .from('./test/' + Math.random().toString(36).substring(7))
        .from(() => ['http://localhost:23451']);

      supervisor.initialize().then(() => {
        done('Exception not thrown');
      }, (e) => {
        expect(e.code).to.be.eql('ENOENT');
        done();
      });
    });

    it('should not call refresh again when refreshInterval is not specified', (done) => {
      const supervisor = new ProxySupervisor()
        .from(() => ['http://localhost:23451']);

      supervisor.initialize().then(() => {
        supervisor.refresh = () => {
          done('refresh is called again');
        };
      });

      setTimeout(done, 50);
    });

    it('should call refresh again when refreshInterval is specified', (done) => {
      const supervisor = new ProxySupervisor({ refreshInterval: 50 })
        .from(() => ['http://localhost:23451']);

      supervisor.initialize().then(() => {
        supervisor.refresh = () => { done(); };
      });

      setTimeout(() => { done('refresh is not called again'); }, 500);
    });
  });

  describe('proxy', () => {
    // it('should throw if initialize is not called', () => {
    //   const supervisor = new ProxySupervisor()
    //     .from(() => ['http://localhost:23451']);

    //   const fn = supervisor.proxy();
    //   expect(() => fn()).to.throw(Error);
    // });

    it('should return middleware', async () => {
      const supervisor = new ProxySupervisor()
        .from(() => ['http://localhost:23451']);

      await supervisor.initialize();

      const fn = supervisor.proxy();
      expect(typeof fn).to.be.equal('function');
    });
  });
});
