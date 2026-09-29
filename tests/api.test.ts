import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createApp } from '../server/app.ts'
import { Store } from '../server/store.ts'

let server: Server
let base = ''
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sellpanel-'))

before(async () => {
  const store = new Store({ dbFile: ':memory:', uploadsDir: path.join(tmp, 'uploads') })
  server = createApp({ store }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const api = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

test('plateformes par défaut : Vinted, Leboncoin, eBay', async () => {
  const { body } = await api('GET', '/api/meta')
  const names = body.platforms.map((p: { name: string }) => p.name)
  for (const n of ['Vinted', 'Leboncoin', 'eBay']) assert.ok(names.includes(n))
})

test('cycle de vie : achat → PC → démontage → vente', async () => {
  const { body: meta } = await api('GET', '/api/meta')
  const vinted = meta.platforms.find((p: { name: string }) => p.name === 'Vinted')
  const created = await api('POST', '/api/items', { title: 'Ryzen 5 5600', purchase_platform_id: vinted.id, purchase_price: 80, purchase_date: '2026-01-10' })
  assert.equal(created.status, 201)
  assert.match(created.body.sku, /^SP-\d{4}$/)

  const build = await api('POST', '/api/builds', { name: 'PC test' })
  assert.equal(build.status, 201)
  assert.match(build.body.ref, /^PC-\d{3}$/)
  assert.ok(build.body.checklist.length > 5)

  const attached = await api('POST', `/api/builds/${build.body.id}/components`, { item_id: created.body.id })
  assert.equal(attached.body.components.length, 1)
  assert.equal(attached.body.components[0].status, 'in_build')

  const dismantled = await api('POST', `/api/builds/${build.body.id}/dismantle`)
  assert.equal(dismantled.body.status, 'dismantled')
  const item = await api('GET', `/api/items/${created.body.id}`)
  assert.equal(item.body.status, 'in_stock')
  assert.equal(item.body.build_id, null)

  const sold = await api('PATCH', `/api/items/${created.body.id}`, { status: 'sold', sale_price: 110, sale_platform_id: vinted.id })
  assert.equal(sold.body.status, 'sold')
  assert.ok(sold.body.sale_date)
  const detail = await api('GET', `/api/items/${created.body.id}`)
  assert.ok(detail.body.events.some((e: { type: string }) => e.type === 'sold'))
})

test('lot : coût réparti au prorata de la valeur', async () => {
  const lot = await api('POST', '/api/lots', {
    name: 'PC complet',
    price: 300,
    shipping: 0,
    fees: 0,
    items: [
      { title: 'CPU', target_price: 100 },
      { title: 'GPU', target_price: 200 },
    ],
  })
  assert.equal(lot.status, 201)
  const prices = lot.body.items.map((i: { purchase_price: number }) => i.purchase_price)
  assert.deepEqual(prices, [100, 200])
  const updated = await api('PATCH', `/api/lots/${lot.body.id}`, { price: 150 })
  assert.deepEqual(
    updated.body.items.map((i: { purchase_price: number }) => i.purchase_price),
    [50, 100],
  )
})

test('validation : titre obligatoire et statut invalide', async () => {
  assert.equal((await api('POST', '/api/items', { title: '' })).status, 400)
  assert.equal((await api('POST', '/api/items', { title: 'x', status: 'nope' })).status, 400)
})

test('plateforme utilisée : suppression refusée', async () => {
  const { body: meta } = await api('GET', '/api/meta')
  const vinted = meta.platforms.find((p: { name: string }) => p.name === 'Vinted')
  assert.equal((await api('DELETE', `/api/platforms/${vinted.id}`)).status, 409)
  const created = await api('POST', '/api/platforms', { name: 'Back Market', color: '#123456' })
  assert.equal(created.status, 201)
  assert.equal((await api('DELETE', `/api/platforms/${created.body.id}`)).status, 204)
})

test('sauvegarde puis restauration', async () => {
  const { body: backup } = await api('GET', '/api/backup')
  assert.equal(backup.version, 1)
  await api('POST', '/api/items', { title: 'Temporaire' })
  assert.equal((await api('POST', '/api/restore', backup)).status, 200)
  const { body: items } = await api('GET', '/api/items')
  assert.equal(items.length, backup.items.length)
})

test('données de démonstration', async () => {
  const store = new Store({ dbFile: ':memory:', uploadsDir: path.join(tmp, 'u2') })
  const app = createApp({ store }).listen(0)
  await new Promise((r) => app.once('listening', r))
  const url = `http://127.0.0.1:${(app.address() as AddressInfo).port}`
  const res = await fetch(`${url}/api/demo`, { method: 'POST' })
  assert.equal(res.status, 200)
  assert.ok(store.listItems().length > 30)
  assert.equal(store.listBuilds().length, 3)
  app.close()
})
