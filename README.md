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

## How to play

If you want a simple standalone proxy balancer from command line check out [proxy-supervisor-cli](https://github.com/vladislao/proxy-supervisor-cli) or [dockerized proxy-supervisor](https://hub.docker.com/r/chugunov/docker-proxy-supervisor). 

## Usage

Just initialize a balancer and add some proxies.

```javascript
const http = require("http");
const { balancer } = require("proxy-supervisor");

const awesomeBalancer = balancer().add([
  "http://SOME_PROXY:38403",
  "http://OTHER_PROXY:61637"
]);
```

Great! Now let's get it to work. Create a middleware and put it in your route. To simplify example, we will use plain http server.

```javascript
http
  .createServer(awesomeBalancer.proxy())
  .on("connect", awesomeBalancer.connect())
  .listen(3000);
```

Awesome! Next step is to set your balancing server as a proxy server wherever you want to use proxies. This server will proxy requests using specified list of proxies. The final trace will look like that _(you) -> (balancer) -> (proxy) -> (endpoint)_.

Finding proxies and adding them by hand is painful. Even more, you will probably want to remove dead ones. To simplify that process you can use _sources_. Let's add a few sources.

```javascript
const { balancer } = require("proxy-supervisor");
const source = require("ps-free-proxy-list");

const awesomeBalancer = balancer().subscribe(source);
```

Done! Sources will automatically replenish your balancer with new proxies. You should be able to find more sources on [github](https://github.com/). So, what about unreachable proxies? Let's add a monitor to filter them out!

```javascript
const { monitor } = require("proxy-supervisor");
awesomeBalancer.subscribe(monitor({ target: "http://YOUR_IP:3001" }));
```

Monitor will trigger for every 5 minutes and remove proxies, that didn't respond with successful status code. Best practice would be to specify your own server, and make sure port is open.

```javascript
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end();
  })
  .listen(3001);
```

You are not limited in the way you can use balancers. For example, you can have different balancers on different routes. Sources designed to work with multiple balancers.

```javascript
const express = require("experss");
const { balancer, monitor } = require("proxy-supervisor");
const source = require("ps-nordvpn");

const freeBalancer = balancer()
  .subscribe(source)
  .subscribe(monitor({ target: "http://YOUR_IP:3001" }));

const privateBalancer = balancer()
  .add(["http://SOME_PROXY:38403", "http://OTHER_PROXY:61637"])
  .subscribe(monitor);

const app = express()
  .use("/free", freeBalancer.proxy())
  .use("/private", privateBalancer.proxy())
  .on("connect", privateBalancer.connect());

app.listen(3000);
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

- Returns: _\<Function\>_

Creates a middleware function. Middleware has a signature of _(req, res, next)_. If _next_ function is provided, it will be called on response or error. Be aware that _res_ will be finished by then.

#### balancer.connect([options])

- **options** _\<Object\>_ Configuration details.

  - **timeout** _\<Integer\>_ Sets the socket to timeout after timeout milliseconds of inactivity. Defaults to 30 seconds.

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
