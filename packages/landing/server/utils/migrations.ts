import { getPool } from './db'

interface Migration {
  id: number
  name: string
  up: string[]
}

const migrations: Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    up: [
      // Users table for authentication
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        avatar_url VARCHAR(500),
        role ENUM('user', 'creator', 'admin') DEFAULT 'user',
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Refresh tokens for JWT auth
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_token (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Adventures in the store
      `CREATE TABLE IF NOT EXISTS adventures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        short_description VARCHAR(500),
        cover_image_url VARCHAR(500),
        version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        price_cents INT DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'EUR',
        download_count INT DEFAULT 0,
        status ENUM('draft', 'pending_review', 'published', 'rejected', 'archived') DEFAULT 'draft',
        language VARCHAR(5) DEFAULT 'de',
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        published_at TIMESTAMP NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_author (author_id),
        INDEX idx_slug (slug),
        FULLTEXT idx_search (title, description)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Adventure files (.dmhero files)
      `CREATE TABLE IF NOT EXISTS adventure_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adventure_id INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NOT NULL,
        version VARCHAR(20) NOT NULL,
        checksum VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        INDEX idx_adventure (adventure_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Adventure ratings
      `CREATE TABLE IF NOT EXISTS adventure_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adventure_id INT NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL,
        review TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_rating (adventure_id, user_id),
        INDEX idx_adventure (adventure_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // User downloads tracking
      `CREATE TABLE IF NOT EXISTS user_downloads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        adventure_id INT NOT NULL,
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_adventure (adventure_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ],
  },
]

export async function runMigrations(): Promise<void> {
  const pool = getPool()

  // Create migrations table if not exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Get applied migrations
  const [rows] = await pool.execute('SELECT id FROM migrations')
  const appliedIds = new Set((rows as { id: number }[]).map((r) => r.id))

  // Run pending migrations
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue
    }

    console.log(`[Migration] Running: ${migration.id} - ${migration.name}`)

    try {
      // Execute all statements in the migration
      for (const sql of migration.up) {
        await pool.execute(sql)
      }

      await pool.execute('INSERT INTO migrations (id, name) VALUES (?, ?)', [
        migration.id,
        migration.name,
      ])
      console.log(`[Migration] Completed: ${migration.id} - ${migration.name}`)
    } catch (error) {
      console.error(`[Migration] Failed: ${migration.id} - ${migration.name}`, error)
      throw error
    }
  }

  console.log('[Migration] All migrations completed')
}
