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
      clients: {
        Row: {
          birth_date: string | null
          birthplace: string | null
          clinical_notes: string | null
          consent_given_at: string | null
          consent_notes: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          id: string
          phone: string | null
          preferred_name: string | null
          presenting_complaint: string | null
          professional_id: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          birthplace?: string | null
          clinical_notes?: string | null
          consent_given_at?: string | null
          consent_notes?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          phone?: string | null
          preferred_name?: string | null
          presenting_complaint?: string | null
          professional_id: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          birthplace?: string | null
          clinical_notes?: string | null
          consent_given_at?: string | null
          consent_notes?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          preferred_name?: string | null
          presenting_complaint?: string | null
          professional_id?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      genogram_persons: {
        Row: {
          birth_date: string | null
          cause_of_death: string | null
          client_id: string
          created_at: string
          death_date: string | null
          full_name: string
          gender: string | null
          health_conditions: string[]
          id: string
          is_deceased: boolean
          is_proband: boolean
          life_events: Json
          notes: string | null
          occupation: string | null
          position_x: number
          position_y: number
          preferred_name: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cause_of_death?: string | null
          client_id: string
          created_at?: string
          death_date?: string | null
          full_name: string
          gender?: string | null
          health_conditions?: string[]
          id?: string
          is_deceased?: boolean
          is_proband?: boolean
          life_events?: Json
          notes?: string | null
          occupation?: string | null
          position_x?: number
          position_y?: number
          preferred_name?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cause_of_death?: string | null
          client_id?: string
          created_at?: string
          death_date?: string | null
          full_name?: string
          gender?: string | null
          health_conditions?: string[]
          id?: string
          is_deceased?: boolean
          is_proband?: boolean
          life_events?: Json
          notes?: string | null
          occupation?: string | null
          position_x?: number
          position_y?: number
          preferred_name?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "genogram_persons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      genogram_relationships: {
        Row: {
          client_id: string
          created_at: string
          end_date: string | null
          from_person_id: string
          id: string
          notes: string | null
          qualifier: string | null
          relationship_type: string
          start_date: string | null
          to_person_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_date?: string | null
          from_person_id: string
          id?: string
          notes?: string | null
          qualifier?: string | null
          relationship_type: string
          start_date?: string | null
          to_person_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_date?: string | null
          from_person_id?: string
          id?: string
          notes?: string | null
          qualifier?: string | null
          relationship_type?: string
          start_date?: string | null
          to_person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "genogram_relationships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genogram_relationships_from_person_id_fkey"
            columns: ["from_person_id"]
            isOneToOne: false
            referencedRelation: "genogram_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genogram_relationships_to_person_id_fkey"
            columns: ["to_person_id"]
            isOneToOne: false
            referencedRelation: "genogram_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns_detected: {
        Row: {
          acknowledged_at: string | null
          client_id: string
          created_at: string
          description: string | null
          details: Json
          id: string
          pattern_type: string
          person_ids: string[]
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          pattern_type: string
          person_ids?: string[]
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          pattern_type?: string
          person_ids?: string[]
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patterns_detected_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          email: string
          formation: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          email: string
          formation?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string
          formation?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "professional"
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
      app_role: ["admin", "professional"],
    },
  },
} as const
