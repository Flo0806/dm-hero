import { getDb } from '../../utils/db'
import { getShareDefaults, saveShareDefaults } from '../../utils/share/defaults'
import { getShareKind } from '../../utils/share/registry'

// Remember ticks as default for a share type (only fields that type offers)
export default defineEventHandler(async (event) => {
  const body = await readBody<{ type?: string, fields?: string[] }>(event)
  const kind = getShareKind(String(body?.type))
  const fields = Array.isArray(body?.fields) ? kind.fields.filter(f => body!.fields!.includes(f)) : []

  const db = getDb()
  saveShareDefaults(db, { ...getShareDefaults(db), [body!.type!]: fields })
  return { success: true }
})
