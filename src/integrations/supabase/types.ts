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
      activities: {
        Row: {
          created_at: string
          distance_km: number
          id: string
          points_earned: number | null
          transport_type: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_km: number
          id?: string
          points_earned?: number | null
          transport_type: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number
          id?: string
          points_earned?: number | null
          transport_type?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "intra_company_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
          threshold_km: number | null
          transport_type: string | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
          threshold_km?: number | null
          transport_type?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
          threshold_km?: number | null
          transport_type?: string | null
        }
        Relationships: []
      }
      blocked_email_domains: {
        Row: {
          created_at: string
          domain: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          reason?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          allowed_email_domain: string
          created_by: string | null
          id: string
          join_code: string
          name: string
          public_slug: string
          total_points: number | null
        }
        Insert: {
          allowed_email_domain: string
          created_by?: string | null
          id?: string
          join_code?: string
          name: string
          public_slug: string
          total_points?: number | null
        }
        Update: {
          allowed_email_domain?: string
          created_by?: string | null
          id?: string
          join_code?: string
          name?: string
          public_slug?: string
          total_points?: number | null
        }
        Relationships: []
      }
      join_attempts: {
        Row: {
          attempted_at: string
          attempted_code: string
          id: string
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          attempted_code: string
          id?: string
          success?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          attempted_code?: string
          id?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          points_per_km: number
          transport_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          points_per_km: number
          transport_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          points_per_km?: number
          transport_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "intra_company_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string | null
          id: string
          name: string
          total_points: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          id: string
          name: string
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          id?: string
          name?: string
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_leaderboard: {
        Row: {
          global_rank: number | null
          id: string | null
          name: string | null
          public_slug: string | null
          total_points: number | null
        }
        Relationships: []
      }
      intra_company_leaderboard: {
        Row: {
          company_id: string | null
          company_rank: number | null
          name: string | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      public_user_leaderboard: {
        Row: {
          company_id: string | null
          company_name: string | null
          company_slug: string | null
          global_rank: number | null
          name: string | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_company: {
        Args: {
          _allowed_email_domain: string
          _name: string
          _public_slug: string
        }
        Returns: {
          allowed_email_domain: string
          created_by: string | null
          id: string
          join_code: string
          name: string
          public_slug: string
          total_points: number | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_join_code: { Args: never; Returns: string }
      get_company_by_slug: {
        Args: { _slug: string }
        Returns: {
          active_member_count: number
          avg_points: number
          company_id: string
          global_rank: number
          member_count: number
          name: string
          public_slug: string
          total_points: number
        }[]
      }
      get_company_leaderboard: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          active_member_count: number
          avg_points: number
          company_id: string
          member_count: number
          name: string
          public_slug: string
          rank: number
          total_points: number
        }[]
      }
      get_company_user_leaderboard: {
        Args: { _company_id: string; _limit?: number; _offset?: number }
        Returns: {
          name: string
          rank: number
          total_points: number
          user_id: string
        }[]
      }
      get_my_rank: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_rank: number
          company_total: number
          global_rank: number
          global_total: number
          name: string
          total_points: number
          user_id: string
        }[]
      }
      get_top_users: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          company_id: string
          company_name: string
          company_slug: string
          name: string
          rank: number
          total_points: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_company: {
        Args: { _join_code: string }
        Returns: {
          allowed_email_domain: string
          created_by: string | null
          id: string
          join_code: string
          name: string
          public_slug: string
          total_points: number | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_company: { Args: never; Returns: undefined }
      log_multi_modal_trip: { Args: { _segments: Json }; Returns: string }
      set_company_join_code: {
        Args: { _company_id: string; _new_code: string }
        Returns: {
          allowed_email_domain: string
          created_by: string | null
          id: string
          join_code: string
          name: string
          public_slug: string
          total_points: number | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "user" | "company_admin" | "platform_admin"
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
    Enums: {
      app_role: ["user", "company_admin", "platform_admin"],
    },
  },
} as const
