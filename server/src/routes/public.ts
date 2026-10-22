/* Read-only JSON for anything outside the pages that wants ELIA's news, events and publications (an app, a feed). */
import { Router } from 'express'
import { posts, events, publications } from '../content.js'
import { wrap, pageNumber } from '../util.js'

export const publicApi = Router()

publicApi.get('/news', wrap((req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 9) || 9, 1), 50)
  const page = pageNumber(req.query.page)
  const cat = typeof req.query.category === 'string' ? req.query.category : undefined
  const r = posts({ category: cat, limit, offset: (page - 1) * limit })
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json({ total: r.total, page, items: r.items.map(({ body: _b, ...p }) => p) })
}))

publicApi.get('/events', wrap((req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json({ items: events({ past: req.query.past === '1' }) })
}))

publicApi.get('/publications', wrap((_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json({ items: publications() })
}))
