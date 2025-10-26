import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Campaign name is required',
    })
  }

  const result = db.prepare(`
    INSERT INTO campaigns (name, description)
    VALUES (?, ?)
  `).run(name, description || null)

  const campaign = db.prepare(`
    SELECT * FROM campaigns WHERE id = ?
  `).get(result.lastInsertRowid)

  return campaign
})
