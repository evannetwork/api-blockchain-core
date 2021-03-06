const requiree = require;
const isBrowser = typeof window !== 'undefined';
const vade = requiree(`./pkg-${isBrowser ? 'browser' : 'nodejs'}`);

if (!isBrowser) {
  const fetch = requiree('node-fetch');
  const ws = requiree('ws');
  global.Headers = fetch.Headers;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Window = Object;
  global.fetch = fetch;
  global.WebSocket = ws;
}

class Vade {
  /**
   * Creates new `Vade` instance.
   *
   * @param      {string}  config.logLevel  (optional) sets log level, if provided also enables
   *                                        panic hook
   * @param      {string}  config.signer    (optional) signer to use, supports 'local' and 'remote'
   * @param      {string}  config.target    (optional) substrate IP
   * @return     {Vade}   new `Vade` instance
   */
  constructor(config = {}) {
    const functionConfig = {
      signer: config.signer || 'local',
      target: config.target || '13.69.59.185',
    };
    const proxy = new Proxy(
      vade,
      {
        get: (target, prop, receiver) => {
          const rustProp = prop.replace(/([^A-Z])([A-Z])/g, '$1_$2').toLowerCase();
          const propValue = Reflect.get(target, rustProp, receiver);
          if (typeof propValue === 'function') {
            return (...args) => propValue(...args, functionConfig);
          }
          if (typeof propValue === 'undefined') {
            throw new Error(`property "${prop}"/"${rustProp}" does not exist on vade`);
          }
          return propValue;
        },
      },
    );

    if (config.logLevel) {
      vade.set_panic_hook();
      vade.set_log_level(config.logLevel);
    }

    return proxy;
  }
}

module.exports = {
  Vade,
};
