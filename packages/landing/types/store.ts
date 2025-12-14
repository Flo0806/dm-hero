// Adventure Store Types

export interface Adventure {
  id: number
  author_id: number
  title: string
  slug: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  version_number: number
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
  download_count: number
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
  language: string
  created_at: string
  published_at: string | null
  author_name: string | null
  author_discord: string | null
}

export interface AdventureWithAuthor extends Adventure {
  display_name: string
  avg_rating: number
  rating_count: number
}

export interface AdventureFile {
  id: number
  adventure_id: number
  file_path: string
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
  adventures: AdventureWithAuthor[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdventureDetailResponse {
  adventure: AdventureWithAuthor & {
    author: string
    highlights: string[]
    tags: string[]
  }
  files: Pick<AdventureFile, 'id' | 'file_path' | 'file_size' | 'version_number'>[]
}
