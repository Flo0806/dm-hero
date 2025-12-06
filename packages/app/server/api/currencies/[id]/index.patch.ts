import { getDb } from '../../../utils/db'

interface UpdateCurrencyBody {
  code?: string
  name?: string
  symbol?: string
  exchange_rate?: number
  sort_order?: number
  is_default?: boolean
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateCurrencyBody>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Currency ID is required',
    })
  }

  // Get current currency to find campaign_id
  const current = db
    .prepare('SELECT campaign_id FROM currencies WHERE id = ?')
    .get(id) as { campaign_id: number } | undefined

  if (!current) {
    throw createError({
      statusCode: 404,
      message: 'Currency not found',
    })
  }

  // If setting as default, unset other defaults in same campaign
  if (body.is_default) {
    db.prepare('UPDATE currencies SET is_default = 0 WHERE campaign_id = ?').run(current.campaign_id)
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: unknown[] = []

  if (body.code !== undefined) {
    updates.push('code = ?')
    values.push(body.code.toUpperCase())
  }
  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.symbol !== undefined) {
    updates.push('symbol = ?')
    values.push(body.symbol)
  }
  if (body.exchange_rate !== undefined) {
    updates.push('exchange_rate = ?')
    values.push(body.exchange_rate)
  }
  if (body.sort_order !== undefined) {
    updates.push('sort_order = ?')
    values.push(body.sort_order)
  }
  if (body.is_default !== undefined) {
    updates.push('is_default = ?')
    values.push(body.is_default ? 1 : 0)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  values.push(id)
  db.prepare(`UPDATE currencies SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  // Return updated currency
  const updated = db.prepare('SELECT * FROM currencies WHERE id = ?').get(id)
  return updated
})
