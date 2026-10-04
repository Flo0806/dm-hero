import type { GameTableHandout } from '~~/types/share'
import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { parseRecipients } from '../../../utils/share/handouts'

// Documents handed out at this table (for the DM's overview)
export default defineEventHandler((event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const rows = getDb().prepare(`
    SELECT h.id, h.document_id, h.recipients, h.created_at, d.title, d.file_type, e.id AS entity_id, e.name AS entity_name
    FROM game_table_handouts h
    JOIN entity_documents d ON d.id = h.document_id
    JOIN entities e ON e.id = d.entity_id
    WHERE h.game_table_id = ?
    ORDER BY h.created_at DESC
  `).all(tableId) as Array<Omit<GameTableHandout, 'recipients' | 'format'> & { recipients: string, file_type: string | null }>

  return rows.map(({ file_type, recipients, ...row }): GameTableHandout => ({
    ...row,
    format: file_type === 'pdf' ? 'pdf' : 'markdown',
    recipients: parseRecipients(recipients),
  }))
})
