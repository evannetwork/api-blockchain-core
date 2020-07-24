const isBrowser = typeof window !== 'undefined';
// const vade = require(`./pkg_${isBrowser ? 'browser' : 'nodejs'}`);
const vade = require('../../../../../evan.network_rust/vade-tnt/pkg');

if (!isBrowser) {
  const fetch = require('node-fetch');
  const ws = require('ws');
  global.Headers = fetch.Headers;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Window = Object;
  global.fetch = fetch;
  global.WebSocket = ws;
}

class Vade {
  constructor(config) {
    return new Proxy(
      vade,
      {
        get: function (target, prop, receiver) {
          const rustProp = prop.replace(/([^A-Z])([A-Z])/g, '$1_$2').toLowerCase();
          const propValue = Reflect.get(target, rustProp, receiver);
          if (typeof propValue === 'function') {
            return (...args) => propValue(...args, config);
          } else if (typeof propValue === 'undefined') {
            throw new Error(`property "${prop}"/"${rustProp}" does not exist on vade`);
          } else {
            return propValue;
          }
        },
      },
    );
  }
}


module.exports = {
  Vade,
};

