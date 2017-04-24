const Balancer = require('./core/balancer');

const STATUS_CODES = [200, 201, 202, 404];

module.exports = () => new Balancer()
  .onNext((proxies) => {
    if (proxies.length === 0) return null;
    const now = Date.now();

    const unblocked = proxies.filter(p => p.unblockDateTime < now);
    const usable = unblocked.length > 0 ? unblocked : proxies;

    const proxy = usable.sort(p => p.usedDateTime)[0];
    proxy.usedDateTime = Date.now();

    return proxy;
  })
  .onAdd((proxy) => {
    proxy.blockCount = 0;
    proxy.unblockDateTime = 0;
    proxy.usedDateTime = 0;
    return proxy;
  })
  .onResponse((proxy, response) => {
    if (STATUS_CODES.some(c => c === response.statusCode)) {
      proxy.blockCount = 0;
      proxy.unblockDateTime = 0;
    } else {
      if (proxy.blockCount < 10) {
        proxy.blockCount += 1;
      }
      proxy.unblockDateTime = Date.now() + Math.pow(proxy.blockCount + 2, 3);
    }
  })
  .onError((proxy) => {
    if (proxy.blockCount < 10) {
      proxy.blockCount += 1;
    }
    proxy.unblockDateTime = Date.now() + Math.pow(proxy.blockCount + 2, 3);
  });
