import { getLogPath, getLogDir } from '~~/server/utils/logger'

export default defineEventHandler(() => {
  return {
    logPath: getLogPath(),
    logDir: getLogDir(),
  }
})
