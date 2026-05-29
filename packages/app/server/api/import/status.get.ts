import { getImportSignal } from '../../utils/importSignal'

/**
 * Returns the latest AI/MCP bulk-import signal. The app polls this so it can
 * show a snackbar + refresh after an external (AI) import. `seq` increments per
 * committed import; the client reacts when it sees `seq` advance.
 */
export default defineEventHandler(() => getImportSignal())
