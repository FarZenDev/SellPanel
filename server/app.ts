import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z, ZodError } from 'zod'
import type { Backup, Meta } from '../shared/types.ts'
import { createAuth } from './auth.ts'
import { getSecret } from './db.ts'
import { seedDemo } from './demo.ts'
import {
  buildCreateSchema,
  buildPatchSchema,
  bulkSchema,
  categoryCreateSchema,
  categoryPatchSchema,
  expenseCreateSchema,
  expensePatchSchema,
  itemCreateSchema,
  itemPatchSchema,
  lotCreateSchema,
  lotPatchSchema,
  platformCreateSchema,
  platformPatchSchema,
  settingsSchema,
} from './schemas.ts'
import { HttpError, Store } from './store.ts'

export interface AppOptions {
  store: Store
  password?: string
  staticDir?: string
}

const idParam = (req: Request, name = 'id') => {
  const id = Number(req.params[name])
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide')
  return id
}

const importRowSchema = itemCreateSchema.extend({
  purchase_platform_name: z.string().max(80).optional(),
  sale_platform_name: z.string().max(80).optional(),
  category_name: z.string().max(80).optional(),
})

export function createApp({ store, password, staticDir }: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback, linklocal, uniquelocal')

  const secret = process.env.SESSION_SECRET || getSecret(store.db, '_session_secret', () => crypto.randomBytes(32).toString('hex'))
  const auth = createAuth(password, secret)

  app.use(express.json({ limit: '50mb' }))

  // ─── Authentification ────────────────────────────────────────────────────
  app.get('/api/auth/status', (req, res) => {
    res.json({ enabled: auth.enabled, authenticated: auth.isAuthenticated(req) })
  })
  app.post('/api/auth/login', (req, res) => {
    const pwd = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!auth.login(req, res, pwd)) {
      res.status(401).json({ error: 'Mot de passe incorrect (ou trop de tentatives, réessayez dans une minute).' })
      return
    }
    res.json({ ok: true })
  })
  app.post('/api/auth/logout', (_req, res) => {
    auth.logout(res)
    res.json({ ok: true })
  })

  app.use('/api', auth.guard)
  app.use('/uploads', auth.guard, express.static(store.uploadsDir, { maxAge: '30d', immutable: true }))

  // ─── Méta & paramètres ───────────────────────────────────────────────────
  app.get('/api/meta', (_req, res) => {
    const meta: Meta = { platforms: store.listPlatforms(), categories: store.listCategories(), settings: store.settings, auth: auth.enabled }
    res.json(meta)
  })
  app.put('/api/settings', (req, res) => {
    res.json(store.updateSettings(settingsSchema.parse(req.body)))
  })

  app.get('/api/platforms', (_req, res) => res.json(store.listPlatforms()))
  app.post('/api/platforms', (req, res) => res.status(201).json(store.createPlatform(platformCreateSchema.parse(req.body))))
  app.patch('/api/platforms/:id', (req, res) => res.json(store.updatePlatform(idParam(req), platformPatchSchema.parse(req.body))))
  app.delete('/api/platforms/:id', (req, res) => {
    store.deletePlatform(idParam(req))
    res.status(204).end()
  })

  app.get('/api/categories', (_req, res) => res.json(store.listCategories()))
  app.post('/api/categories', (req, res) => res.status(201).json(store.createCategory(categoryCreateSchema.parse(req.body))))
  app.patch('/api/categories/:id', (req, res) => res.json(store.updateCategory(idParam(req), categoryPatchSchema.parse(req.body))))
  app.delete('/api/categories/:id', (req, res) => {
    store.deleteCategory(idParam(req))
    res.status(204).end()
  })

  // ─── Articles ────────────────────────────────────────────────────────────
  app.get('/api/items', (_req, res) => res.json(store.listItems()))
  app.get('/api/items/:id', (req, res) => res.json(store.getItemDetail(idParam(req))))
  app.post('/api/items', (req, res) => res.status(201).json(store.createItem(itemCreateSchema.parse(req.body))))
  app.patch('/api/items/:id', (req, res) => res.json(store.updateItem(idParam(req), itemPatchSchema.parse(req.body))))
  app.delete('/api/items/:id', (req, res) => {
    store.deleteItem(idParam(req))
    res.status(204).end()
  })
  app.post('/api/items/:id/duplicate', (req, res) => res.status(201).json(store.duplicateItem(idParam(req))))
  app.post('/api/items/bulk', (req, res) => {
    const { ids, action, value } = bulkSchema.parse(req.body)
    res.json({ count: store.bulkItems(ids, action, value) })
  })
  app.post('/api/items/import', (req, res) => {
    const rows = z.array(importRowSchema).max(5000).parse(req.body?.items)
    res.json({ count: store.importItems(rows) })
  })

  // ─── PC montés ───────────────────────────────────────────────────────────
  app.get('/api/builds', (_req, res) => res.json(store.listBuilds()))
  app.get('/api/builds/:id', (req, res) => res.json(store.getBuildDetail(idParam(req))))
  app.post('/api/builds', (req, res) => res.status(201).json(store.createBuild(buildCreateSchema.parse(req.body))))
  app.patch('/api/builds/:id', (req, res) => res.json(store.updateBuild(idParam(req), buildPatchSchema.parse(req.body))))
  app.delete('/api/builds/:id', (req, res) => {
    store.deleteBuild(idParam(req))
    res.status(204).end()
  })
  app.post('/api/builds/:id/components', (req, res) => {
    const { item_id } = z.object({ item_id: z.number().int().positive() }).parse(req.body)
    res.json(store.attachComponent(idParam(req), item_id))
  })
  app.delete('/api/builds/:id/components/:itemId', (req, res) => {
    res.json(store.detachComponent(idParam(req), idParam(req, 'itemId')))
  })
  app.post('/api/builds/:id/dismantle', (req, res) => res.json(store.dismantleBuild(idParam(req))))

  // ─── Lots ────────────────────────────────────────────────────────────────
  app.get('/api/lots', (_req, res) => res.json(store.listLots()))
  app.get('/api/lots/:id', (req, res) => res.json(store.getLotDetail(idParam(req))))
  app.post('/api/lots', (req, res) => res.status(201).json(store.createLot(lotCreateSchema.parse(req.body))))
  app.patch('/api/lots/:id', (req, res) => res.json(store.updateLot(idParam(req), lotPatchSchema.parse(req.body))))
  app.delete('/api/lots/:id', (req, res) => {
    store.deleteLot(idParam(req), req.query.items === '1')
    res.status(204).end()
  })
  app.post('/api/lots/:id/allocate', (req, res) => {
    const id = idParam(req)
    store.reallocateLot(id, true)
    res.json(store.getLotDetail(id))
  })

  // ─── Dépenses ────────────────────────────────────────────────────────────
  app.get('/api/expenses', (_req, res) => res.json(store.listExpenses()))
  app.post('/api/expenses', (req, res) => res.status(201).json(store.createExpense(expenseCreateSchema.parse(req.body))))
  app.patch('/api/expenses/:id', (req, res) => res.json(store.updateExpense(idParam(req), expensePatchSchema.parse(req.body))))
  app.delete('/api/expenses/:id', (req, res) => {
    store.deleteExpense(idParam(req))
    res.status(204).end()
  })

  // ─── Activité, photos, sauvegarde ────────────────────────────────────────
  app.get('/api/events', (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30))
    res.json(store.recentEvents(limit))
  })

  fs.mkdirSync(store.uploadsDir, { recursive: true })
  const upload = multer({
    storage: multer.diskStorage({
      destination: store.uploadsDir,
      filename: (_req, file, cb) => {
        const ext =
          path
            .extname(file.originalname)
            .toLowerCase()
            .replace(/[^.a-z0-9]/g, '') || '.jpg'
        cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`)
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
  })
  app.post('/api/uploads', upload.array('files', 20), (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    res.status(201).json({ files: files.map((f) => f.filename) })
  })

  app.get('/api/backup', (_req, res) => {
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Disposition', `attachment; filename="sellpanel-sauvegarde-${date}.json"`)
    res.json(store.backup())
  })
  app.post('/api/restore', (req, res) => {
    store.restore(req.body as Backup)
    res.json({ ok: true })
  })
  app.post('/api/demo', (_req, res) => {
    const counts = store.counts()
    if (counts.items + counts.builds + counts.lots > 0) throw new HttpError(409, 'Les données de démonstration ne peuvent être chargées que sur une base vide.')
    seedDemo(store)
    res.json({ ok: true })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route inconnue' })
  })

  // ─── Front-end compilé (production) ──────────────────────────────────────
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }))
    app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const first = err.issues[0]
      const where = first?.path.length ? `${first.path.join('.')} : ` : ''
      res.status(400).json({ error: `${where}${first?.message ?? 'Données invalides'}`, issues: err.issues })
      return
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (15 Mo max.)' : err.message })
      return
    }
    const e = err as { type?: string; status?: number; message?: string }
    if (e?.type === 'entity.too.large' || e?.type === 'entity.parse.failed') {
      res.status(e.status ?? 400).json({ error: e.type === 'entity.too.large' ? 'Requête trop volumineuse' : 'JSON invalide' })
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    if (/UNIQUE constraint/i.test(message)) {
      res.status(409).json({ error: 'Cette valeur existe déjà.' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  })

  return app
}
