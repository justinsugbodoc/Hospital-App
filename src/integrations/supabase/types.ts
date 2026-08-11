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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      sugbodoc_admin_schedules: {
        Row: {
          clinic: string
          day: string
          doctor_id: string
          doctor_name: string
          enabled: boolean
          end_time: string
          id: string
          slots: number
          specialty: string
          start_time: string
          updated_at: string
        }
        Insert: {
          clinic: string
          day: string
          doctor_id: string
          doctor_name: string
          enabled?: boolean
          end_time: string
          id: string
          slots?: number
          specialty: string
          start_time: string
          updated_at?: string
        }
        Update: {
          clinic?: string
          day?: string
          doctor_id?: string
          doctor_name?: string
          enabled?: boolean
          end_time?: string
          id?: string
          slots?: number
          specialty?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      sugbodoc_appointments: {
        Row: {
          created_at: string
          data: Json
          date: string
          id: string
          reference: string
          status: string
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          date: string
          id: string
          reference: string
          status?: string
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          date?: string
          id?: string
          reference?: string
          status?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_audit_events: {
        Row: {
          action: string
          actor: string
          id: string
          target: string
          timestamp: string
        }
        Insert: {
          action: string
          actor: string
          id: string
          target: string
          timestamp?: string
        }
        Update: {
          action?: string
          actor?: string
          id?: string
          target?: string
          timestamp?: string
        }
        Relationships: []
      }
      sugbodoc_clinical_records: {
        Row: {
          appointment_id: string | null
          created_at: string
          data: Json
          encounter_id: string
          id: string
          patient_id: string
          record_type: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          data: Json
          encounter_id: string
          id: string
          patient_id: string
          record_type: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          data?: Json
          encounter_id?: string
          id?: string
          patient_id?: string
          record_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_clinical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_clinical_records_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_encounters: {
        Row: {
          appointment_id: string | null
          created_at: string
          data: Json
          encounter_date: string
          id: string
          patient_id: string
          reference: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          data: Json
          encounter_date: string
          id: string
          patient_id: string
          reference: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          data?: Json
          encounter_date?: string
          id?: string
          patient_id?: string
          reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_encounters_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_message_conversations: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_message_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_message_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_pharmacy_bills: {
        Row: {
          amount: number
          bill_date: string
          created_at: string
          description: string
          id: string
          order_reference: string
          paid_at: string | null
          patient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bill_date?: string
          created_at?: string
          description: string
          id: string
          order_reference: string
          paid_at?: string | null
          patient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_date?: string
          created_at?: string
          description?: string
          id?: string
          order_reference?: string
          paid_at?: string | null
          patient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_pharmacy_bills_order_reference_fkey"
            columns: ["order_reference"]
            isOneToOne: false
            referencedRelation: "sugbodoc_pharmacy_orders"
            referencedColumns: ["reference"]
          },
          {
            foreignKeyName: "sugbodoc_pharmacy_bills_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_pharmacy_medications: {
        Row: {
          category: string
          description: string
          dosage: string
          dosage_form: string
          enabled: string
          form: string
          generic_name: string
          id: string
          name: string
          partner_locations: Json
          price: number
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string
          description?: string
          dosage?: string
          dosage_form?: string
          enabled?: string
          form?: string
          generic_name?: string
          id: string
          name: string
          partner_locations?: Json
          price: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string
          description?: string
          dosage?: string
          dosage_form?: string
          enabled?: string
          form?: string
          generic_name?: string
          id?: string
          name?: string
          partner_locations?: Json
          price?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      sugbodoc_pharmacy_orders: {
        Row: {
          bill_id: string | null
          created_at: string
          data: Json
          encounter_id: string | null
          patient_id: string
          payment_status: string
          received_at: string | null
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          data: Json
          encounter_id?: string | null
          patient_id: string
          payment_status?: string
          received_at?: string | null
          reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          data?: Json
          encounter_id?: string | null
          patient_id?: string
          payment_status?: string
          received_at?: string | null
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_pharmacy_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_pharmacy_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_pharmacy_payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          fulfillment_status: string
          id: string
          order_reference: string
          patient_id: string
          payment_date: string
          reference: string
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          fulfillment_status: string
          id: string
          order_reference: string
          patient_id: string
          payment_date?: string
          reference: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          fulfillment_status?: string
          id?: string
          order_reference?: string
          patient_id?: string
          payment_date?: string
          reference?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_pharmacy_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_pharmacy_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugbodoc_pharmacy_payments_order_reference_fkey"
            columns: ["order_reference"]
            isOneToOne: false
            referencedRelation: "sugbodoc_pharmacy_orders"
            referencedColumns: ["reference"]
          },
          {
            foreignKeyName: "sugbodoc_pharmacy_payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugbodoc_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sugbodoc_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sugbodoc_users: {
        Row: {
          allergies: Json
          birthday: string
          blood_type: string
          claims_data: Json | null
          clinic: string
          clinical_editing_permission: string
          created_at: string
          email: string
          emergency_contact: Json | null
          gender: string
          id: string
          initials: string
          insurance_data: Json | null
          name: string
          password_hash: string
          phone: string
          provider_id: string | null
          role: string
          specialty: string
          status: string
          updated_at: string
        }
        Insert: {
          allergies?: Json
          birthday?: string
          blood_type?: string
          claims_data?: Json | null
          clinic?: string
          clinical_editing_permission?: string
          created_at?: string
          email: string
          emergency_contact?: Json | null
          gender?: string
          id: string
          initials: string
          insurance_data?: Json | null
          name: string
          password_hash: string
          phone?: string
          provider_id?: string | null
          role?: string
          specialty?: string
          status?: string
          updated_at?: string
        }
        Update: {
          allergies?: Json
          birthday?: string
          blood_type?: string
          claims_data?: Json | null
          clinic?: string
          clinical_editing_permission?: string
          created_at?: string
          email?: string
          emergency_contact?: Json | null
          gender?: string
          id?: string
          initials?: string
          insurance_data?: Json | null
          name?: string
          password_hash?: string
          phone?: string
          provider_id?: string | null
          role?: string
          specialty?: string
          status?: string
          updated_at?: string
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
