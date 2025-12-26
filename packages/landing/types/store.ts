// Adventure Store Types

// Base adventure (identity only - after migration 11)
export interface Adventure {
  id: number
  author_id: number
  slug: string
  download_count: number
  published_version_id: number | null
  created_at: string
}

// Adventure version (all content fields)
export interface AdventureVersion {
  id: number
  adventure_id: number
  version_number: number
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  system: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  highlights: string[] | string | null
  tags: string[] | string | null
  price_cents: number
  currency: string
  language: string
  author_name: string | null
  author_discord: string | null
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
  validation_result: string | null
  validated_at: string | null
  created_at: string
  published_at: string | null
}

// Combined view for public display (adventure + published version + author)
export interface AdventureWithVersion extends Adventure {
  // From adventure_versions (published version)
  version_id: number
  version_number: number
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  system: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  highlights: string[] | string | null
  tags: string[] | string | null
  price_cents: number
  currency: string
  language: string
  author_name: string | null
  author_discord: string | null
  published_at: string | null
  // From users
  display_name: string
  // Computed
  avg_rating: number
  rating_count: number
}

export interface AdventureFile {
  id: number
  version_id: number
  file_path: string
  original_filename: string | null
  file_size: number
  version_number: number
  checksum: string | null
  created_at: string
}

export interface AdventureRating {
  id: number
  adventure_id: number
  user_id: number
  rating: number
  review: string | null
  created_at: string
  updated_at: string
}

// API Response types
export interface AdventureListResponse {
  adventures: AdventureWithVersion[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdventureDetailResponse {
  adventure: AdventureWithVersion & {
    author: string
    highlights: string[]
    tags: string[]
  }
  files: Pick<AdventureFile, 'id' | 'file_path' | 'file_size' | 'version_number'>[]
}

// Profile view - shows all versions for owner
export interface AdventureWithAllVersions extends Adventure {
  display_name: string
  versions: AdventureVersion[]
  // Latest version info for quick display
  latest_version: AdventureVersion | null
  published_version: AdventureVersion | null
}
