import type { GameTableShare } from '~~/types/share'
import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { SHARE_KINDS } from '../../../utils/share/registry'

// Everything currently shared at this table (for the DM's overview)
export default defineEventHandler((event) => {
  const db = getDb()
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const rows = db.prepare('SELECT id, entity_type, entity_id, fields, display_name, created_at, updated_at FROM game_table_shares WHERE game_table_id = ? ORDER BY created_at DESC')
    .all(tableId) as Array<Omit<GameTableShare, 'fields' | 'title'> & { fields: string }>

  return rows.map((row): GameTableShare => {
    const fields = JSON.parse(row.fields) as string[]
    return { ...row, fields, title: SHARE_KINDS[row.entity_type]?.build(db, row.entity_id, fields, { tableId })?.title ?? null }
  })
})
