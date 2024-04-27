# proxy-supervisor

Refresh, monitor and balance your proxies

## Installation

```bash
$ npm install proxy-supervisor
```

## Features

- Robust balancing
- Monitoring, replenishment
- HTTP, HTTPS, tunnels
- Designed to support multiple proxy sources
- High performance
- High test coverage

## How to

For a straightforward standalone proxy balancer accessible via command line, explore [proxy-supervisor-cli](https://github.com/vladislao/proxy-supervisor-cli) or [dockerized proxy-supervisor](https://hub.docker.com/r/vladislaosan/proxy-supervisor). 

## Usage

Start by initializing a balancer and adding your proxies:

```javascript
const http = require("http");
const { balancer } = require("proxy-supervisor");

const awesomeBalancer = balancer().add([
  "http://SOME_PROXY:38403",
  "http://OTHER_PROXY:61637"
]);

// Now, integrate it into your application. Below, we set up a basic HTTP server using the balancer as middleware.

http
  .createServer(awesomeBalancer.proxy())
  .on("connect", awesomeBalancer.connect())
  .listen(3000);
```

Great! The next step is to configure your balancing server as the proxy server in any application that needs to use proxies. This setup will channel requests through the specified proxies, forming a path like _(you) -> (balancer) -> (proxy) -> (endpoint)_.

#### Authentication

In scenarios where a proxy requires authorization, use the _formatHeaders_ function. This function enables you to embed proxy credentials in the URL (e.g., https://login:password@MY_PROXY:3123) and set the appropriate authorization header. Here's how to implement it:

```javascript
const formatHeaders = (proxy, headers) => {
  if (!proxy.url.auth) return headers;
  return {
    ...headers,
    "Auth-Proxy":
      "Basic " + Buffer.from(proxy.url.auth).toString("base64"),
  };
};

http
  .createServer(balancer.proxy({ formatHeaders }))
  .on("connect", balancer.connect({ formatHeaders }))
  .listen(3000);
```

## Design

### Balancer

A balancer is responsible for iterating over the list of proxies. Balancing across multiple proxy servers is a commonly used technique for minimizing the chance of blocking and increasing anonymity level.

Each instance has its own list of proxies, which is controlled by sources. Balancer is not responsible for invalidating proxies.

#### balancer.add(proxies)

- **proxies** _\<Array\> | \<Url\> | \<String\>_ List of proxy servers to be added.
- Returns: _this_.

Adds specified proxies to the list of the current balancer.

#### balancer.remove(proxies)

- **proxies** _\<Array\> | \<Url\> | \<String\>_ List of proxy servers to be added.
- Returns: _this_.

Removes specified proxies from the list of the current balancer.

#### balancer.subscribe(source)

- **source** _\<Source\>_ Source to listen.
- Returns: _this_.

Subscribes to the specified source.

#### balancer.proxy([options])

- **options** _\<Object\>_ Configuration details.

  - **timeout** _\<Integer\>_ Sets the socket to timeout after timeout milliseconds of inactivity. Note that increasing the timeout beyond the OS-wide TCP connection timeout will not have any effect ([the default in Linux can be anywhere from 20-120 seconds](http://www.sekuda.com/overriding_the_default_linux_kernel_20_second_tcp_socket_connect_timeout)). Defaults to 30 seconds.
 
  - **formatHeaders** _\<Function\>_ This function is designed to modify headers before a request is sent through your proxy. It is commonly used for handling proxy authorization. The function signature is _(proxy, headers)_, and it must return an updated headers object.

- Returns: _\<Function\>_

Creates a middleware function. Middleware has a signature of _(req, res, next)_. If _next_ function is provided, it will be called on response or error. Be aware that _res_ will be finished by then.

#### balancer.connect([options])

- **options** _\<Object\>_ Configuration details.

  - **timeout** _\<Integer\>_ Sets the socket to timeout after timeout milliseconds of inactivity. Defaults to 30 seconds.

  - **formatHeaders** _\<Function\>_ This function is designed to modify headers before a request is sent through your proxy. It is commonly used for handling proxy authorization. The function signature is _(proxy, headers)_, and it must return an updated headers object.

- Returns: _\<Function\>_

Creates a handler for HTTP CONNECT method. [It is used to open a tunnel between client and proxy server](https://tools.ietf.org/html/rfc2817#section-5.2).

#### balancer.onNext(callback)

- **callback** _\<Function\>_ Callback function that returns a next proxy to be used.

You can specify your own balancing algorithm. Callback has a signature of _(proxies, url, req)_ and should return a single _\<Url\>_ from a list.

#### balancer.onAdd(callback)

- **callback** _\<Function\>_ Callback function that returns a new proxy.

Callback will be called each time a new proxy is added to the list. Callback has a signature of _(proxy)_ and should return _\<Object\>_. A good place to set default parameters for a new proxy.

#### balancer.onResponse(callback)

- **callback** _\<Function\>_ Callback function that handles response statuses.

Callback has a signature of _(proxy, url, res, req)_ and will be called each time a request is completed. State of the proxy can be modified.

#### balancer.onError(callback)

- **callback** _\<Function\>_ Callback function that handles request errors.

Callback has a signature of _(proxy, url, err, req)_ and will be called each time a request resulted in an error. State of the proxy can be modified.

### Source

Should be used to modify the list of proxies for its listeners. The most common use case - collecting proxies from some site
and adding them to listeners.

#### source.addListener(listener)

- **listener** _\<Balancer\>_ A balancer which will be added to the list of listeners.
- Returns: _this_

This method simply attaches a balancer to the source.

#### source.proxies()

- Returns: _\<Array\>_ Returns list of unique proxy urls.

Helper function to retrieve the list of proxies from all listeners. Proxies are unique across the array and represented as [_\<Url\>_](https://nodejs.org/api/url.html#url_url_strings_and_url_objects).

### Monitor

Particular case of the _Source_. A monitor is responsible for filtering dead and slow proxies out from balancers.

#### new Monitor([options])

- **options** _\<Object\>_ Set of configurable options to set on the monitor. Can have the following fields:
  - **target** _\<String\>_ specify path for the request to be done via proxies.
  - **timeout** _\<Integer\>_ Sets the socket to timeout after timeout milliseconds of inactivity. Defaults to 3 seconds.
  - **interval** _\<Integer\>_ Specifies how much time should pass after the last check is completed. Defaults to 5 minutes.

Monitor is started automatically on creation, and will trigger for the first time after the specified **interval** is passed.

#### monitor.start()

Starts a monitor. Use only in case you have stopped monitor manually. Monitor is started automatically on the creation and can work with an empty list of listeners.

#### monitor.stop()

Stops a monitor. It will clear current timer, but already running check will be not affected.

#### monitor.check()

- Returns: _\<Promise\>_ A promise, which resolves into an array of dead proxies. Those proxies are already removed from listeners.

Validates proxies. This method will create parallel requests to the target location for each proxy. Timed out, unreachable or blocked proxies will be removed from all listeners. By default, valid status codes are _200, 201, 202_.

#### monitor.onResponse(callback)

You can specify your own handler for proxies. Callback should have a signature of _(err, proxy, res, body)_ and return _true_ for valid proxy and _false_ otherwise.

## Example

To run the example, clone this repo and install its dependencies:

```bash
$ git clone git@github.com:Vladislao/proxy-supervisor.git
$ cd proxy-supervisor
```

Don't forget to modify your proxy.txt file. Grab any free proxies you can find.

Then run the example with:

```bash
$ node example
```

Here is a simple curl command to check your proxy server:

```bash
$ curl http://google.com -x http://localhost:9999
```

## Tests

To run the test suite, execute the following commands:

```bash
$ npm install
$ npm test
```

## License

[MIT](LICENSE)
