const { version } = require('../package.json')
const url = require('url')
const { Worker } = require('worker_threads')
const micro = require('micro')
const cors = require('micro-cors')()
const Web3 = require('web3')
const {
  default: Wrapper,
  providers
} = require('@aragon/wrapper')
const got = require('got')
const { WorkerPool } = require('./WorkerPool')
const { transformMessages, withWindowMock } = require('./browser-mocks')

const ORGANISATION_WORKERS = new WorkerPool()
const APP_WORKERS = new WorkerPool()

async function addAppWorker (orgAddress, app) {
  // TODO: Reliable URL concatenation
  const scriptUrl = url.resolve(
    process.env.IPFS_GATEWAY || 'https://ipfs.eth.aragon.network/ipfs/',
    app.content.location + '/' + app.script
  )

  const connectApp = await ORGANISATION_WORKERS
    .getWorker(orgAddress)
    .worker.runApp(app.proxyAddress)

  // If the app has been updated, then we clear the current cache,
  // stop the app worker and start a new one from scratch.
  if (app.updated && APP_WORKERS.hasWorker(app.proxyAddress)) {
    const { connection } = APP_WORKERS.getWorker(app.proxyAddress)
    connection.shutdownAndClearCache()

    APP_WORKERS.removeWorker(app.proxyAddress)
  }

  if (!APP_WORKERS.hasWorker(app.proxyAddress)) {
    const { body: script } = await got(scriptUrl)
    const worker = new Worker(withWindowMock(script), {
      eval: true
    })

    worker.on('exit', (exitCode) => {
      console.log(`Worker for ${app.proxyAddress} exited with code ${exitCode}. Restarting.`)

      // The app worker crashed, so we'll just remove it and create a new one.
      APP_WORKERS.removeWorker(app.proxyAddress)
      addAppWorker(orgAddress, app)
    })

    const provider = new providers.MessagePortMessage(
      transformMessages(worker)
    )
    APP_WORKERS.addWorker(app.proxyAddress, worker, {
      app,
      connection: connectApp(provider)
    })
  }
}

async function addOrganisationWorker (orgAddress) {
  // Start Aragon wrapper for organisation
  const worker = new Wrapper(orgAddress, {
    provider: new Web3.providers.WebsocketProvider(
      process.env.ETH_NODE || 'wss://mainnet.eth.aragon.network/ws'
    ),
    apm: {
      ensRegistryAddress: process.env.ENS_REGISTRY_ADDRESS || '0x314159265dd8dbb310642f98f50c066173c1259b',
      ipfs: {
        gateway: process.env.IPFS_GATEWAY || 'https://ipfs.eth.aragon.network/ipfs'
      }
    }
  })
  await worker.init()

  // Add organisation worker
  ORGANISATION_WORKERS.addWorker(
    orgAddress,
    worker
  )

  // Listen for apps and start app workers accordingly
  worker.apps.subscribe((apps) => {
    apps
      .filter((app) => app.script)
      .filter((app) => app.content.provider === 'ipfs')
      .filter((app) => app.updated || !APP_WORKERS.hasWorker(app.proxyAddress))
      .forEach((app) => {
        addAppWorker(orgAddress, app)
      })
  })
}

async function serveState (req, res) {
  const path = url.parse(req.url).pathname.replace('/', '').toLowerCase()

  // It's a DAO (probably™️)
  if (path.startsWith('0x')) {
    let hit = ORGANISATION_WORKERS.hasWorker(path)
    if (!hit) {
      try {
        await addOrganisationWorker(path)
      } catch (err) {
        console.log(`Could not start worker for organisation ${path}. Error:\n${err.toString()}`)
        return {
          hit,
          error: true,
          cache: {}
        }
      }
    }

    const { worker } = await ORGANISATION_WORKERS.getWorker(path)
    return {
      hit,
      cache: await worker.cache.getAll()
    }
  }

  // TODO: Add some actual health stats
  return {
    status: 'ok',
    version: `Feather ${version}`
  }
}

micro(cors(serveState)).listen(3000)
