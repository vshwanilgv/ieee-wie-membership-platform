export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RoleType = 
  | 'chairwoman'
  | 'executive_committee'
  | 'board_of_directors'
  | 'committee_lead'
  | 'committee_member'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type NotificationType =
  | 'contribution_submitted'
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'role_approved'
  | 'role_rejected'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          ieee_id: string | null
          email: string
          phone: string | null
          photo_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          ieee_id?: string | null
          email: string
          phone?: string | null
          photo_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          ieee_id?: string | null
          email?: string
          phone?: string | null
          photo_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      committees: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          start_date: string
          end_date: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          start_date: string
          end_date?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          start_date?: string
          end_date?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      member_roles: {
        Row: {
          id: string
          member_id: string
          role_type: RoleType
          title: string
          committee_id: string | null
          project_id: string | null
          start_date: string
          end_date: string | null
          reporting_to: string | null
          status: ApprovalStatus
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          role_type: RoleType
          title: string
          committee_id?: string | null
          project_id?: string | null
          start_date: string
          end_date?: string | null
          reporting_to?: string | null
          status?: ApprovalStatus
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          role_type?: RoleType
          title?: string
          committee_id?: string | null
          project_id?: string | null
          start_date?: string
          end_date?: string | null
          reporting_to?: string | null
          status?: ApprovalStatus
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contribution_types: {
        Row: {
          id: string
          name: string
          description: string | null
          min_score: number
          max_score: number
          requires_evidence: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          min_score: number
          max_score: number
          requires_evidence?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          min_score?: number
          max_score?: number
          requires_evidence?: boolean
          created_at?: string
        }
      }
      contributions: {
        Row: {
          id: string
          member_id: string
          title: string
          description: string
          contribution_type_id: string
          activity_date: string
          role_id: string | null
          project_id: string | null
          status: ApprovalStatus
          assigned_score: number | null
          approver_id: string | null
          approval_comment: string | null
          rejection_reason: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          title: string
          description: string
          contribution_type_id: string
          activity_date: string
          role_id?: string | null
          project_id?: string | null
          status?: ApprovalStatus
          assigned_score?: number | null
          approver_id?: string | null
          approval_comment?: string | null
          rejection_reason?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          title?: string
          description?: string
          contribution_type_id?: string
          activity_date?: string
          role_id?: string | null
          project_id?: string | null
          status?: ApprovalStatus
          assigned_score?: number | null
          approver_id?: string | null
          approval_comment?: string | null
          rejection_reason?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contribution_evidence: {
        Row: {
          id: string
          contribution_id: string
          file_path: string
          file_size: number
          mime_type: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          contribution_id: string
          file_path: string
          file_size: number
          mime_type: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          contribution_id?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          uploaded_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          related_entity_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          related_entity_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          title?: string
          message?: string
          related_entity_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          old_values: Json | null
          new_values: Json | null
          performed_by: string | null
          performed_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          old_values?: Json | null
          new_values?: Json | null
          performed_by?: string | null
          performed_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          performed_by?: string | null
          performed_at?: string
        }
      }
    }
    Views: {
      monthly_top_contributors: {
        Row: {
          month: string | null
          member_id: string | null
          full_name: string | null
          photo_url: string | null
          total_score: number | null
          contribution_count: number | null
          rank: number | null
        }
      }
      member_total_scores: {
        Row: {
          member_id: string | null
          full_name: string | null
          photo_url: string | null
          total_score: number | null
          total_contributions: number | null
        }
      }
      pending_approvals_count: {
        Row: {
          approver_id: string | null
          pending_count: number | null
        }
      }
    }
    Functions: {
      get_member_approver: {
        Args: { member_uuid: string }
        Returns: string
      }
      is_user_approver: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      is_user_chairwoman: {
        Args: { user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      role_type: RoleType
      approval_status: ApprovalStatus
      notification_type: NotificationType
    }
  }
}
