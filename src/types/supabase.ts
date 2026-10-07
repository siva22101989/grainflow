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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity: string
          entity_id: string
          id: string
          ip_address: string | null
          updated_at: string | null
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity: string
          entity_id: string
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      commodity_prices: {
        Row: {
          arrival_quantity: number | null
          commodity: string
          created_at: string | null
          district: string | null
          id: string
          market: string
          max_price: number | null
          min_price: number | null
          modal_price: number | null
          price_date: string
          state: string
          updated_at: string | null
          variety: string | null
        }
        Insert: {
          arrival_quantity?: number | null
          commodity: string
          created_at?: string | null
          district?: string | null
          id?: string
          market: string
          max_price?: number | null
          min_price?: number | null
          modal_price?: number | null
          price_date: string
          state: string
          updated_at?: string | null
          variety?: string | null
        }
        Update: {
          arrival_quantity?: number | null
          commodity?: string
          created_at?: string | null
          district?: string | null
          id?: string
          market?: string
          max_price?: number | null
          min_price?: number | null
          modal_price?: number | null
          price_date?: string
          state?: string
          updated_at?: string | null
          variety?: string | null
        }
        Relationships: []
      }
      crops: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          insurance_per_bag: number
          name: string
          pricing_slabs: Json | null
          rent_price_1y: number | null
          rent_price_6m: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          insurance_per_bag?: number
          name: string
          pricing_slabs?: Json | null
          rent_price_1y?: number | null
          rent_price_6m?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          insurance_per_bag?: number
          name?: string
          pricing_slabs?: Json | null
          rent_price_1y?: number | null
          rent_price_6m?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crops_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          created_at: string | null
          customer_number: number | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          father_name: string | null
          id: string
          linked_user_id: string | null
          must_change_password: boolean
          name: string
          phone: string
          updated_at: string | null
          updated_by: string | null
          village: string | null
          warehouse_id: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          customer_number?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          father_name?: string | null
          id?: string
          linked_user_id?: string | null
          must_change_password?: boolean
          name: string
          phone: string
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
          warehouse_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          customer_number?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          father_name?: string | null
          id?: string
          linked_user_id?: string | null
          must_change_password?: boolean
          name?: string
          phone?: string
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string | null
          id: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          expense_date?: string | null
          id?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          expense_date?: string | null
          id?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email: boolean | null
          id: string
          in_app: boolean | null
          low_stock_alert: boolean | null
          new_inflow: boolean | null
          new_outflow: boolean | null
          payment_received: boolean | null
          pending_dues: boolean | null
          sms: boolean | null
          updated_at: string | null
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          email?: boolean | null
          id?: string
          in_app?: boolean | null
          low_stock_alert?: boolean | null
          new_inflow?: boolean | null
          new_outflow?: boolean | null
          payment_received?: boolean | null
          pending_dues?: boolean | null
          sms?: boolean | null
          updated_at?: string | null
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          email?: boolean | null
          id?: string
          in_app?: boolean | null
          low_stock_alert?: boolean | null
          new_inflow?: boolean | null
          new_outflow?: boolean | null
          payment_received?: boolean | null
          pending_dues?: boolean | null
          sms?: boolean | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string | null
          dismissed_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          notification_type:
            | Database["public"]["Enums"]["notification_type"]
            | null
          severity: Database["public"]["Enums"]["notification_severity"] | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          severity?: Database["public"]["Enums"]["notification_severity"] | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          severity?: Database["public"]["Enums"]["notification_severity"] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_id: string | null
          razorpay_link_id: string | null
          record_id: string | null
          short_url: string | null
          status: string | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_id?: string | null
          razorpay_link_id?: string | null
          record_id?: string | null
          short_url?: string | null
          status?: string | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_id?: string | null
          razorpay_link_id?: string | null
          record_id?: string | null
          short_url?: string | null
          status?: string | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances_mat"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "storage_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_number: number
          payment_status: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          storage_record_id: string | null
          type: Database["public"]["Enums"]["payment_type"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_number?: number
          payment_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          storage_record_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_number?: number
          payment_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          storage_record_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_storage_record_id_fkey"
            columns: ["storage_record_id"]
            isOneToOne: false
            referencedRelation: "storage_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          display_name: string | null
          duration_days: number
          features: Json | null
          id: string
          max_storage_records: number | null
          max_users: number | null
          max_warehouses: number | null
          name: string
          price: number
          razorpay_plan_id: string | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          duration_days?: number
          features?: Json | null
          id?: string
          max_storage_records?: number | null
          max_users?: number | null
          max_warehouses?: number | null
          name: string
          price?: number
          razorpay_plan_id?: string | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          duration_days?: number
          features?: Json | null
          id?: string
          max_storage_records?: number | null
          max_users?: number | null
          max_warehouses?: number | null
          name?: string
          price?: number
          razorpay_plan_id?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_roles"] | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_roles"] | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_roles"] | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number | null
          key: string
          window_start: string | null
        }
        Insert: {
          count?: number | null
          key: string
          window_start?: string | null
        }
        Update: {
          count?: number | null
          key?: string
          window_start?: string | null
        }
        Relationships: []
      }
      sequences: {
        Row: {
          current_value: number | null
          last_reset: string | null
          type: string
          warehouse_id: string
        }
        Insert: {
          current_value?: number | null
          last_reset?: string | null
          type: string
          warehouse_id: string
        }
        Update: {
          current_value?: number | null
          last_reset?: string | null
          type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          message_id: string | null
          message_type: string
          phone: string
          record_id: string | null
          status: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          message_type: string
          phone: string
          record_id?: string | null
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          message_type?: string
          phone?: string
          record_id?: string | null
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances_mat"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "storage_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          created_at: string | null
          enable_inflow_welcome: boolean | null
          enable_outflow_confirmation: boolean | null
          enable_payment_confirmation: boolean | null
          enable_payment_reminders: boolean | null
          enable_sms: boolean
          id: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          enable_inflow_welcome?: boolean | null
          enable_outflow_confirmation?: boolean | null
          enable_payment_confirmation?: boolean | null
          enable_payment_reminders?: boolean | null
          enable_sms?: boolean
          id?: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          enable_inflow_welcome?: boolean | null
          enable_outflow_confirmation?: boolean | null
          enable_payment_confirmation?: boolean | null
          enable_payment_reminders?: boolean | null
          enable_sms?: boolean
          id?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_settings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          direction: string
          id: string
          lot_id: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          new_lot_stock: number | null
          previous_lot_stock: number | null
          quantity: number
          reason: string | null
          storage_record_id: string | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          direction: string
          id?: string
          lot_id?: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          new_lot_stock?: number | null
          previous_lot_stock?: number | null
          quantity: number
          reason?: string | null
          storage_record_id?: string | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          direction?: string
          id?: string
          lot_id?: string | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          new_lot_stock?: number | null
          previous_lot_stock?: number | null
          quantity?: number
          reason?: string | null
          storage_record_id?: string | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "warehouse_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_storage_record_id_fkey"
            columns: ["storage_record_id"]
            isOneToOne: false
            referencedRelation: "storage_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_records: {
        Row: {
          bags_in: number | null
          bags_out: number | null
          bags_stored: number | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          commodity_description: string | null
          created_at: string | null
          crop_id: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          hamali_payable: number | null
          id: string
          inflow_type: Database["public"]["Enums"]["inflow_type"] | null
          insurance_payable: number
          khata_amount: number | null
          load_bags: number | null
          location: string | null
          lorry_tractor_no: string | null
          lot_id: string | null
          notes: string | null
          outflow_invoice_no: string | null
          plot_bags: number | null
          record_number: number
          storage_end_date: string | null
          storage_start_date: string | null
          total_rent_billed: number | null
          unloading_record_id: string | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          bags_in?: number | null
          bags_out?: number | null
          bags_stored?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          commodity_description?: string | null
          created_at?: string | null
          crop_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hamali_payable?: number | null
          id?: string
          inflow_type?: Database["public"]["Enums"]["inflow_type"] | null
          insurance_payable?: number
          khata_amount?: number | null
          load_bags?: number | null
          location?: string | null
          lorry_tractor_no?: string | null
          lot_id?: string | null
          notes?: string | null
          outflow_invoice_no?: string | null
          plot_bags?: number | null
          record_number?: number
          storage_end_date?: string | null
          storage_start_date?: string | null
          total_rent_billed?: number | null
          unloading_record_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          bags_in?: number | null
          bags_out?: number | null
          bags_stored?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          commodity_description?: string | null
          created_at?: string | null
          crop_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hamali_payable?: number | null
          id?: string
          inflow_type?: Database["public"]["Enums"]["inflow_type"] | null
          insurance_payable?: number
          khata_amount?: number | null
          load_bags?: number | null
          location?: string | null
          lorry_tractor_no?: string | null
          lot_id?: string | null
          notes?: string | null
          outflow_invoice_no?: string | null
          plot_bags?: number | null
          record_number?: number
          storage_end_date?: string | null
          storage_start_date?: string | null
          total_rent_billed?: number | null
          unloading_record_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_records_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "storage_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances_mat"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "storage_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_records_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "warehouse_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_records_unloading_record_id_fkey"
            columns: ["unloading_record_id"]
            isOneToOne: false
            referencedRelation: "unloading_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          duration_days: number
          id: string
          notes: string | null
          plan_id: string
          status: string
          updated_at: string | null
          used_at: string | null
          used_by_warehouse_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          duration_days: number
          id?: string
          notes?: string | null
          plan_id: string
          status: string
          updated_at?: string | null
          used_at?: string | null
          used_by_warehouse_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          duration_days?: number
          id?: string
          notes?: string | null
          plan_id?: string
          status?: string
          updated_at?: string | null
          used_at?: string | null
          used_by_warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_codes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_codes_used_by_warehouse_id_fkey"
            columns: ["used_by_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          id: string
          invoice_url: string | null
          metadata: Json | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          plan_id: string
          razorpay_payment_id: string
          razorpay_payment_link_id: string | null
          subscription_id: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          amount: number
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          plan_id: string
          razorpay_payment_id: string
          razorpay_payment_link_id?: string | null
          subscription_id: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          amount?: number
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          plan_id?: string
          razorpay_payment_id?: string
          razorpay_payment_link_id?: string | null
          subscription_id?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_razorpay_payment_link_id_fkey"
            columns: ["razorpay_payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew_enabled: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          grace_period_end: string | null
          grace_period_notified: boolean | null
          id: string
          next_billing_date: string | null
          payment_method: string | null
          plan_id: string | null
          razorpay_customer_id: string | null
          razorpay_last_payment_id: string | null
          razorpay_subscription_id: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          auto_renew_enabled?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          grace_period_notified?: boolean | null
          id?: string
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          razorpay_customer_id?: string | null
          razorpay_last_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          auto_renew_enabled?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          grace_period_notified?: boolean | null
          id?: string
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          razorpay_customer_id?: string | null
          razorpay_last_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      unloading_records: {
        Row: {
          bags_remaining: number | null
          bags_remaining_in_plot: number | null
          bags_unloaded: number
          commodity_description: string
          created_at: string
          crop_id: string | null
          customer_id: string
          destination: string | null
          hamali_amount: number | null
          id: string
          lorry_tractor_no: string | null
          notes: string | null
          plot_location: string | null
          record_number: number | null
          unload_date: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          bags_remaining?: number | null
          bags_remaining_in_plot?: number | null
          bags_unloaded: number
          commodity_description: string
          created_at?: string
          crop_id?: string | null
          customer_id: string
          destination?: string | null
          hamali_amount?: number | null
          id?: string
          lorry_tractor_no?: string | null
          notes?: string | null
          plot_location?: string | null
          record_number?: number | null
          unload_date?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          bags_remaining?: number | null
          bags_remaining_in_plot?: number | null
          bags_unloaded?: number
          commodity_description?: string
          created_at?: string
          crop_id?: string | null
          customer_id?: string
          destination?: string | null
          hamali_amount?: number | null
          id?: string
          lorry_tractor_no?: string | null
          notes?: string | null
          plot_location?: string | null
          record_number?: number | null
          unload_date?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unloading_records_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unloading_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "unloading_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances_mat"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "unloading_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unloading_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_commodity_watchlist: {
        Row: {
          alert_enabled: boolean | null
          alert_threshold: number | null
          commodity: string
          created_at: string | null
          id: string
          preferred_market: string | null
          preferred_state: string | null
          updated_at: string | null
          user_id: string
          variety: string | null
          warehouse_id: string
        }
        Insert: {
          alert_enabled?: boolean | null
          alert_threshold?: number | null
          commodity: string
          created_at?: string | null
          id?: string
          preferred_market?: string | null
          preferred_state?: string | null
          updated_at?: string | null
          user_id: string
          variety?: string | null
          warehouse_id: string
        }
        Update: {
          alert_enabled?: boolean | null
          alert_threshold?: number | null
          commodity?: string
          created_at?: string | null
          id?: string
          preferred_market?: string | null
          preferred_state?: string | null
          updated_at?: string | null
          user_id?: string
          variety?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_commodity_watchlist_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouses: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          updated_at: string | null
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_assignments: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_assignments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_invitations: {
        Row: {
          claimed_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          role: string | null
          status: string | null
          token: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          claimed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_invitations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_lots: {
        Row: {
          capacity: number | null
          created_at: string | null
          current_stock: number | null
          deleted_at: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["lot_status"] | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          current_stock?: number | null
          deleted_at?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["lot_status"] | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          current_stock?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["lot_status"] | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_lots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_settings: {
        Row: {
          auto_send_sms: boolean | null
          business_hours: Json | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          default_billing_cycle:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          timezone: string | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          auto_send_sms?: boolean | null
          business_hours?: Json | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          default_billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          timezone?: string | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          auto_send_sms?: boolean | null
          business_hours?: Json | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          default_billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle"]
            | null
          timezone?: string | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_settings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          capacity_bags: number | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          location: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          capacity_bags?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity_bags?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      withdrawal_transactions: {
        Row: {
          bags_withdrawn: number
          batch_id: string | null
          consolidated_invoice_no: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          discount: number | null
          hamali_charged: number | null
          id: string
          insurance_charged: number | null
          rent_collected: number | null
          storage_record_id: string
          updated_at: string | null
          warehouse_id: string
          withdrawal_date: string
          withdrawal_number: number | null
        }
        Insert: {
          bags_withdrawn: number
          batch_id?: string | null
          consolidated_invoice_no?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number | null
          hamali_charged?: number | null
          id?: string
          insurance_charged?: number | null
          rent_collected?: number | null
          storage_record_id: string
          updated_at?: string | null
          warehouse_id: string
          withdrawal_date: string
          withdrawal_number?: number | null
        }
        Update: {
          bags_withdrawn?: number
          batch_id?: string | null
          consolidated_invoice_no?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number | null
          hamali_charged?: number | null
          id?: string
          insurance_charged?: number | null
          rent_collected?: number | null
          storage_record_id?: string
          updated_at?: string | null
          warehouse_id?: string
          withdrawal_date?: string
          withdrawal_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_transactions_storage_record_id_fkey"
            columns: ["storage_record_id"]
            isOneToOne: false
            referencedRelation: "storage_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_balances: {
        Row: {
          active_records_count: number | null
          balance: number | null
          customer_id: string | null
          customer_name: string | null
          email: string | null
          last_transaction_date: string | null
          phone: string | null
          total_billed: number | null
          total_paid: number | null
          village: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_balances_mat: {
        Row: {
          active_records_count: number | null
          balance: number | null
          customer_id: string | null
          customer_name: string | null
          email: string | null
          last_transaction_date: string | null
          phone: string | null
          total_billed: number | null
          total_paid: number | null
          village: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_expire_subscriptions: {
        Args: never
        Returns: {
          downgraded_count: number
          expired_count: number
          grace_period_count: number
          processed_count: number
        }[]
      }
      belongs_to_warehouse: {
        Args: { resource_warehouse_id: string }
        Returns: boolean
      }
      bulk_import_customers: {
        Args: { p_customers: Json; p_warehouse_id: string }
        Returns: {
          customer_id: string
          error: string
          phone_supplied: string
          success: boolean
        }[]
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds?: number }
        Returns: boolean
      }
      claim_warehouse_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: string
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      clear_must_change_password: { Args: never; Returns: undefined }
      create_new_warehouse: {
        Args: {
          p_capacity: number
          p_email?: string
          p_location: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: string
      }
      create_storage_record_with_payment: {
        Args: { p_payment: Json; p_record: Json }
        Returns: Json
      }
      generate_invoice_number: {
        Args: { p_type: string; p_warehouse_id: string }
        Returns: string
      }
      get_admin_warehouses: {
        Args: never
        Returns: {
          gst_number: string
          id: string
          location: string
          name: string
        }[]
      }
      get_expiring_subscriptions: {
        Args: { days_ahead: number }
        Returns: {
          current_period_end: string
          days_until_expiry: number
          subscription_id: string
          warehouse_email: string
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      get_next_sequence_value: {
        Args: { p_type: string; p_warehouse_id: string }
        Returns: number
      }
      get_or_create_preferences: {
        Args: { p_user_id: string; p_warehouse_id: string }
        Returns: {
          created_at: string | null
          email: boolean | null
          id: string
          in_app: boolean | null
          low_stock_alert: boolean | null
          new_inflow: boolean | null
          new_outflow: boolean | null
          payment_received: boolean | null
          pending_dues: boolean | null
          sms: boolean | null
          updated_at: string | null
          user_id: string
          warehouse_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_warehouse_id: { Args: never; Returns: string }
      get_warehouse_usage_stats: {
        Args: { p_month_start: string; p_warehouse_id: string }
        Returns: {
          monthly_records: number
          total_records: number
          total_users: number
        }[]
      }
      has_role_on_warehouse: {
        Args: { required_roles: string[]; target_warehouse_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      process_bulk_outflow_atomic: {
        Args: {
          p_batch_id: string
          p_consolidated_invoice_no: string
          p_operations: Json
          p_warehouse_id: string
          p_withdrawal_date: string
        }
        Returns: Json
      }
      process_bulk_payment_atomic: {
        Args: {
          p_allocations: Json
          p_customer_id: string
          p_payment_date: string
          p_warehouse_id: string
        }
        Returns: Json
      }
      process_subscription_renewals: {
        Args: never
        Returns: {
          days_until_expiry: number
          owner_phone: string
          plan_tier: string
          warehouse_id: string
        }[]
      }
      refresh_customer_balances: { Args: never; Returns: undefined }
      reserve_stock_for_bulk_outflow: {
        Args: {
          p_bags_needed: number
          p_commodity: string
          p_customer_id: string
          p_specific_ids?: string[]
        }
        Returns: {
          record_bags_stored: number
          record_id: string
          record_storage_start_date: string
          record_total_available: number
        }[]
      }
      reverse_outflow_atomic: {
        Args: {
          p_new_bags_out: number
          p_new_bags_stored: number
          p_new_total_rent_billed: number
          p_reopen: boolean
          p_transaction_id: string
        }
        Returns: Json
      }
      should_notify_user: {
        Args: {
          p_event_type: string
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigger_aging_check: { Args: never; Returns: undefined }
      trigger_payment_check: { Args: never; Returns: undefined }
      trigger_space_check: { Args: never; Returns: undefined }
      update_outflow_atomic: {
        Args: {
          p_add_payments: Json
          p_new_bags: number
          p_new_bags_out: number
          p_new_bags_stored: number
          p_new_date: string
          p_new_hamali_charged: number
          p_new_insurance_charged: number
          p_new_rent: number
          p_new_storage_end_date: string
          p_new_total_rent_billed: number
          p_reset_billing_cycle: boolean
          p_reverse_autosettle: boolean
          p_transaction_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      billing_cycle: "6m" | "1y"
      inflow_type: "purchase" | "transfer_in" | "return" | "other"
      lot_status: "active" | "inactive" | "maintenance" | "full"
      movement_type: "in" | "out" | "adjustment" | "void" | "transfer"
      notification_severity: "info" | "warning" | "critical"
      notification_type:
        | "aging_alert"
        | "low_space"
        | "critical_space"
        | "payment_overdue"
        | "monthly_summary"
        | "abnormal_activity"
        | "general"
      payment_type:
        | "rent"
        | "hamali"
        | "advance"
        | "security_deposit"
        | "other"
        | "waiver"
        | "insurance"
      user_roles:
        | "admin"
        | "manager"
        | "staff"
        | "super_admin"
        | "owner"
        | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      billing_cycle: ["6m", "1y"],
      inflow_type: ["purchase", "transfer_in", "return", "other"],
      lot_status: ["active", "inactive", "maintenance", "full"],
      movement_type: ["in", "out", "adjustment", "void", "transfer"],
      notification_severity: ["info", "warning", "critical"],
      notification_type: [
        "aging_alert",
        "low_space",
        "critical_space",
        "payment_overdue",
        "monthly_summary",
        "abnormal_activity",
        "general",
      ],
      payment_type: [
        "rent",
        "hamali",
        "advance",
        "security_deposit",
        "other",
        "waiver",
        "insurance",
      ],
      user_roles: [
        "admin",
        "manager",
        "staff",
        "super_admin",
        "owner",
        "customer",
      ],
    },
  },
} as const
