module.exports = server => {
  server.redefine = (event, fn) => {
    const listeners = server.listeners(event);

    server.removeAllListeners(event);

    server.once(event, fn);
    server.once(event, () => {
      server.removeAllListeners(event);
      listeners.forEach(v => {
        server.on(event, v);
      });
    });
  };
  return server;
};
