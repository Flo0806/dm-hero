import { getDb } from '../utils/db'
import { runMigrations } from '../utils/migrations'

export default defineNitroPlugin(async () => {
  console.log('🗄️  Initializing database...')

  const db = getDb()

  // Run migrations
  await runMigrations(db)

  console.log('✅ Database ready')
})
