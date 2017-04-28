const http = require('http');
const { expect, spy } = require('chai');
const promisify = require('js-promisify');

const balancer = require('../../lib/balancer');
const Monitor = require('../../lib/monitor');

const makeProxy = require('../tools/test_proxy');
const makeEndserver = require('../tools/test_endserver');

const GOOD_PROXY = 'http://127.0.0.1:23450/';
const BAD_PROXY = 'http://127.0.0.1:23451/';
const UNEXISTING_PROXY = 'http://127.0.0.1:23453/';

describe('Monitor', function () {
  this.timeout(30000);

  const goodProxy = makeProxy(http);
  const badProxy = makeProxy(http, (req, res) => setTimeout(() => { res.end('NOT OK'); }, 3000));
  const target = makeEndserver(http);

  before(() => Promise.all([
    promisify(goodProxy.listen, [23450, '127.0.0.1'], goodProxy),
    promisify(badProxy.listen, [23451, '127.0.0.1'], badProxy),
    promisify(target.listen, [23452, '127.0.0.1'], target)
  ]));

  after(() => Promise.all([
    promisify(goodProxy.close, [], goodProxy),
    promisify(badProxy.close, [], badProxy),
    promisify(target.close, [], target)
  ]));

  process.on('exit', () => {
    try {
      return Promise.all([
        promisify(goodProxy.close, [], goodProxy),
        promisify(badProxy.close, [], badProxy),
        promisify(target.close, [], target)
      ]);
    } catch (e) {
      return Promise.reject(e);
    }
  });

  it('should be started after creation', (done) => {
    const monitor = new Monitor({ interval: 0 });
    const check = spy.on(monitor, 'check');

    setTimeout(() => {
      monitor.stop();

      expect(check).to.be.spy;
      expect(check).to.have.been.called();
      done();
    }, 30);
  });

  it('should check periodically even if empty', (done) => {
    const monitor = new Monitor({ interval: 0 });
    const check = spy.on(monitor, 'check');

    setTimeout(() => {
      monitor.stop();

      expect(check).to.be.spy;
      expect(check).to.have.been.called.gt(2);
      done();
    }, 30);
  });

  it.skip('should not trigger stack overflow', (done) => {
    const monitor = new Monitor({ interval: 0 });
    const check = spy.on(monitor, 'check');

    const interval = setInterval(() => {
      if (check.__spy.calls.length > 12000) {
        monitor.stop();
        done();
        clearInterval(interval);
      }
    }, 100);
  });

  describe('.check', () => {
    it('should not remove working proxies', () => {
      const monitor = new Monitor({ target: { method: 'GET', uri: 'http://127.0.0.1:23452', timeout: 30, headers: { 'request-chain': '(s)' } }, interval: 0 });
      monitor.stop();

      const listener = balancer()
        .add([GOOD_PROXY])
        .subscribe(monitor);
      const remove = spy.on(listener, 'remove');

      return monitor.check().then((arr) => {
        expect(arr).to.be.empty;

        expect(remove).to.be.spy;
        expect(remove).to.have.not.been.called();

        expect(listener.proxies.size).to.be.eql(1);
      });
    });

    it('should remove proxy when connection from proxy to target server timed out', () => {
      const monitor = new Monitor({ target: { method: 'GET', uri: 'http://127.0.0.1:23452', timeout: 30, headers: { 'request-chain': '(s)' } }, interval: 0 });
      monitor.stop();

      const listener = balancer()
        .add([BAD_PROXY])
        .subscribe(monitor);
      const remove = spy.on(listener, 'remove');

      return monitor.check().then((arr) => {
        expect(arr.length).to.be.eql(1);

        expect(remove).to.be.spy;
        expect(remove).to.have.been.called();

        expect(listener.proxies.size).to.be.eql(0);
      });
    });

    it('should remove proxy when connection to proxy server timed out', () => {
      const monitor = new Monitor({ target: { method: 'GET', uri: 'http://127.0.0.1:23452', timeout: 30, headers: { 'request-chain': '(s)' } }, interval: 0 });
      monitor.stop();

      const listener = balancer()
        .add([UNEXISTING_PROXY])
        .subscribe(monitor);
      const remove = spy.on(listener, 'remove');

      return monitor.check().then((arr) => {
        expect(arr.length).to.be.eql(1);

        expect(remove).to.be.spy;
        expect(remove).to.have.been.called();

        expect(listener.proxies.size).to.be.eql(0);
      });
    });

    it('should work with multiple listeners', () => {
      const monitor = new Monitor({ target: { method: 'GET', uri: 'http://127.0.0.1:23452', timeout: 30, headers: { 'request-chain': '(s)' } }, interval: 0 });
      monitor.stop();

      const listener1 = balancer()
        .add([GOOD_PROXY])
        .subscribe(monitor);
      const listener2 = balancer()
        .add([GOOD_PROXY, UNEXISTING_PROXY])
        .subscribe(monitor);
      const listener3 = balancer()
        .add([BAD_PROXY])
        .subscribe(monitor);

      const remove1 = spy.on(listener1, 'remove');
      const remove2 = spy.on(listener2, 'remove');
      const remove3 = spy.on(listener3, 'remove');

      return monitor.check().then((arr) => {
        expect(arr.length).to.be.eql(2);

        expect(remove1).to.have.been.called();
        expect(remove2).to.have.been.called();
        expect(remove3).to.have.been.called();

        expect(listener1.proxies.size).to.be.eql(1);
        expect(listener2.proxies.size).to.be.eql(1);
        expect(listener3.proxies.size).to.be.eql(0);
      });
    });
  });

  describe('.onResponse', () => {
    it('should apply custom logic', () => {
      const monitor = new Monitor({ target: { method: 'GET', uri: 'http://127.0.0.1:23452', timeout: 30, headers: { 'request-chain': '(s)' } }, interval: 0 });
      monitor.stop();
      // we assume that every proxy is good enough
      monitor.onResponse(() => true);

      const listener = balancer()
        .add([BAD_PROXY])
        .subscribe(monitor);

      const remove = spy.on(listener, 'remove');

      return monitor.check().then((arr) => {
        expect(arr.length).to.be.eql(0);
        expect(remove).to.not.have.been.called();
        expect(listener.proxies.size).to.be.eql(1);
      });
    });
  });
});
