import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { Store } from './store.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Variables d'environnement optionnelles depuis un fichier .env à la racine.
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'))
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(root, 'data'))
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production')

const store = new Store({ dbFile: path.join(dataDir, 'sellpanel.db'), uploadsDir: path.join(dataDir, 'uploads') })
const app = createApp({
  store,
  password: process.env.APP_PASSWORD || undefined,
  staticDir: production ? path.join(root, 'dist') : undefined,
})

const server = app.listen(port, host, () => {
  const url = `http://localhost:${port}`
  console.log(`\n  SellPanel ${production ? '' : 'API '}prêt sur ${url}`)
  console.log(`  Données : ${dataDir}`)
  if (!process.env.APP_PASSWORD) console.log('  ⚠ Aucun mot de passe (APP_PASSWORD) : ne pas exposer sur Internet.\n')
})

const shutdown = () => {
  server.close(() => {
    store.db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
