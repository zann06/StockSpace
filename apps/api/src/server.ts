import { buildApp } from './app.js'
import { config } from './lib/config.js'

const app = buildApp()

app
  .listen({ port: config.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`StockSpace API listening on ${address}`)
  })
  .catch((error) => {
    app.log.error({ err: error }, 'failed to start')
    process.exit(1)
  })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`received ${signal}, shutting down`)
    app.close().finally(() => process.exit(0))
  })
}
