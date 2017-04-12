const STATUS_CODES = [200, 201, 202, 404];
/*
 * Default proxy balancing strategy.
*/

/*
 * Returns one proxy from array `proxies`.
 * Basically, this function handles proxy balancing.
*/
const next = (proxies) => {
  const now = Date.now();
  let available = proxies.filter(p => p.available && p.unblockDateTime < now);
  if (available.length === 0) available = proxies.filter(p => p.available);
  if (available.length === 0) return null;

  const proxy = available.sort(p => p.usedDateTime)[0];
  proxy.usedDateTime = Date.now();

  return proxy;
};

/*
 * Called each time when new proxy is created.
*/
const onInit = (proxy) => {
  proxy.blockCount = 0;
  proxy.unblockDateTime = 0;
  proxy.usedDateTime = 0;
  proxy.available = true;

  return proxy;
};

/*
 * Called each time when response for proxied request is received.
*/
const onResponse = (proxy, response) => {
  if (STATUS_CODES.some(c => c === response.statusCode)) {
    proxy.blockCount = 0;
    proxy.unblockDateTime = 0;
  } else {
    if (proxy.blockCount < 10) {
      proxy.blockCount += 1;
    }
    proxy.unblockDateTime = Date.now() + ((proxy.blockCount + 2) ** 3);
  }

  return proxy;
};

/*
 * Called each time when error in stream is occured.
*/
const onError = (proxy, error) => proxy;

/*
 * Called each time when proxy validation is occured.
*/
const onValidation = (proxy, available) => {
  proxy.available = available;
  return proxy;
};

module.exports.next = next;
module.exports.onInit = onInit;
module.exports.onResponse = onResponse;
module.exports.onError = onError;
module.exports.onValidation = onValidation;
