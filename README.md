# proxy-supervisor
Refresh, monitor and balance your proxies


## Installation

```bash
$ npm install proxy-supervisor
```

## Features

  * Robust balancing
  * Monitoring, replenishment
  * HTTP, HTTPS, tunnels
  * Designed to support multiple proxy sources
  * High performance
  * High test coverage

## How to play

  If you want simple standalone proxy balancer from command line check out [proxy-supervisor-cli](https://github.com/vladislao/proxy-supervisor-cli)

## Usage

  Just initialize a balancer and add some proxies. Specified addresses are for example purposes only.

  ```javascript
  const http = require('http');
  const balancer = require('proxy-supervisor').balancer;

  const awesomeBalancer = balancer()
   .add(['http://10.0.0.1:3001', 'http://10.0.0.2:3001']);
  ```

  Great! Now let's get it to work. Create a middleware and put it in your route. To simplify example, we will use plain http server.

  ```javascript
  http.createServer(awesomeBalancer.proxy()).listen(3000);
  ```

  Awesome! Next step is to set your balancing server as a proxy server wherever you want to use proxies. This server will proxy requests using specified list of proxies. The final trace will look like that *(you) -> (balancer) -> (proxy) -> (endpoint)*.

  Finding proxies and adding them by hand is painful. Even more, you will probably want to remove dead ones. To simplify that process you can use *sources*. Let's add a few sources.

  ```javascript
  const balancer = require('proxy-supervisor').balancer;
  const source1 = require('ps-free-proxy-list');
  const source2 = require('ps-nordvpn');

  const awesomeBalancer = balancer().subscribe(source1).subscribe(source2);
  ```

  Done! Sources will automatically replenish your balancer with new proxies. You should be able to find more sources on [github](https://github.com/). So, what about unreachable proxies? Let's add a monitor to filter them out!

  ```javascript
  const monitor = require('proxy-supervisor').monitor;
  awesomeBalancer.subscribe(monitor);
  ```

  Monitor will trigger for every 5 minutes and remove proxies, that didn't respond with successful status code. By default all requests are made to [requestb.in](http://requestb.in/). Best practice would be to specify your own server, to make sure that proxies are realy unavailable and it's not just endpoint failure.

  You are not limited in the way you can use balancers. For example, you can have different balancers on different routes. Sources designed to work with multiple balancers.

  ```javascript
  const express = require('experss');
  const { balancer, monitor } = require('proxy-supervisor');
  const source = require('ps-nordvpn');

  const freeBalancer = balancer()
   .subscribe(source)
   .subscribe(monitor);

  const privateBalancer = balancer()
   .add(['https://10.0.0.1:3001', 'https://10.0.0.2:3001'])
   .subscribe(monitor);

  const app = express()
   .use('/free', freeBalancer.proxy())
   .use('/private', privateBalancer.proxy())

  app.listen(3000);
  ```

## Design

### Balancer

  A balancer is responsible for iterating over the list of proxies. Balancing across multiple proxy servers is a commonly used technique for minimizing the chance of blocking and increasing anonymity level.

  Each instance has its own list of proxies, which is controlled by sources. Balancer is not responsible for invalidating proxies.

#### balancer.add(proxies)
  * **proxies** *\<Array\> | \<Url\> | \<String\>* List of proxy servers to be added.
  * Returns: *this*.

  Adds specified proxies to the list of current balancer.

#### balancer.remove(proxies)
  * **proxies** *\<Array\> | \<Url\> | \<String\>* List of proxy servers to be added.
  * Returns: *this*.

  Removes specified proxies from the list of current balancer.

#### balancer.subscribe(source)
  * **source** *\<Source\>* Source to listen.
  * Returns: *this*.

  Subscribes to specified source.

#### balancer.proxy([options])
  * **options** *\<Object\>* Options containing connection details. Check [request](https://github.com/request/request#requestoptions-callback) for the format of the options.
  * Returns: *\<Function\>*

  Creates a middleware function. Middleware has a signature of *(req, res, next)*.

#### balancer.onNext(callback)
  * **callback** *\<Function\>* Callback function that returns a next proxy to be used.

  You can specify your own balancing algorithm. Callback has a signature of *(proxies)* and should return a single *\<Url\>* from list.

#### balancer.onAdd(callback)
  * **callback** *\<Function\>* Callback function that returns a new proxy.

  Callback will be called each time a new proxy is added to the list. Callback has a signature of *(proxy)* and should return *\<Object\>*. A good place to set default parameters for a new proxy.

#### balancer.onResponse(callback)
  * **callback** *\<Function\>* Callback function that handles response statuses.

  Callback has a signature of *(proxy, res)* and will be called each time a request is completed. State of proxy can be modified.

#### balancer.onError(callback)
  * **callback** *\<Function\>* Callback function that handles request errors.

  Callback has a signature of *(proxy, err)* and will be called each time a request resulted in error. State of proxy can be modified.


### Source

  Should be used to modify the list of proxies for its listeners. The most common use case - collecting proxies from some site
  and adding them to listeners.

#### source.addListener(listener)
  * **listener** *\<Balancer\>* A balancer which will be added to list of listeners.
  * Returns: *this*

  Method simply attaches a balancer to the source.

#### source.proxies()
  * Returns: *\<Array\>* Returns list of unique proxy urls.

  Helper function to retrieve list of proxies from all listeners. Proxies are unique across array and represented as [*\<Url\>*](https://nodejs.org/api/url.html#url_url_strings_and_url_objects).

### Monitor

  Particular case of the *Source*. A monitor is responsible for filtering dead and slow proxies out from balancers.

#### new Monitor([options])
  * **options** *\<Object\>* Set of configurable options to set on the monitor. Can have the following fields:
  	* **interval** *\<Integer\>* Specifies how much time should pass after last check is completed. Defaults to 5 minutes.
  	* **options** *\<Object\>* Options containing connection details. Check [request](https://github.com/request/request#requestoptions-callback) for the format of the options. You probably want to specify your own **target** or **timeout**. By default all requests will be sent to [requestb.in](http://requestb.in/).

  Monitor is started automatically on creation, and will trigger for the first time after specified **interval** is passed.

#### monitor.start()

  Starts a monitor. Use only in case you have stopped monitor manually. Monitor is started automatically on creation and can work with empty list of listeners.

#### monitor.stop()

  Stops a monitor. It will clear current timer, but already running check will be not affected.

#### monitor.check()
  * Returns: *\<Promise\>* A promise, which resolves into an array of dead proxies. Those proxies are already removed from listeners.

  Validates proxies. This method will create parallel requests to the target location for each proxy. Timed out, unreachable or blocked proxies will be removed from all listeners. By default valid status codes are *200, 201, 202*.

#### monitor.onResponse(callback)
  You can specify your own handler for proxies. Callback should have a signature of *(err, proxy, res, body)* and return *true* for valid proxy and *false* otherwise.

## Examples

  To view the examples, clone the repo and install the dependencies:

```bash
$ git clone git@github.com:Vladislao/proxy-supervisor.git
$ cd proxy-supervisor
$ npm install
```

  Then run whichever example you want:

```bash
$ node examples/monitor
```

## Tests

  To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ npm test
```

## License

  [MIT](LICENSE)
