function transformMessages (port) {
  return new Proxy(port, {
    get(target, propKey, receiver) {
      const origMethod = target[propKey]

      if (propKey === 'postMessage') {
        return function (...args) {
          return origMethod.apply(target, args)
        }
      } else if (propKey === 'on') {
        return function (...args) {
          if (args[0] === 'message') {
            return origMethod.apply(target, ['message', function (msg) {
              args[1]({
                target: receiver,
                data: msg
              })
            }])
          }

          return origMethod.apply(target, args)
        }
      }

      return origMethod
    }
  })
}

function withWindowMock (script) {
  return `
    const { parentPort } = require('worker_threads');
    ${transformMessages.toString()}
    const window = transformMessages(parentPort);
    const self = window;
    ${script}
  `
}

module.exports = { transformMessages, withWindowMock }
