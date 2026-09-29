import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const COOKIE = 'sp_session'
const MAX_AGE_MS = 30 * 24 * 3600 * 1000

export interface Auth {
  enabled: boolean
  isAuthenticated(req: Request): boolean
  login(req: Request, res: Response, password: string): boolean
  logout(res: Response): void
  guard(req: Request, res: Response, next: NextFunction): void
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

/**
 * Protection optionnelle par mot de passe (variable d'environnement APP_PASSWORD).
 * Session sans état : cookie signé HMAC, HttpOnly, valable 30 jours.
 */
export function createAuth(password: string | undefined, secret: string): Auth {
  const enabled = !!password
  const key = crypto
    .createHash('sha256')
    .update(`${secret}:${password ?? ''}`)
    .digest()
  const sign = (payload: string) => crypto.createHmac('sha256', key).update(payload).digest('base64url')
  const attempts = new Map<string, { count: number; until: number }>()

  const isAuthenticated = (req: Request) => {
    if (!enabled) return true
    const token = parseCookies(req.headers.cookie)[COOKIE]
    if (!token) return false
    const [issued, sig] = token.split('.')
    if (!issued || !sig || !safeEqual(sign(issued), sig)) return false
    const ts = Number(issued)
    return Number.isFinite(ts) && Date.now() - ts < MAX_AGE_MS
  }

  return {
    enabled,
    isAuthenticated,
    login(req, res, attempt) {
      if (!enabled) return true
      const ip = req.ip ?? 'unknown'
      const state = attempts.get(ip)
      if (state && state.count >= 5 && state.until > Date.now()) return false
      if (!safeEqual(attempt, password!)) {
        const count = (state && state.until > Date.now() ? state.count : 0) + 1
        attempts.set(ip, { count, until: Date.now() + 60_000 })
        return false
      }
      attempts.delete(ip)
      const issued = String(Date.now())
      const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
      res.cookie(COOKIE, `${issued}.${sign(issued)}`, { httpOnly: true, sameSite: 'lax', secure, maxAge: MAX_AGE_MS, path: '/' })
      return true
    },
    logout(res) {
      res.clearCookie(COOKIE, { path: '/' })
    },
    guard(req, res, next) {
      if (isAuthenticated(req)) return next()
      res.status(401).json({ error: 'Authentification requise' })
    },
  }
}
