import { SHARE_KINDS } from '../../utils/share/registry'

// Which fields each share type offers - the UI shows exactly these (one list, on the server)
export default defineEventHandler(() =>
  Object.fromEntries(Object.entries(SHARE_KINDS).map(([type, kind]) => [type, kind!.fields])),
)
