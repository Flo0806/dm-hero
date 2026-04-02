import { createBackup } from '../utils/db'

export default defineEventHandler(() => {
  const backupPath = createBackup()

  if (!backupPath) {
    throw createError({ statusCode: 400, message: 'No database to backup' })
  }

  return { success: true, path: backupPath }
})
