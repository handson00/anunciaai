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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ads: {
        Row: {
          brand: string | null
          category: Database["public"]["Enums"]["ad_category"]
          condition: Database["public"]["Enums"]["ad_condition"] | null
          contact_phone: string
          created_at: string
          description: string
          id: string
          is_sold: boolean | null
          main_photo: string
          photos: string[] | null
          price: number
          region: string | null
          search_vector: unknown
          slug: string
          status: Database["public"]["Enums"]["ad_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          category: Database["public"]["Enums"]["ad_category"]
          condition?: Database["public"]["Enums"]["ad_condition"] | null
          contact_phone: string
          created_at?: string
          description: string
          id?: string
          is_sold?: boolean | null
          main_photo: string
          photos?: string[] | null
          price: number
          region?: string | null
          search_vector?: unknown
          slug: string
          status?: Database["public"]["Enums"]["ad_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: Database["public"]["Enums"]["ad_category"]
          condition?: Database["public"]["Enums"]["ad_condition"] | null
          contact_phone?: string
          created_at?: string
          description?: string
          id?: string
          is_sold?: boolean | null
          main_photo?: string
          photos?: string[] | null
          price?: number
          region?: string | null
          search_vector?: unknown
          slug?: string
          status?: Database["public"]["Enums"]["ad_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      community_groups: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          current_members: number | null
          id: string
          is_join_group_link: boolean | null
          link: string | null
          max_members: number | null
          name: string
          whatsapp_group_id: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          current_members?: number | null
          id?: string
          is_join_group_link?: boolean | null
          link?: string | null
          max_members?: number | null
          name: string
          whatsapp_group_id: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          current_members?: number | null
          id?: string
          is_join_group_link?: boolean | null
          link?: string | null
          max_members?: number | null
          name?: string
          whatsapp_group_id?: string
        }
        Relationships: []
      }
      instagram_monitors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ig_user_id: string | null
          last_checked_at: string | null
          last_post_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ig_user_id?: string | null
          last_checked_at?: string | null
          last_post_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ig_user_id?: string | null
          last_checked_at?: string | null
          last_post_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      instagram_posted: {
        Row: {
          created_at: string
          group_id: string
          id: string
          monitor_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          monitor_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          monitor_id?: string
          post_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean
          can_manage_stock: boolean
          created_at: string
          id: string
          is_admin: boolean
          name: string
          phone: string
          store_name: string | null
          store_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          can_manage_stock?: boolean
          created_at?: string
          id?: string
          is_admin?: boolean
          name: string
          phone: string
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          can_manage_stock?: boolean
          created_at?: string
          id?: string
          is_admin?: boolean
          name?: string
          phone?: string
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publication_logs: {
        Row: {
          ad_id: string | null
          api_response: Json | null
          created_at: string
          group_id: string
          id: string
          message: string | null
          status: string
        }
        Insert: {
          ad_id?: string | null
          api_response?: Json | null
          created_at?: string
          group_id: string
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          ad_id?: string | null
          api_response?: Json | null
          created_at?: string
          group_id?: string
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_publication_logs_ad"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_publication_logs_group"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_logs_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_queue: {
        Row: {
          ad_id: string | null
          api_response: Json | null
          attempts: number
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          log_id: string | null
          max_attempts: number
          message: string | null
          next_run_at: string
          photo_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          api_response?: Json | null
          attempts?: number
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          log_id?: string | null
          max_attempts?: number
          message?: string | null
          next_run_at?: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          api_response?: Json | null
          attempts?: number
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          log_id?: string | null
          max_attempts?: number
          message?: string | null
          next_run_at?: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_queue_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_queue_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "publication_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_queue_locks: {
        Row: {
          locked_by: string | null
          locked_until: string
          name: string
          updated_at: string
        }
        Insert: {
          locked_by?: string | null
          locked_until?: string
          name: string
          updated_at?: string
        }
        Update: {
          locked_by?: string | null
          locked_until?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      recovery_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          buttons: Json | null
          created_at: string
          created_by: string | null
          file_name: string | null
          group_ids: string[]
          id: string
          last_error: string | null
          last_run_at: string | null
          media_url: string | null
          message_type: string
          next_run_at: string
          poll_options: Json | null
          recurrence: string
          scheduled_at: string
          status: string
          text: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          group_ids?: string[]
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          media_url?: string | null
          message_type: string
          next_run_at: string
          poll_options?: Json | null
          recurrence?: string
          scheduled_at: string
          status?: string
          text?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          group_ids?: string[]
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          media_url?: string | null
          message_type?: string
          next_run_at?: string
          poll_options?: Json | null
          recurrence?: string
          scheduled_at?: string
          status?: string
          text?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_products: {
        Row: {
          active: boolean
          ad_id: string | null
          category: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          min_stock: number
          name: string
          photo_url: string | null
          sale_price: number
          sku: string | null
          stock_qty: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          ad_id?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          min_stock?: number
          name: string
          photo_url?: string | null
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          ad_id?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          min_stock?: number
          name?: string
          photo_url?: string | null
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_products_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sale_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_at: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "stock_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sales: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          installments_total: number
          note: string | null
          payment_type: string
          product_id: string
          profit: number | null
          quantity: number
          sold_at: string
          total: number | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          installments_total?: number
          note?: string | null
          payment_type?: string
          product_id: string
          profit?: number | null
          quantity: number
          sold_at?: string
          total?: number | null
          unit_cost?: number
          unit_price: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          installments_total?: number
          note?: string | null
          payment_type?: string
          product_id?: string
          profit?: number | null
          quantity?: number
          sold_at?: string
          total?: number | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_stock: { Args: never; Returns: boolean }
      claim_publication_queue: {
        Args: { _limit?: number; _worker_id: string }
        Returns: {
          ad_id: string | null
          api_response: Json | null
          attempts: number
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          log_id: string | null
          max_attempts: number
          message: string | null
          next_run_at: string
          photo_url: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "publication_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_unique_store_slug: {
        Args: { _base: string; _user_id: string }
        Returns: string
      }
      get_advertiser_by_slug: {
        Args: { _slug: string }
        Returns: {
          avatar_url: string
          name: string
          store_name: string
          store_slug: string
          user_id: string
        }[]
      }
      get_public_advertisers: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          name: string
          store_name: string
          store_slug: string
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      list_admin_users: {
        Args: never
        Returns: {
          can_manage_stock: boolean
          is_admin: boolean
          name: string
          user_id: string
        }[]
      }
      release_publication_worker: {
        Args: { _worker_id: string }
        Returns: undefined
      }
      set_stock_permission: {
        Args: { _can: boolean; _target_user: string }
        Returns: undefined
      }
      slugify: { Args: { _input: string }; Returns: string }
      stock_dashboard_kpis: { Args: never; Returns: Json }
      try_acquire_publication_worker: {
        Args: { _ttl_seconds?: number; _worker_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      ad_category: "automobile" | "product" | "property" | "service"
      ad_condition: "new" | "used"
      ad_status: "draft" | "ready" | "published" | "error" | "sold"
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
      ad_category: ["automobile", "product", "property", "service"],
      ad_condition: ["new", "used"],
      ad_status: ["draft", "ready", "published", "error", "sold"],
    },
  },
} as const
