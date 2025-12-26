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
  {
    id: 2,
    name: 'add_adventure_details',
    up: [
      // Add new adventure fields
      `ALTER TABLE adventures
        ADD COLUMN version_number INT NOT NULL DEFAULT 1 AFTER version,
        ADD COLUMN \`system\` VARCHAR(50) DEFAULT 'dnd5e',
        ADD COLUMN difficulty TINYINT DEFAULT 3,
        ADD COLUMN players_min TINYINT DEFAULT 3,
        ADD COLUMN players_max TINYINT DEFAULT 5,
        ADD COLUMN level_min TINYINT DEFAULT 1,
        ADD COLUMN level_max TINYINT DEFAULT 5,
        ADD COLUMN duration_hours DECIMAL(4,1) DEFAULT 4.0,
        ADD COLUMN highlights JSON,
        ADD COLUMN author_name VARCHAR(100),
        ADD COLUMN author_discord VARCHAR(100)`,

      // Drop old version column (we use version_number now)
      'ALTER TABLE adventures DROP COLUMN version',

      // Also update adventure_files to use integer version
      `ALTER TABLE adventure_files
        CHANGE COLUMN version version_number INT NOT NULL DEFAULT 1`,
    ],
  },
  {
    id: 3,
    name: 'add_email_verification_tokens',
    up: [
      // Email verification tokens
      `CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ],
  },
  {
    id: 4,
    name: 'add_user_favorites',
    up: [
      // User favorites / bookmarks for adventures
      `CREATE TABLE IF NOT EXISTS user_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        adventure_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_favorite (user_id, adventure_id),
        INDEX idx_user (user_id),
        INDEX idx_adventure (adventure_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ],
  },
  {
    id: 5,
    name: 'add_password_reset_tokens',
    up: [
      // Password reset tokens
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ],
  },
  {
    id: 6,
    name: 'add_adventure_validation_fields',
    up: [
      // validation_result stores JSON: { errors: [], warnings: [] }
      `ALTER TABLE adventures
        ADD COLUMN validation_result JSON NULL,
        ADD COLUMN validated_at TIMESTAMP NULL`,
    ],
  },
  {
    id: 7,
    name: 'add_original_filename',
    up: [
      // Store original filename from upload for content validation
      `ALTER TABLE adventure_files
        ADD COLUMN original_filename VARCHAR(255) NULL AFTER file_path`,
    ],
  },
  {
    id: 8,
    name: 'add_tos_acceptance',
    up: [
      // Track Terms of Service acceptance per user with version
      `CREATE TABLE IF NOT EXISTS tos_acceptances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tos_version VARCHAR(20) NOT NULL,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_version (tos_version),
        UNIQUE KEY unique_user_version (user_id, tos_version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Add tos_accepted_version to users for quick lookup
      `ALTER TABLE users
        ADD COLUMN tos_accepted_version VARCHAR(20) NULL,
        ADD COLUMN tos_accepted_at TIMESTAMP NULL`,
    ],
  },
  {
    id: 9,
    name: 'fix_rating_decimal',
    up: [
      // Change rating from TINYINT (integer, rounds 3.5 to 4) to DECIMAL(2,1) for half-star support
      `ALTER TABLE adventure_ratings
        MODIFY COLUMN rating DECIMAL(2,1) NOT NULL`,
    ],
  },
  {
    id: 10,
    name: 'add_published_file_version',
    up: [
      // Track which file version is currently published
      // This allows showing an adventure while a new version is pending review
      `ALTER TABLE adventures
        ADD COLUMN published_file_version INT NULL AFTER version_number`,

      // Migrate existing published adventures: set published_file_version = version_number
      `UPDATE adventures
        SET published_file_version = version_number
        WHERE status = 'published'`,
    ],
  },
  {
    id: 11,
    name: 'adventure_versions_table',
    up: [
      // Step 1: Create adventure_versions table with all content fields
      `CREATE TABLE adventure_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adventure_id INT NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        short_description VARCHAR(500),
        cover_image_url VARCHAR(500),
        \`system\` VARCHAR(50) DEFAULT 'dnd5e',
        difficulty TINYINT DEFAULT 3,
        players_min TINYINT DEFAULT 3,
        players_max TINYINT DEFAULT 5,
        level_min TINYINT DEFAULT 1,
        level_max TINYINT DEFAULT 5,
        duration_hours DECIMAL(4,1) DEFAULT 4.0,
        highlights JSON,
        tags JSON,
        price_cents INT DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'EUR',
        language VARCHAR(5) DEFAULT 'de',
        author_name VARCHAR(100),
        author_discord VARCHAR(100),
        status ENUM('draft', 'pending_review', 'published', 'rejected', 'archived') DEFAULT 'draft',
        validation_result JSON NULL,
        validated_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP NULL,
        INDEX idx_adventure (adventure_id),
        INDEX idx_status (status),
        UNIQUE KEY unique_adventure_version (adventure_id, version_number),
        FULLTEXT idx_search (title, description)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Step 2: Migrate existing adventures to adventure_versions
      `INSERT INTO adventure_versions (
        adventure_id, version_number, title, description, short_description, cover_image_url,
        \`system\`, difficulty, players_min, players_max, level_min, level_max, duration_hours,
        highlights, tags, price_cents, currency, language, author_name, author_discord,
        status, validation_result, validated_at, created_at, published_at
      )
      SELECT
        id, version_number, title, description, short_description, cover_image_url,
        \`system\`, difficulty, players_min, players_max, level_min, level_max, duration_hours,
        highlights, tags, price_cents, currency, language, author_name, author_discord,
        status, validation_result, validated_at, created_at, published_at
      FROM adventures`,

      // Step 3: Add version_id column to adventure_files (nullable first)
      'ALTER TABLE adventure_files ADD COLUMN version_id INT NULL AFTER adventure_id',

      // Step 4: Update adventure_files to point to the correct version
      `UPDATE adventure_files af
       JOIN adventure_versions av ON af.adventure_id = av.adventure_id AND af.version_number = av.version_number
       SET af.version_id = av.id`,

      // Step 5: Add published_version_id to adventures (nullable first)
      'ALTER TABLE adventures ADD COLUMN published_version_id INT NULL',

      // Step 6: Set published_version_id for adventures that have a published version
      `UPDATE adventures a
       JOIN adventure_versions av ON a.id = av.adventure_id AND av.status = 'published'
       SET a.published_version_id = av.id`,

      // Step 7: Drop old content columns from adventures
      // Keep: id, author_id, slug, download_count, published_version_id, created_at
      `ALTER TABLE adventures
        DROP COLUMN title,
        DROP COLUMN description,
        DROP COLUMN short_description,
        DROP COLUMN cover_image_url,
        DROP COLUMN version_number,
        DROP COLUMN published_file_version,
        DROP COLUMN \`system\`,
        DROP COLUMN difficulty,
        DROP COLUMN players_min,
        DROP COLUMN players_max,
        DROP COLUMN level_min,
        DROP COLUMN level_max,
        DROP COLUMN duration_hours,
        DROP COLUMN highlights,
        DROP COLUMN tags,
        DROP COLUMN price_cents,
        DROP COLUMN currency,
        DROP COLUMN language,
        DROP COLUMN author_name,
        DROP COLUMN author_discord,
        DROP COLUMN status,
        DROP COLUMN validation_result,
        DROP COLUMN validated_at,
        DROP COLUMN updated_at,
        DROP COLUMN published_at`,

      // Step 8: Drop adventure_id from adventure_files and make version_id required
      `ALTER TABLE adventure_files
        DROP FOREIGN KEY adventure_files_ibfk_1`,

      `ALTER TABLE adventure_files
        DROP COLUMN adventure_id`,

      `ALTER TABLE adventure_files
        MODIFY COLUMN version_id INT NOT NULL`,

      // Step 9: Add foreign keys
      `ALTER TABLE adventure_versions
        ADD CONSTRAINT fk_version_adventure
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE`,

      `ALTER TABLE adventure_files
        ADD CONSTRAINT fk_file_version
        FOREIGN KEY (version_id) REFERENCES adventure_versions(id) ON DELETE CASCADE`,

      // Step 10: Drop old indexes from adventures that reference removed columns
      'ALTER TABLE adventures DROP INDEX idx_status',
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
