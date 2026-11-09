
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"challenge_id": string | null,"changed_at": string,"changed_by": string | null,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"challenge_id"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"challenge_id"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"challenge_members": {
                  Row: {
                    "challenge_id": string,"created_at": string,"id": string,"role": Database["public"]['Enums']["challenge_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["challenge_role"],"user_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["challenge_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_members_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenge_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"challenges": {
                  Row: {
                    "company": string,"created_at": string,"created_by": string | null,"description": string,"end_date": string,"id": string,"monitoring_weekdays": (number)[],"name": string,"start_date": string,"status": Database["public"]['Enums']["challenge_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"end_date": string,"id"?: string,"monitoring_weekdays"?: (number)[],"name": string,"start_date": string,"status"?: Database["public"]['Enums']["challenge_status"],"updated_at"?: string
                  }
                  Update: {
                    "company"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"end_date"?: string,"id"?: string,"monitoring_weekdays"?: (number)[],"name"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["challenge_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenges_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_criteria": {
                  Row: {
                    "challenge_id": string,"created_at": string,"description": string,"id": string,"is_active": boolean,"name": string,"position": number,"previous_version_id": string | null,"scope": Database["public"]['Enums']["criterion_scope"],"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"description"?: string,"id"?: string,"is_active"?: boolean,"name": string,"position"?: number,"previous_version_id"?: string | null,"scope": Database["public"]['Enums']["criterion_scope"],"version"?: number
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"position"?: number,"previous_version_id"?: string | null,"scope"?: Database["public"]['Enums']["criterion_scope"],"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_criteria_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_criteria_previous_version_id_fkey"
      columns: ["previous_version_id"]
isOneToOne: false
      referencedRelation: "evaluation_criteria"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_scores": {
                  Row: {
                    "created_at": string,"criterion_id": string,"id": string,"score": number | null,"student_evaluation_id": string | null,"team_evaluation_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criterion_id": string,"id"?: string,"score"?: number | null,"student_evaluation_id"?: string | null,"team_evaluation_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"criterion_id"?: string,"id"?: string,"score"?: number | null,"student_evaluation_id"?: string | null,"team_evaluation_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_scores_criterion_id_fkey"
      columns: ["criterion_id"]
isOneToOne: false
      referencedRelation: "evaluation_criteria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_scores_student_evaluation_id_fkey"
      columns: ["student_evaluation_id"]
isOneToOne: false
      referencedRelation: "student_evaluations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_scores_team_evaluation_id_fkey"
      columns: ["team_evaluation_id"]
isOneToOne: false
      referencedRelation: "team_evaluations"
      referencedColumns: ["id"]
    }
                  ]
                },"monitoring_sessions": {
                  Row: {
                    "challenge_id": string,"created_at": string,"id": string,"is_extra": boolean,"notes": string,"session_date": string,"status": Database["public"]['Enums']["session_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"id"?: string,"is_extra"?: boolean,"notes"?: string,"session_date": string,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"id"?: string,"is_extra"?: boolean,"notes"?: string,"session_date"?: string,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "monitoring_sessions_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"pedagogical_notes": {
                  Row: {
                    "author_id": string,"challenge_id": string,"content": string,"created_at": string,"id": string,"student_id": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"challenge_id": string,"content": string,"created_at"?: string,"id"?: string,"student_id"?: string | null,"team_id": string
                  }
                  Update: {
                    "author_id"?: string,"challenge_id"?: string,"content"?: string,"created_at"?: string,"id"?: string,"student_id"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedagogical_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedagogical_notes_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedagogical_notes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedagogical_notes_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"auth_source": string,"created_at": string,"email": string,"full_name": string,"id": string,"is_admin": boolean,"login": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"auth_source"?: string,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_admin"?: boolean,"login"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"auth_source"?: string,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_admin"?: boolean,"login"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_milestones": {
                  Row: {
                    "challenge_id": string,"created_at": string,"description": string,"due_date": string | null,"id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"title": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_milestones_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "challenge_id": string,"created_at": string,"generated_by": string | null,"id": string,"period_end": string,"period_start": string,"type": Database["public"]['Enums']["report_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"generated_by"?: string | null,"id"?: string,"period_end": string,"period_start": string,"type": Database["public"]['Enums']["report_type"]
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"generated_by"?: string | null,"id"?: string,"period_end"?: string,"period_start"?: string,"type"?: Database["public"]['Enums']["report_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"student_evaluations": {
                  Row: {
                    "absent": boolean,"activities": string,"commitments": string,"created_at": string,"deliveries": string,"difficulty": string,"followup_status": Database["public"]['Enums']["followup_status"] | null,"guidance": string,"id": string,"membership_id": string | null,"notes": string,"student_id": string,"team_evaluation_id": string,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "absent"?: boolean,"activities"?: string,"commitments"?: string,"created_at"?: string,"deliveries"?: string,"difficulty"?: string,"followup_status"?: Database["public"]['Enums']["followup_status"] | null,"guidance"?: string,"id"?: string,"membership_id"?: string | null,"notes"?: string,"student_id": string,"team_evaluation_id": string,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "absent"?: boolean,"activities"?: string,"commitments"?: string,"created_at"?: string,"deliveries"?: string,"difficulty"?: string,"followup_status"?: Database["public"]['Enums']["followup_status"] | null,"guidance"?: string,"id"?: string,"membership_id"?: string | null,"notes"?: string,"student_id"?: string,"team_evaluation_id"?: string,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_evaluations_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_evaluations_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_evaluations_team_evaluation_id_fkey"
      columns: ["team_evaluation_id"]
isOneToOne: false
      referencedRelation: "team_evaluations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_evaluations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string | null,"full_name": string,"id": string,"notes": string,"registration": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string,"registration"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string,"registration"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team_deliverables": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"description": string,"due_date": string | null,"id": string,"milestone_id": string | null,"notes": string,"status": Database["public"]['Enums']["deliverable_status"],"team_id": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string,"due_date"?: string | null,"id"?: string,"milestone_id"?: string | null,"notes"?: string,"status"?: Database["public"]['Enums']["deliverable_status"],"team_id": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string,"due_date"?: string | null,"id"?: string,"milestone_id"?: string | null,"notes"?: string,"status"?: Database["public"]['Enums']["deliverable_status"],"team_id"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_deliverables_milestone_id_fkey"
      columns: ["milestone_id"]
isOneToOne: false
      referencedRelation: "project_milestones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_deliverables_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_deliverables_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_evaluations": {
                  Row: {
                    "challenge_id": string,"created_at": string,"deliveries_completed": string,"developed": string,"difficulties": string,"general_notes": string,"id": string,"monitor_id": string,"next_steps": string,"previous_difficulties_status": Database["public"]['Enums']["previous_difficulty_status"] | null,"previous_followup_notes": string,"session_id": string,"status": Database["public"]['Enums']["evaluation_status"],"submitted_at": string | null,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"deliveries_completed"?: string,"developed"?: string,"difficulties"?: string,"general_notes"?: string,"id"?: string,"monitor_id": string,"next_steps"?: string,"previous_difficulties_status"?: Database["public"]['Enums']["previous_difficulty_status"] | null,"previous_followup_notes"?: string,"session_id": string,"status"?: Database["public"]['Enums']["evaluation_status"],"submitted_at"?: string | null,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"deliveries_completed"?: string,"developed"?: string,"difficulties"?: string,"general_notes"?: string,"id"?: string,"monitor_id"?: string,"next_steps"?: string,"previous_difficulties_status"?: Database["public"]['Enums']["previous_difficulty_status"] | null,"previous_followup_notes"?: string,"session_id"?: string,"status"?: Database["public"]['Enums']["evaluation_status"],"submitted_at"?: string | null,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_evaluations_monitor_id_fkey"
      columns: ["monitor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_evaluations_session_id_challenge_id_fkey"
      columns: ["session_id","challenge_id"]
isOneToOne: false
      referencedRelation: "monitoring_sessions"
      referencedColumns: ["id","challenge_id"]
    },{
      foreignKeyName: "team_evaluations_team_id_challenge_id_fkey"
      columns: ["team_id","challenge_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","challenge_id"]
    }
                  ]
                },"team_memberships": {
                  Row: {
                    "challenge_id": string,"created_at": string,"created_by": string | null,"end_date": string | null,"end_reason": string | null,"ended_by": string | null,"id": string,"start_date": string,"student_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"end_reason"?: string | null,"ended_by"?: string | null,"id"?: string,"start_date"?: string,"student_id": string,"team_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"end_reason"?: string | null,"ended_by"?: string | null,"id"?: string,"start_date"?: string,"student_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_memberships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_ended_by_fkey"
      columns: ["ended_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_team_id_challenge_id_fkey"
      columns: ["team_id","challenge_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","challenge_id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "active": boolean,"assigned_monitor_id": string | null,"challenge_id": string,"created_at": string,"description": string,"id": string,"name": string,"project_title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"assigned_monitor_id"?: string | null,"challenge_id": string,"created_at"?: string,"description"?: string,"id"?: string,"name": string,"project_title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"assigned_monitor_id"?: string | null,"challenge_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"project_title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_assigned_monitor_id_fkey"
      columns: ["assigned_monitor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_student_to_team":
{ Args: { "p_email"?: string,"p_existing_student_id"?: string,"p_full_name": string,"p_registration"?: string,"p_start_date"?: string,"p_team_id": string }; Returns: string
                           },
"can_edit_team_evaluation":
{ Args: { "p_team_evaluation_id": string }; Returns: boolean
                           },
"can_evaluate_challenge":
{ Args: { "p_challenge_id": string }; Returns: boolean
                           },
"can_manage_challenge":
{ Args: { "p_challenge_id": string }; Returns: boolean
                           },
"can_view_challenge":
{ Args: { "p_challenge_id": string }; Returns: boolean
                           },
"can_view_student":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"can_view_team_evaluation":
{ Args: { "p_team_evaluation_id": string }; Returns: boolean
                           },
"find_import_candidates":
{ Args: { "p_challenge_id": string,"p_emails": (string)[],"p_names": (string)[],"p_registrations": (string)[] }; Returns: {
              "current_team_id": string,"current_team_name": string,"email": string,"full_name": string,"registration": string,"student_id": string
            }[]
                           },
"has_challenge_role":
{ Args: { "p_challenge_id": string,"p_roles": (Database["public"]['Enums']["challenge_role"])[] }; Returns: boolean
                           },
"import_roster":
{ Args: { "p_challenge_id": string,"p_rows": Json,"p_start_date"?: string }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_any_coordinator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"purge_orphan_students":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"save_team_evaluation":
{ Args: { "p": Json }; Returns: string
                           },
"score_team_evaluation_id":
{ Args: { "p_student_eval": string,"p_team_eval": string }; Returns: string
                           },
"shares_challenge_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"sync_challenge_sessions":
{ Args: { "p_challenge_id": string }; Returns: undefined
                           },
"team_challenge_id":
{ Args: { "p_team_id": string }; Returns: string
                           },
"transfer_student":
{ Args: { "p_date"?: string,"p_reason"?: string,"p_student_id": string,"p_to_team_id": string }; Returns: string
                           },
"update_criterion":
{ Args: { "p_criterion_id": string,"p_description": string,"p_name": string }; Returns: string
                           }
          }
          Enums: {
            "challenge_role": "coordenador"|"professor"|"monitor","challenge_status": "planejado"|"ativo"|"encerrado"|"arquivado","criterion_scope": "equipe"|"aluno","deliverable_status": "nao_iniciada"|"em_andamento"|"concluida"|"bloqueada","evaluation_status": "rascunho"|"concluida","followup_status": "evoluindo_bem"|"precisa_atencao"|"necessita_intervencao","previous_difficulty_status": "resolvidas"|"parcialmente"|"nao_resolvidas"|"sem_dificuldades","report_type": "diario"|"semanal","session_status": "aberta"|"encerrada"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "challenge_role": ["coordenador", "professor", "monitor"],"challenge_status": ["planejado", "ativo", "encerrado", "arquivado"],"criterion_scope": ["equipe", "aluno"],"deliverable_status": ["nao_iniciada", "em_andamento", "concluida", "bloqueada"],"evaluation_status": ["rascunho", "concluida"],"followup_status": ["evoluindo_bem", "precisa_atencao", "necessita_intervencao"],"previous_difficulty_status": ["resolvidas", "parcialmente", "nao_resolvidas", "sem_dificuldades"],"report_type": ["diario", "semanal"],"session_status": ["aberta", "encerrada"]
          }
        }
} as const
