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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          function_name: string | null
          id: string
          input_hash: string | null
          model: string | null
          operation_type: string
          output_preview: string | null
          prompt_tokens: number | null
          session_id: string | null
          status: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          function_name?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          operation_type: string
          output_preview?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          status?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          function_name?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          operation_type?: string
          output_preview?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          status?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          license_number: string | null
          organization: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          license_number?: string | null
          organization?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          license_number?: string | null
          organization?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_transcripts: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          is_corrected: boolean | null
          processing_time_ms: number | null
          session_id: string
          speaker: string
          text: string
          timestamp_offset: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_corrected?: boolean | null
          processing_time_ms?: number | null
          session_id: string
          speaker: string
          text: string
          timestamp_offset?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_corrected?: boolean | null
          processing_time_ms?: number | null
          session_id?: string
          speaker?: string
          text?: string
          timestamp_offset?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          appointment_type: string | null
          chief_complaint: string | null
          clinical_codes: Json | null
          created_at: string
          generated_note: string | null
          id: string
          input_language: string
          note_json: Json | null
          output_language: string
          patient_dob: string | null
          patient_id: string | null
          patient_name: string
          scheduled_at: string | null
          status: string
          summary: string | null
          template_id: string | null
          total_words: number | null
          transcript_quality_avg: number | null
          transcription_duration_seconds: number | null
          updated_at: string
          user_id: string
          visit_mode: string | null
        }
        Insert: {
          appointment_type?: string | null
          chief_complaint?: string | null
          clinical_codes?: Json | null
          created_at?: string
          generated_note?: string | null
          id?: string
          input_language?: string
          note_json?: Json | null
          output_language?: string
          patient_dob?: string | null
          patient_id?: string | null
          patient_name: string
          scheduled_at?: string | null
          status?: string
          summary?: string | null
          template_id?: string | null
          total_words?: number | null
          transcript_quality_avg?: number | null
          transcription_duration_seconds?: number | null
          updated_at?: string
          user_id: string
          visit_mode?: string | null
        }
        Update: {
          appointment_type?: string | null
          chief_complaint?: string | null
          clinical_codes?: Json | null
          created_at?: string
          generated_note?: string | null
          id?: string
          input_language?: string
          note_json?: Json | null
          output_language?: string
          patient_dob?: string | null
          patient_id?: string | null
          patient_name?: string
          scheduled_at?: string | null
          status?: string
          summary?: string | null
          template_id?: string | null
          total_words?: number | null
          transcript_quality_avg?: number | null
          transcription_duration_seconds?: number | null
          updated_at?: string
          user_id?: string
          visit_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          session_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          session_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          session_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          role: string
          status: string
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_community: boolean
          is_shared: boolean
          name: string
          structure: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_community?: boolean
          is_shared?: boolean
          name: string
          structure?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_community?: boolean
          is_shared?: boolean
          name?: string
          structure?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string | null
          description: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          advanced_ai_reasoning: boolean | null
          auto_create_tasks: boolean | null
          auto_delete_days: number | null
          auto_suggest_codes: boolean | null
          beta_features_enabled: boolean | null
          compact_sidebar: boolean | null
          created_at: string
          dark_mode: boolean | null
          dashboard_filters: Json | null
          dashboard_layout: Json | null
          default_input_language: string | null
          default_output_language: string | null
          default_template_id: string | null
          email_notifications: boolean | null
          id: string
          multi_language_transcription: boolean | null
          preferred_coding_system: string | null
          search_history: Json | null
          session_summaries: boolean | null
          task_reminders: boolean | null
          updated_at: string
          user_id: string
          voice_commands: boolean | null
        }
        Insert: {
          advanced_ai_reasoning?: boolean | null
          auto_create_tasks?: boolean | null
          auto_delete_days?: number | null
          auto_suggest_codes?: boolean | null
          beta_features_enabled?: boolean | null
          compact_sidebar?: boolean | null
          created_at?: string
          dark_mode?: boolean | null
          dashboard_filters?: Json | null
          dashboard_layout?: Json | null
          default_input_language?: string | null
          default_output_language?: string | null
          default_template_id?: string | null
          email_notifications?: boolean | null
          id?: string
          multi_language_transcription?: boolean | null
          preferred_coding_system?: string | null
          search_history?: Json | null
          session_summaries?: boolean | null
          task_reminders?: boolean | null
          updated_at?: string
          user_id: string
          voice_commands?: boolean | null
        }
        Update: {
          advanced_ai_reasoning?: boolean | null
          auto_create_tasks?: boolean | null
          auto_delete_days?: number | null
          auto_suggest_codes?: boolean | null
          beta_features_enabled?: boolean | null
          compact_sidebar?: boolean | null
          created_at?: string
          dark_mode?: boolean | null
          dashboard_filters?: Json | null
          dashboard_layout?: Json | null
          default_input_language?: string | null
          default_output_language?: string | null
          default_template_id?: string | null
          email_notifications?: boolean | null
          id?: string
          multi_language_transcription?: boolean | null
          preferred_coding_system?: string | null
          search_history?: Json | null
          session_summaries?: boolean | null
          task_reminders?: boolean | null
          updated_at?: string
          user_id?: string
          voice_commands?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      session_analytics: {
        Row: {
          avg_confidence: number | null
          created_at: string | null
          duration: unknown
          id: string | null
          status: string | null
          total_characters: number | null
          transcript_segments: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          avg_transcript_quality: number | null
          completed_sessions: number | null
          completed_tasks: number | null
          last_session_date: string | null
          total_sessions: number | null
          total_tasks: number | null
          total_transcription_time: number | null
          total_words_transcribed: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_analytics: {
        Args: { target_user_id?: string }
        Returns: {
          avg_transcript_quality: number
          completed_sessions: number
          completed_tasks: number
          last_session_date: string
          total_sessions: number
          total_tasks: number
          total_transcription_time: number
          total_words_transcribed: number
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
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_session_analytics: { Args: never; Returns: undefined }
      refresh_user_analytics: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
