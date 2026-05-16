export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          plan: 'free' | 'pro'
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'pro'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'pro'
          created_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          cover_url: string | null
          time_limit_sec: number | null
          is_published: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title?: string
          description?: string | null
          cover_url?: string | null
          time_limit_sec?: number | null
          is_published?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string | null
          cover_url?: string | null
          time_limit_sec?: number | null
          is_published?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quizzes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      questions: {
        Row: {
          id: string
          quiz_id: string
          body: string
          type: 'single' | 'multiple'
          order_index: number
          is_required: boolean
        }
        Insert: {
          id?: string
          quiz_id: string
          body?: string
          type?: 'single' | 'multiple'
          order_index?: number
          is_required?: boolean
        }
        Update: {
          id?: string
          quiz_id?: string
          body?: string
          type?: 'single' | 'multiple'
          order_index?: number
          is_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'questions_quiz_id_fkey'
            columns: ['quiz_id']
            isOneToOne: false
            referencedRelation: 'quizzes'
            referencedColumns: ['id']
          }
        ]
      }
      answer_options: {
        Row: {
          id: string
          question_id: string
          body: string
          is_correct: boolean
          order_index: number
        }
        Insert: {
          id?: string
          question_id: string
          body?: string
          is_correct?: boolean
          order_index?: number
        }
        Update: {
          id?: string
          question_id?: string
          body?: string
          is_correct?: boolean
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: 'answer_options_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          }
        ]
      }
      quiz_access: {
        Row: {
          id: string
          quiz_id: string
          token: string
          login: string
          password_hash: string
          label: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          quiz_id: string
          token?: string
          login: string
          password_hash: string
          label?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          quiz_id?: string
          token?: string
          login?: string
          password_hash?: string
          label?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'quiz_access_quiz_id_fkey'
            columns: ['quiz_id']
            isOneToOne: false
            referencedRelation: 'quizzes'
            referencedColumns: ['id']
          }
        ]
      }
      quiz_sessions: {
        Row: {
          id: string
          quiz_access_id: string
          quiz_id: string
          started_at: string
          finished_at: string | null
          score: number | null
        }
        Insert: {
          id?: string
          quiz_access_id: string
          quiz_id: string
          started_at?: string
          finished_at?: string | null
          score?: number | null
        }
        Update: {
          id?: string
          quiz_access_id?: string
          quiz_id?: string
          started_at?: string
          finished_at?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'quiz_sessions_quiz_access_id_fkey'
            columns: ['quiz_access_id']
            isOneToOne: false
            referencedRelation: 'quiz_access'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quiz_sessions_quiz_id_fkey'
            columns: ['quiz_id']
            isOneToOne: false
            referencedRelation: 'quizzes'
            referencedColumns: ['id']
          }
        ]
      }
      session_answers: {
        Row: {
          id: string
          session_id: string
          question_id: string
          selected_option_ids: string[]
        }
        Insert: {
          id?: string
          session_id: string
          question_id: string
          selected_option_ids?: string[]
        }
        Update: {
          id?: string
          session_id?: string
          question_id?: string
          selected_option_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: 'session_answers_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'quiz_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: 'free' | 'pro'
          status: 'active' | 'cancelled' | 'expired'
          yookassa_payment_id: string | null
          current_period_end: string | null
        }
        Insert: {
          id?: string
          user_id: string
          plan?: 'free' | 'pro'
          status?: 'active' | 'cancelled' | 'expired'
          yookassa_payment_id?: string | null
          current_period_end?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          plan?: 'free' | 'pro'
          status?: 'active' | 'cancelled' | 'expired'
          yookassa_payment_id?: string | null
          current_period_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      answer_options_public: {
        Row: {
          id: string | null
          question_id: string | null
          body: string | null
          order_index: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      plan_type: 'free' | 'pro'
      question_type: 'single' | 'multiple'
      subscription_status: 'active' | 'cancelled' | 'expired'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
