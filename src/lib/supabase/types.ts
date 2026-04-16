export type PostStatus = 'pending_review' | 'approved' | 'rejected' | 'published' | 'failed'
export type ContentType = 'reel' | 'carousel'
export type Platform = 'instagram' | 'tiktok' | 'x_thread' | 'x_video'
export type TrendSource = 'youtube' | 'reddit' | 'tiktok' | 'google_trends'

export interface Post {
  id: string
  status: PostStatus
  type: ContentType
  drive_url: string
  scheduled_at: string | null
  created_at: string
}

export interface PostVariant {
  id: string
  post_id: string
  platform: Platform
  caption: string | null
  hashtags: string[] | null
  media_url: string | null
  approved: boolean
}

export interface Performance {
  id: string
  post_id: string
  platform: Platform
  views: number
  likes: number
  saves: number
  shares: number
  impressions: number
  reach: number
  fetched_at: string
}

export interface NicheTrend {
  id: string
  source: TrendSource
  topic: string
  score: number | null
  raw_data: Record<string, unknown> | null
  fetched_at: string
}

export interface ScheduleConfig {
  id: string
  day_of_week: number
  content_type: ContentType
  preferred_hour: number
  active: boolean
}

export interface Database {
  public: {
    Tables: {
      posts: { Row: Post; Insert: Omit<Post, 'id' | 'created_at'>; Update: Partial<Post> }
      post_variants: { Row: PostVariant; Insert: Omit<PostVariant, 'id'> & { approved?: boolean }; Update: Partial<PostVariant> }
      performance: { Row: Performance; Insert: Omit<Performance, 'id' | 'fetched_at'>; Update: Partial<Performance> }
      niche_trends: { Row: NicheTrend; Insert: Omit<NicheTrend, 'id' | 'fetched_at'>; Update: Partial<NicheTrend> }
      schedule_config: { Row: ScheduleConfig; Insert: Omit<ScheduleConfig, 'id'> & { active?: boolean }; Update: Partial<ScheduleConfig> }
    }
  }
}
