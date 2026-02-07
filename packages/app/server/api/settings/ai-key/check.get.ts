import { hasAiKey } from '../../../utils/ai'

export default defineEventHandler(() => {
  return { hasKey: hasAiKey() }
})
