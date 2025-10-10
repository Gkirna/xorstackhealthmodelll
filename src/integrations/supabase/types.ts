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
          error: string | null
          id: string
          model: string | null
          operation_type: string
          prompt_tokens: number | null
          session_id: string | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          operation_type: string
          prompt_tokens?: number | null
          session_id?: string | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          operation_type?: string
          prompt_tokens?: number | null
          session_id?: string | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          id: string
          session_id: string
          speaker: string
          text: string
          timestamp_offset: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          speaker: string
          text: string
          timestamp_offset?: number | null
        }
        Update: {
          created_at?: string
          id?: string
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
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
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
