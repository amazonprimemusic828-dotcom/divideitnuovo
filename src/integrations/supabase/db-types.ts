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
      admin_trust_scores: {
        Row: {
          created_at: string
          last_bonus_at: string | null
          score: number
          updated_at: string
          user_email: string
        }
        Insert: {
          created_at?: string
          last_bonus_at?: string | null
          score?: number
          updated_at?: string
          user_email: string
        }
        Update: {
          created_at?: string
          last_bonus_at?: string | null
          score?: number
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_uid: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_uid: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_uid?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      contest_participants: {
        Row: {
          created_at: string
          nickname: string
          rules_accepted_at: string
          rules_version: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          nickname: string
          rules_accepted_at?: string
          rules_version?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          nickname?: string
          rules_accepted_at?: string
          rules_version?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          dedupe_key: string
          group_id: string | null
          id: string
          kind: string
          provider_id: string | null
          recipient_email: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          group_id?: string | null
          id?: string
          kind: string
          provider_id?: string | null
          recipient_email: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          group_id?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          recipient_email?: string
        }
        Relationships: []
      }
      group_slot_locks: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string
          id: string
          user_email: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          user_email: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_slot_locks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_vault_keys: {
        Row: {
          created_at: string
          ephemeral_public_jwk: Json
          granted_by: string | null
          group_id: string
          id: string
          recipient_email: string
          recipient_user_id: string
          updated_at: string
          vault_version: number
          wrapped_vault_key: string
        }
        Insert: {
          created_at?: string
          ephemeral_public_jwk: Json
          granted_by?: string | null
          group_id: string
          id?: string
          recipient_email: string
          recipient_user_id: string
          updated_at?: string
          vault_version?: number
          wrapped_vault_key: string
        }
        Update: {
          created_at?: string
          ephemeral_public_jwk?: Json
          granted_by?: string | null
          group_id?: string
          id?: string
          recipient_email?: string
          recipient_user_id?: string
          updated_at?: string
          vault_version?: number
          wrapped_vault_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_vault_keys_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          admin_email: string
          billing_date: number
          closed_at: string | null
          cover_image_url: string | null
          created_date: string | null
          credentials_ciphertext: string | null
          credentials_iv: string | null
          credentials_tag: string | null
          credentials_updated_at: string | null
          currency: string | null
          description: string | null
          id: string
          invite_code: string
          is_public: boolean | null
          max_members: number
          owner_id: string | null
          plan_type: string | null
          rental_duration_hours: number | null
          rental_enabled: boolean
          rental_price_cents: number | null
          service_name: string
          service_type: string
          status: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          stripe_price_id: string | null
          stripe_requirements_due: Json
          total_cost: number
          vault_ciphertext: string | null
          vault_iv: string | null
          vault_updated_at: string | null
          vault_version: number
        }
        Insert: {
          admin_email: string
          billing_date: number
          closed_at?: string | null
          cover_image_url?: string | null
          created_date?: string | null
          credentials_ciphertext?: string | null
          credentials_iv?: string | null
          credentials_tag?: string | null
          credentials_updated_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          invite_code: string
          is_public?: boolean | null
          max_members: number
          owner_id?: string | null
          plan_type?: string | null
          rental_duration_hours?: number | null
          rental_enabled?: boolean
          rental_price_cents?: number | null
          service_name: string
          service_type: string
          status?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          stripe_price_id?: string | null
          stripe_requirements_due?: Json
          total_cost: number
          vault_ciphertext?: string | null
          vault_iv?: string | null
          vault_updated_at?: string | null
          vault_version?: number
        }
        Update: {
          admin_email?: string
          billing_date?: number
          closed_at?: string | null
          cover_image_url?: string | null
          created_date?: string | null
          credentials_ciphertext?: string | null
          credentials_iv?: string | null
          credentials_tag?: string | null
          credentials_updated_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean | null
          max_members?: number
          owner_id?: string | null
          plan_type?: string | null
          rental_duration_hours?: number | null
          rental_enabled?: boolean
          rental_price_cents?: number | null
          service_name?: string
          service_type?: string
          status?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          stripe_price_id?: string | null
          stripe_requirements_due?: Json
          total_cost?: number
          vault_ciphertext?: string | null
          vault_iv?: string | null
          vault_updated_at?: string | null
          vault_version?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          access_expires_at: string | null
          auto_renew: boolean
          cost_per_month: number | null
          created_date: string | null
          cred_issue_note: string | null
          cred_status: string
          cred_status_at: string | null
          current_period_end: string | null
          dunning_attempts: number
          duration_hours: number | null
          group_id: string | null
          id: string
          joined_date: string | null
          payment_status: string | null
          removal_effective_at: string | null
          removal_requested_at: string | null
          removal_requested_by: string | null
          role: string | null
          slot_type: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_avatar_url: string | null
          user_email: string
          user_name: string | null
        }
        Insert: {
          access_expires_at?: string | null
          auto_renew?: boolean
          cost_per_month?: number | null
          created_date?: string | null
          cred_issue_note?: string | null
          cred_status?: string
          cred_status_at?: string | null
          current_period_end?: string | null
          dunning_attempts?: number
          duration_hours?: number | null
          group_id?: string | null
          id?: string
          joined_date?: string | null
          payment_status?: string | null
          removal_effective_at?: string | null
          removal_requested_at?: string | null
          removal_requested_by?: string | null
          role?: string | null
          slot_type?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_avatar_url?: string | null
          user_email: string
          user_name?: string | null
        }
        Update: {
          access_expires_at?: string | null
          auto_renew?: boolean
          cost_per_month?: number | null
          created_date?: string | null
          cred_issue_note?: string | null
          cred_status?: string
          cred_status_at?: string | null
          current_period_end?: string | null
          dunning_attempts?: number
          duration_hours?: number | null
          group_id?: string | null
          id?: string
          joined_date?: string | null
          payment_status?: string | null
          removal_effective_at?: string | null
          removal_requested_at?: string | null
          removal_requested_by?: string | null
          role?: string | null
          slot_type?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_avatar_url?: string | null
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          message: string
          message_type: string | null
          read_by: string[] | null
          sender_avatar: string | null
          sender_name: string
          sender_uid: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          message: string
          message_type?: string | null
          read_by?: string[] | null
          sender_avatar?: string | null
          sender_name: string
          sender_uid: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          message?: string
          message_type?: string | null
          read_by?: string[] | null
          sender_avatar?: string | null
          sender_name?: string
          sender_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_date: string | null
          group_id: string | null
          id: string
          link: string | null
          read: boolean | null
          title: string
          type: string
          user_email: string
        }
        Insert: {
          content?: string | null
          created_date?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          type: string
          user_email: string
        }
        Update: {
          content?: string | null
          created_date?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_email?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billing_month: string | null
          created_date: string | null
          group_id: string | null
          id: string
          membership_id: string | null
          owner_amount: number | null
          payment_date: string | null
          payment_method: string | null
          platform_fee: number | null
          status: string | null
          user_email: string
        }
        Insert: {
          amount: number
          billing_month?: string | null
          created_date?: string | null
          group_id?: string | null
          id?: string
          membership_id?: string | null
          owner_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          status?: string | null
          user_email: string
        }
        Update: {
          amount?: number
          billing_month?: string | null
          created_date?: string | null
          group_id?: string | null
          id?: string
          membership_id?: string | null
          owner_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          status?: string | null
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          phone_e164: string
          user_email: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          phone_e164: string
          user_email?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          phone_e164?: string
          user_email?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          endpoint: string
          rl_key: string
          window_start: string
        }
        Insert: {
          count?: number
          endpoint: string
          rl_key: string
          window_start: string
        }
        Update: {
          count?: number
          endpoint?: string
          rl_key?: string
          window_start?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          group_id: string
          id: string
          ratee_email: string
          rater_email: string
          rater_role: string
          rater_uid: string
          review: string | null
          stars: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          ratee_email: string
          rater_email: string
          rater_role: string
          rater_uid: string
          review?: string | null
          stars: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          ratee_email?: string
          rater_email?: string
          rater_role?: string
          rater_uid?: string
          review?: string | null
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          referred_email: string
          referred_id: string
          referrer_email: string
          referrer_id: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          referred_email: string
          referred_id: string
          referrer_email: string
          referrer_id: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string
          referred_id?: string
          referrer_email?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          payment_id: string | null
          reason: string
          resolved_at: string | null
          status: string | null
          user_email: string
          user_uid: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string | null
          reason: string
          resolved_at?: string | null
          status?: string | null
          user_email: string
          user_uid: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string | null
          user_email?: string
          user_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_quota_monthly: {
        Row: {
          sent_count: number
          updated_at: string
          year_month: string
        }
        Insert: {
          sent_count?: number
          updated_at?: string
          year_month: string
        }
        Update: {
          sent_count?: number
          updated_at?: string
          year_month?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          id: string
          processed_at: string | null
          type: string | null
        }
        Insert: {
          event_id: string
          id?: string
          processed_at?: string | null
          type?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          processed_at?: string | null
          type?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string
          sender_name: string
          sender_type: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
          sender_name: string
          sender_type?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
          sender_name?: string
          sender_type?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_attempted: boolean | null
          ai_resolution: string | null
          assigned_operator: string | null
          category: string | null
          created_at: string | null
          description: string
          group_admin_email: string | null
          group_id: string | null
          id: string
          membership_id: string | null
          priority: string | null
          refund_amount: number | null
          refund_payment_id: string | null
          status: string | null
          subject: string
          ticket_type: string
          updated_at: string | null
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          ai_attempted?: boolean | null
          ai_resolution?: string | null
          assigned_operator?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          group_admin_email?: string | null
          group_id?: string | null
          id?: string
          membership_id?: string | null
          priority?: string | null
          refund_amount?: number | null
          refund_payment_id?: string | null
          status?: string | null
          subject: string
          ticket_type?: string
          updated_at?: string | null
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          ai_attempted?: boolean | null
          ai_resolution?: string | null
          assigned_operator?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          group_admin_email?: string | null
          group_id?: string | null
          id?: string
          membership_id?: string | null
          priority?: string | null
          refund_amount?: number | null
          refund_payment_id?: string | null
          status?: string | null
          subject?: string
          ticket_type?: string
          updated_at?: string | null
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_refund_payment_id_fkey"
            columns: ["refund_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_scores: {
        Row: {
          groups_created: number | null
          groups_joined: number | null
          id: string
          last_updated: string | null
          payments_late: number | null
          payments_on_time: number | null
          score: number | null
          user_email: string
        }
        Insert: {
          groups_created?: number | null
          groups_joined?: number | null
          id?: string
          last_updated?: string | null
          payments_late?: number | null
          payments_on_time?: number | null
          score?: number | null
          user_email: string
        }
        Update: {
          groups_created?: number | null
          groups_joined?: number | null
          id?: string
          last_updated?: string | null
          payments_late?: number | null
          payments_on_time?: number | null
          score?: number | null
          user_email?: string
        }
        Relationships: []
      }
      user_credential_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          iterations: number
          locked_until: string | null
          pin_hash: string
          pin_salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          iterations?: number
          locked_until?: string | null
          pin_hash: string
          pin_salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          iterations?: number
          locked_until?: string | null
          pin_hash?: string
          pin_salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line: string | null
          address_zip: string | null
          auto_payout_enabled: boolean
          auto_payout_min_cents: number
          created_at: string
          identity_status: string
          identity_verified_at: string | null
          last_seen_at: string | null
          notify_chat: boolean
          notify_email: boolean
          notify_marketing: boolean
          notify_new_member: boolean
          notify_payment: boolean
          notify_push: boolean
          phone_e164: string | null
          phone_verified_at: string | null
          referral_code: string | null
          trust_badges: string[]
          trust_level: number
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          auto_payout_enabled?: boolean
          auto_payout_min_cents?: number
          created_at?: string
          identity_status?: string
          identity_verified_at?: string | null
          last_seen_at?: string | null
          notify_chat?: boolean
          notify_email?: boolean
          notify_marketing?: boolean
          notify_new_member?: boolean
          notify_payment?: boolean
          notify_push?: boolean
          phone_e164?: string | null
          phone_verified_at?: string | null
          referral_code?: string | null
          trust_badges?: string[]
          trust_level?: number
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          auto_payout_enabled?: boolean
          auto_payout_min_cents?: number
          created_at?: string
          identity_status?: string
          identity_verified_at?: string | null
          last_seen_at?: string | null
          notify_chat?: boolean
          notify_email?: boolean
          notify_marketing?: boolean
          notify_new_member?: boolean
          notify_payment?: boolean
          notify_push?: boolean
          phone_e164?: string | null
          phone_verified_at?: string | null
          referral_code?: string | null
          trust_badges?: string[]
          trust_level?: number
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_public_keys: {
        Row: {
          created_at: string
          kdf_iterations: number
          kdf_salt: string
          public_key_jwk: Json
          pw_kdf_iterations: number | null
          pw_kdf_salt: string | null
          pw_wrapped_private_key: string | null
          updated_at: string
          user_email: string | null
          user_id: string
          wrapped_private_key: string
        }
        Insert: {
          created_at?: string
          kdf_iterations?: number
          kdf_salt: string
          public_key_jwk: Json
          pw_kdf_iterations?: number | null
          pw_kdf_salt?: string | null
          pw_wrapped_private_key?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
          wrapped_private_key: string
        }
        Update: {
          created_at?: string
          kdf_iterations?: number
          kdf_salt?: string
          public_key_jwk?: Json
          pw_kdf_iterations?: number | null
          pw_kdf_salt?: string | null
          pw_wrapped_private_key?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
          wrapped_private_key?: string
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
      user_wallets: {
        Row: {
          balance_cents: number
          created_at: string
          total_credited_cents: number
          total_spent_cents: number
          updated_at: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          total_credited_cents?: number
          total_spent_cents?: number
          updated_at?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          balance_cents?: number
          created_at?: string
          total_credited_cents?: number
          total_spent_cents?: number
          updated_at?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          expires_at: string
          id: string
          matched_group_id: string | null
          plan_type: string | null
          service_name: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_email: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          matched_group_id?: string | null
          plan_type?: string | null
          service_name: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_email: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          matched_group_id?: string | null
          plan_type?: string | null
          service_name?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_matched_group_id_fkey"
            columns: ["matched_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          created_at: string | null
          gross_amount: number
          group_id: string | null
          id: string
          net_amount: number
          owner_email: string
          owner_uid: string
          paid_at: string
          payment_id: string | null
          payout_at: string | null
          platform_fee: number
          refund_reason: string | null
          refunded_at: string | null
          release_at: string
          status: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          created_at?: string | null
          gross_amount: number
          group_id?: string | null
          id?: string
          net_amount: number
          owner_email: string
          owner_uid: string
          paid_at: string
          payment_id?: string | null
          payout_at?: string | null
          platform_fee: number
          refund_reason?: string | null
          refunded_at?: string | null
          release_at: string
          status?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          created_at?: string | null
          gross_amount?: number
          group_id?: string | null
          id?: string
          net_amount?: number
          owner_email?: string
          owner_uid?: string
          paid_at?: string
          payment_id?: string | null
          payout_at?: string | null
          platform_fee?: number
          refund_reason?: string | null
          refunded_at?: string | null
          release_at?: string
          status?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          source_group_id: string | null
          source_payment_id: string | null
          source_referral_id: string | null
          source_session_id: string | null
          source_ticket_id: string | null
          type: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          source_group_id?: string | null
          source_payment_id?: string | null
          source_referral_id?: string | null
          source_session_id?: string | null
          source_ticket_id?: string | null
          type: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          source_group_id?: string | null
          source_payment_id?: string | null
          source_referral_id?: string | null
          source_session_id?: string | null
          source_ticket_id?: string | null
          type?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      youtube_rewards: {
        Row: {
          created_at: string
          email_submitted_at: string | null
          google_email: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          month: string
          nickname: string | null
          qualified_at: string
          status: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_submitted_at?: string | null
          google_email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          month: string
          nickname?: string | null
          qualified_at?: string
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_submitted_at?: string | null
          google_email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          month?: string
          nickname?: string | null
          qualified_at?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_rating_summary: {
        Args: { _emails: string[] }
        Returns: {
          avg_stars: number
          ratee_email: string
          review_count: number
        }[]
      }
      award_trust_badge: {
        Args: { _badge: string; _points: number; _user_id: string }
        Returns: undefined
      }
      cancel_member_removal: {
        Args: { _membership_id: string }
        Returns: undefined
      }
      claim_referral: { Args: { code: string }; Returns: string }
      cleanup_expired_slot_locks: { Args: never; Returns: number }
      consume_rate_limit: {
        Args: {
          p_endpoint: string
          p_key: string
          p_max: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      contest_active_users: { Args: { _referrer_id: string }; Returns: number }
      contest_join: {
        Args: { _accept_rules: boolean; _nickname: string }
        Returns: {
          nickname: string
          rules_accepted_at: string
        }[]
      }
      contest_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          active_users: number
          is_me: boolean
          nickname: string
          rank_position: number
        }[]
      }
      contest_my_entry: {
        Args: never
        Returns: {
          active_users: number
          nickname: string
          rules_accepted_at: string
          rules_version: string
        }[]
      }
      contest_settings: {
        Args: never
        Returns: {
          ends_at: string
          is_open: boolean
          rules_version: string
          starts_at: string
        }[]
      }
      count_active_slots: { Args: { _group_id: string }; Returns: number }
      current_email: { Args: never; Returns: string }
      get_group_admin_details: {
        Args: { _group_id: string }
        Returns: {
          admin_email: string
          id: string
          invite_code: string
          stripe_account_id: string
        }[]
      }
      get_group_by_invite_code: {
        Args: { _code: string }
        Returns: {
          admin_email: string
          billing_date: number
          currency: string
          description: string
          id: string
          is_public: boolean
          max_members: number
          plan_type: string
          service_name: string
          service_type: string
          status: string
          total_cost: number
        }[]
      }
      get_group_members: {
        Args: { _group_id: string }
        Returns: {
          created_date: string
          cred_issue_note: string
          cred_status: string
          cred_status_at: string
          group_id: string
          id: string
          joined_date: string
          payment_status: string
          removal_effective_at: string
          removal_requested_at: string
          role: string
          user_avatar_url: string
          user_email: string
          user_name: string
        }[]
      }
      get_membership_stripe_ids: {
        Args: { _membership_id: string }
        Returns: {
          id: string
          stripe_customer_id: string
          stripe_subscription_id: string
        }[]
      }
      get_public_group: {
        Args: { _id: string }
        Returns: {
          admin_name: string
          billing_date: number
          closed_at: string
          cover_image_url: string
          created_date: string
          currency: string
          description: string
          id: string
          is_public: boolean
          max_members: number
          member_count: number
          owner_id: string
          plan_type: string
          service_name: string
          service_type: string
          status: string
          total_cost: number
        }[]
      }
      get_public_groups: {
        Args: never
        Returns: {
          admin_name: string
          billing_date: number
          closed_at: string
          cover_image_url: string
          created_date: string
          currency: string
          description: string
          id: string
          is_public: boolean
          max_members: number
          member_count: number
          owner_id: string
          plan_type: string
          service_name: string
          service_type: string
          status: string
          total_cost: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: { Args: { _group_id: string }; Returns: boolean }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      is_operator: { Args: never; Returns: boolean }
      is_phone_verified: { Args: never; Returns: boolean }
      mark_messages_read: {
        Args: { p_group_id: string; p_user_uid: string }
        Returns: undefined
      }
      mark_phone_verified: { Args: { _phone: string }; Returns: undefined }
      match_and_lock_group: {
        Args: { _service_name: string; _user_email: string }
        Returns: {
          out_expires_at: string
          out_group_id: string
          out_lock_id: string
        }[]
      }
      match_confirm_lock: {
        Args: { _lock_id: string; _user_avatar_url: string; _user_name: string }
        Returns: {
          group_id: string
          membership_id: string
        }[]
      }
      match_release_lock: { Args: { _lock_id: string }; Returns: undefined }
      process_scheduled_removals: { Args: never; Returns: number }
      purge_rate_limits: { Args: never; Returns: undefined }
      referral_get_my_code: { Args: never; Returns: string }
      referral_my_summary: {
        Args: never
        Returns: {
          confirmed_invites: number
          earned_cents: number
          pending_cents: number
          pending_invites: number
          referral_code: string
          total_invites: number
        }[]
      }
      rental_can_read_credentials: {
        Args: { _group_id: string; _user_email: string }
        Returns: boolean
      }
      rental_expire_due: { Args: never; Returns: number }
      rental_purchase_with_wallet: {
        Args: {
          _group_id: string
          _user_avatar_url: string
          _user_email: string
          _user_name: string
        }
        Returns: {
          access_expires_at: string
          membership_id: string
        }[]
      }
      request_member_removal: {
        Args: { _membership_id: string }
        Returns: string
      }
      reserve_group_seat: {
        Args: {
          _group_id: string
          _user_avatar_url: string
          _user_email: string
          _user_name: string
        }
        Returns: {
          membership_id: string
          status: string
        }[]
      }
      reset_credential_status: { Args: { _group_id: string }; Returns: number }
      set_credential_status: {
        Args: { _group_id: string; _note?: string; _status: string }
        Returns: string
      }
      set_membership_auto_renew: {
        Args: { _membership_id: string; _value: boolean }
        Returns: boolean
      }
      sms_guard_try_consume: {
        Args: {
          _monthly_cap?: number
          _phone: string
          _user_cap?: number
          _user_id: string
        }
        Returns: Json
      }
      storage_cover_visible: {
        Args: { _object_name: string }
        Returns: boolean
      }
      trust_score_award_longevity: { Args: never; Returns: number }
      trust_score_penalize: {
        Args: { _admin_email: string; _amount?: number }
        Returns: number
      }
      vault_get_payload: {
        Args: { _group_id: string }
        Returns: {
          vault_ciphertext: string
          vault_iv: string
          vault_updated_at: string
          vault_version: number
        }[]
      }
      vault_get_public_key: { Args: { _user_id: string }; Returns: Json }
      vault_group_recipients: {
        Args: { _group_id: string }
        Returns: {
          has_key: boolean
          public_key_jwk: Json
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      vault_set_payload: {
        Args: { _ciphertext: string; _group_id: string; _iv: string }
        Returns: number
      }
      wallet_credit: {
        Args: {
          _amount_cents: number
          _created_by?: string
          _description?: string
          _source_group_id?: string
          _source_payment_id?: string
          _source_session_id?: string
          _source_ticket_id?: string
          _type: string
          _user_email: string
        }
        Returns: {
          balance_cents: number
          tx_id: string
        }[]
      }
      wallet_get_balance: { Args: { _user_email: string }; Returns: number }
      wallet_spend: {
        Args: {
          _amount_cents: number
          _description?: string
          _source_group_id?: string
          _source_session_id?: string
          _type?: string
          _user_email: string
        }
        Returns: {
          balance_cents: number
          tx_id: string
        }[]
      }
      youtube_admin_list: {
        Args: never
        Returns: {
          email_submitted_at: string
          google_email: string
          id: string
          invited_at: string
          month: string
          nickname: string
          qualified_at: string
          slots_left: number
          status: string
          user_email: string
        }[]
      }
      youtube_mark_invited: { Args: { _id: string }; Returns: string }
      youtube_my_status: {
        Args: never
        Returns: {
          confirmed_friends: number
          google_email: string
          invited_at: string
          reward_id: string
          slots_left: number
          status: string
        }[]
      }
      youtube_slots_left: { Args: never; Returns: number }
      youtube_submit_email: { Args: { _email: string }; Returns: string }
      youtube_try_qualify: {
        Args: { _user_email: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "user"
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
      app_role: ["admin", "operator", "user"],
    },
  },
} as const
