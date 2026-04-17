export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      niche_trends: {
        Row: {
          fetched_at: string | null
          id: string
          raw_data: Json | null
          score: number | null
          source: string
          topic: string
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          raw_data?: Json | null
          score?: number | null
          source: string
          topic: string
        }
        Update: {
          fetched_at?: string | null
          id?: string
          raw_data?: Json | null
          score?: number | null
          source?: string
          topic?: string
        }
        Relationships: []
      }
      performance: {
        Row: {
          fetched_at: string | null
          id: string
          impressions: number | null
          likes: number | null
          platform: string
          post_id: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          platform: string
          post_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          fetched_at?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          platform?: string
          post_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_variants: {
        Row: {
          approved: boolean | null
          caption: string | null
          hashtags: string[] | null
          id: string
          media_url: string | null
          platform: string
          post_id: string | null
        }
        Insert: {
          approved?: boolean | null
          caption?: string | null
          hashtags?: string[] | null
          id?: string
          media_url?: string | null
          platform: string
          post_id?: string | null
        }
        Update: {
          approved?: boolean | null
          caption?: string | null
          hashtags?: string[] | null
          id?: string
          media_url?: string | null
          platform?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string | null
          drive_url: string
          id: string
          scheduled_at: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string | null
          drive_url: string
          id?: string
          scheduled_at?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string | null
          drive_url?: string
          id?: string
          scheduled_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      schedule_config: {
        Row: {
          active: boolean | null
          content_type: string
          day_of_week: number
          id: string
          preferred_hour: number
        }
        Insert: {
          active?: boolean | null
          content_type: string
          day_of_week: number
          id?: string
          preferred_hour: number
        }
        Update: {
          active?: boolean | null
          content_type?: string
          day_of_week?: number
          id?: string
          preferred_hour?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ── Legacy type aliases (derived from generated types) ────────────────────────
export type PostStatus = 'pending_review' | 'approved' | 'rejected' | 'published' | 'failed'
export type ContentType = 'reel' | 'carousel'
export type Platform = 'instagram' | 'tiktok' | 'x_thread' | 'x_video'
export type TrendSource = 'youtube' | 'reddit' | 'tiktok' | 'google_trends' | 'claude'

export type Post = Tables<'posts'>
export type PostVariant = Tables<'post_variants'>
export type Performance = Tables<'performance'>
export type NicheTrend = Tables<'niche_trends'>
export type ScheduleConfig = Tables<'schedule_config'>
