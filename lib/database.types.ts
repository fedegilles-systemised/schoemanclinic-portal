
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appointments": {
                  Row: {
                    "appointment_type_id": string | null,"booked_online": boolean,"booked_by": string | null,"clinician_id": string | null,"created_at": string,"duration_min": number,"external_id": string | null,"id": string,"location_id": string | null,"patient_id": string,"source": Database["public"]['Enums']["appt_source"],"starts_at": string,"status": Database["public"]['Enums']["appt_status"],"synced_at": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_type_id"?: string | null,"booked_online"?: boolean,"booked_by"?: string | null,"clinician_id"?: string | null,"created_at"?: string,"duration_min": number,"external_id"?: string | null,"id"?: string,"location_id"?: string | null,"patient_id": string,"source": Database["public"]['Enums']["appt_source"],"starts_at": string,"status"?: Database["public"]['Enums']["appt_status"],"synced_at"?: string | null,"type": string
                  }
                  Update: {
                    "appointment_type_id"?: string | null,"booked_online"?: boolean,"booked_by"?: string | null,"clinician_id"?: string | null,"created_at"?: string,"duration_min"?: number,"external_id"?: string | null,"id"?: string,"location_id"?: string | null,"patient_id"?: string,"source"?: Database["public"]['Enums']["appt_source"],"starts_at"?: string,"status"?: Database["public"]['Enums']["appt_status"],"synced_at"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_clinician_id_fkey"
      columns: ["clinician_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_types": {
                  Row: {
                    "active": boolean,"bookable_online": boolean,"bookable_by_patients": boolean,"created_at": string,"description": string | null,"duration_min": number,"id": string,"location_kind": Database["public"]['Enums']["location_kind"],"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"bookable_online"?: boolean,"bookable_by_patients"?: boolean,"created_at"?: string,"description"?: string | null,"duration_min": number,"id"?: string,"location_kind": Database["public"]['Enums']["location_kind"],"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"bookable_online"?: boolean,"bookable_by_patients"?: boolean,"created_at"?: string,"description"?: string | null,"duration_min"?: number,"id"?: string,"location_kind"?: Database["public"]['Enums']["location_kind"],"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": Database["public"]['Enums']["app_role"] | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"metadata": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"metadata"?: Json | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"metadata"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"call_recordings": {
                  Row: {
                    "created_at": string,"error": string | null,"id": string,"note_id": string | null,"patient_id": string,"provider_job_id": string | null,"recorded_by": string,"status": Database["public"]['Enums']["recording_status"],"storage_path": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"note_id"?: string | null,"patient_id": string,"provider_job_id"?: string | null,"recorded_by": string,"status"?: Database["public"]['Enums']["recording_status"],"storage_path": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"note_id"?: string | null,"patient_id"?: string,"provider_job_id"?: string | null,"recorded_by"?: string,"status"?: Database["public"]['Enums']["recording_status"],"storage_path"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_recordings_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"care_team": {
                  Row: {
                    "created_at": string,"id": string,"patient_id": string,"relationship": Database["public"]['Enums']["care_relationship"],"since": string,"staff_id": string,"until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"patient_id": string,"relationship": Database["public"]['Enums']["care_relationship"],"since"?: string,"staff_id": string,"until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patient_id"?: string,"relationship"?: Database["public"]['Enums']["care_relationship"],"since"?: string,"staff_id"?: string,"until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_team_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_team_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clinician_availability": {
                  Row: {
                    "active": boolean,"created_at": string,"end_time": string,"id": string,"location_id": string | null,"staff_id": string,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"end_time": string,"id"?: string,"location_id"?: string | null,"staff_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"end_time"?: string,"id"?: string,"location_id"?: string | null,"staff_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinician_availability_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinician_availability_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clinical_notes": {
                  Row: {
                    "all_options_discussed": boolean,"appointment_id": string | null,"archived_at": string | null,"author_id": string,"body": string,"created_at": string,"customised_options_discussed": boolean,"id": string,"nice_options_discussed": boolean,"options_offered": string | null,"patient_id": string,"side_effects_discussed": boolean,"signed_at": string | null,"signed_by": string | null,"source": Database["public"]['Enums']["note_source"],"status": Database["public"]['Enums']["note_status"],"supersedes_id": string | null,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "all_options_discussed"?: boolean,"appointment_id"?: string | null,"archived_at"?: string | null,"author_id": string,"body": string,"created_at"?: string,"customised_options_discussed"?: boolean,"id"?: string,"nice_options_discussed"?: boolean,"options_offered"?: string | null,"patient_id": string,"side_effects_discussed"?: boolean,"signed_at"?: string | null,"signed_by"?: string | null,"source"?: Database["public"]['Enums']["note_source"],"status"?: Database["public"]['Enums']["note_status"],"supersedes_id"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "all_options_discussed"?: boolean,"appointment_id"?: string | null,"archived_at"?: string | null,"author_id"?: string,"body"?: string,"created_at"?: string,"customised_options_discussed"?: boolean,"id"?: string,"nice_options_discussed"?: boolean,"options_offered"?: string | null,"patient_id"?: string,"side_effects_discussed"?: boolean,"signed_at"?: string | null,"signed_by"?: string | null,"source"?: Database["public"]['Enums']["note_source"],"status"?: Database["public"]['Enums']["note_status"],"supersedes_id"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinical_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_notes_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_notes_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "clinical_notes"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "changed_at": string,"consent_type": Database["public"]['Enums']["consent_type"],"created_at": string,"granted": boolean,"id": string,"patient_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"consent_type": Database["public"]['Enums']["consent_type"],"created_at"?: string,"granted": boolean,"id"?: string,"patient_id": string,"version": string
                  }
                  Update: {
                    "changed_at"?: string,"consent_type"?: Database["public"]['Enums']["consent_type"],"created_at"?: string,"granted"?: boolean,"id"?: string,"patient_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"diagnoses": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"diagnosed_on": string | null,"icd10_code": string | null,"id": string,"label": string,"notes": string | null,"patient_id": string,"recorded_by": string | null,"status": Database["public"]['Enums']["diagnosis_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"diagnosed_on"?: string | null,"icd10_code"?: string | null,"id"?: string,"label": string,"notes"?: string | null,"patient_id": string,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["diagnosis_status"]
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"diagnosed_on"?: string | null,"icd10_code"?: string | null,"id"?: string,"label"?: string,"notes"?: string | null,"patient_id"?: string,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["diagnosis_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "diagnoses_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diagnoses_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["doc_kind"],"patient_id": string | null,"shared_at": string | null,"shared_with_patient": boolean,"source": Database["public"]['Enums']["document_source"] | null,"storage_path": string,"title": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["doc_kind"],"patient_id"?: string | null,"shared_at"?: string | null,"shared_with_patient"?: boolean,"source"?: Database["public"]['Enums']["document_source"] | null,"storage_path": string,"title": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["doc_kind"],"patient_id"?: string | null,"shared_at"?: string | null,"shared_with_patient"?: boolean,"source"?: Database["public"]['Enums']["document_source"] | null,"storage_path"?: string,"title"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"education_assignments": {
                  Row: {
                    "archived_at": string | null,"assigned_by": string,"course_id": string,"created_at": string,"id": string,"patient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"assigned_by": string,"course_id": string,"created_at"?: string,"id"?: string,"patient_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"assigned_by"?: string,"course_id"?: string,"created_at"?: string,"id"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "education_assignments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "education_courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "education_assignments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"education_courses": {
                  Row: {
                    "archived_at": string | null,"cover_path": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"published": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"published"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"published"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_courses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"education_files": {
                  Row: {
                    "archived_at": string | null,"content_type": string,"created_at": string,"created_by": string,"file_name": string,"id": string,"module_id": string,"size_bytes": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"content_type": string,"created_at"?: string,"created_by": string,"file_name": string,"id"?: string,"module_id": string,"size_bytes": number,"storage_path": string
                  }
                  Update: {
                    "archived_at"?: string | null,"content_type"?: string,"created_at"?: string,"created_by"?: string,"file_name"?: string,"id"?: string,"module_id"?: string,"size_bytes"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_files_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "education_files_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "education_modules"
      referencedColumns: ["id"]
    }
                  ]
                },"education_modules": {
                  Row: {
                    "archived_at": string | null,"body": string | null,"content": Json | null,"created_at": string,"id": string,"position": number,"published": boolean,"section_id": string,"title": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"body"?: string | null,"content"?: Json | null,"created_at"?: string,"id"?: string,"position"?: number,"published"?: boolean,"section_id": string,"title": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"body"?: string | null,"content"?: Json | null,"created_at"?: string,"id"?: string,"position"?: number,"published"?: boolean,"section_id"?: string,"title"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_modules_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "education_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"education_progress": {
                  Row: {
                    "completed_at": string,"completed_by": string,"id": string,"module_id": string,"patient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"completed_by": string,"id"?: string,"module_id": string,"patient_id": string
                  }
                  Update: {
                    "completed_at"?: string,"completed_by"?: string,"id"?: string,"module_id"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_progress_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "education_progress_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "education_modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "education_progress_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"education_sections": {
                  Row: {
                    "archived_at": string | null,"course_id": string,"created_at": string,"id": string,"position": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"position"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_sections_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "education_courses"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback_follow_ups": {
                  Row: {
                    "feedback_id": string,"followed_up_at": string,"followed_up_by": string,"id": string,"note": string,"patient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "feedback_id": string,"followed_up_at"?: string,"followed_up_by": string,"id": string,"note": string,"patient_id": string
                  }
                  Update: {
                    "feedback_id"?: string,"followed_up_at"?: string,"followed_up_by"?: string,"id"?: string,"note"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_follow_ups_followed_up_by_fkey"
      columns: ["followed_up_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_follow_ups_feedback_fkey"
      columns: ["feedback_id","patient_id"]
isOneToOne: true
      referencedRelation: "patient_feedback"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "feedback_follow_ups_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"form_submissions": {
                  Row: {
                    "answers": Json,"created_at": string,"id": string,"kind": Database["public"]['Enums']["form_kind"],"patient_id": string,"source_id": string,"submitted_at": string,"submitted_by": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers": Json,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["form_kind"],"patient_id": string,"source_id": string,"submitted_at"?: string,"submitted_by": string,"title": string
                  }
                  Update: {
                    "answers"?: Json,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["form_kind"],"patient_id"?: string,"source_id"?: string,"submitted_at"?: string,"submitted_by"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_submissions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"google_calendar_connections": {
                  Row: {
                    "calendar_id": string,"connected_at": string,"created_at": string,"google_email": string,"refresh_token_encrypted": string,"scope": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calendar_id"?: string,"connected_at"?: string,"created_at"?: string,"google_email": string,"refresh_token_encrypted": string,"scope": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "calendar_id"?: string,"connected_at"?: string,"created_at"?: string,"google_email"?: string,"refresh_token_encrypted"?: string,"scope"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "google_calendar_connections_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"google_revocations": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"queued_at": string,"refresh_token_encrypted": string | null,"revoked_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"queued_at"?: string,"refresh_token_encrypted"?: string | null,"revoked_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"queued_at"?: string,"refresh_token_encrypted"?: string | null,"revoked_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "google_revocations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"import_items": {
                  Row: {
                    "confidence": Database["public"]['Enums']["import_confidence"],"created_at": string,"decided_by": string | null,"decision": Database["public"]['Enums']["import_decision"],"id": string,"import_id": string,"marker_id": string | null,"raw_name": string,"ref_range_text": string | null,"unit": string | null,"value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence": Database["public"]['Enums']["import_confidence"],"created_at"?: string,"decided_by"?: string | null,"decision"?: Database["public"]['Enums']["import_decision"],"id"?: string,"import_id": string,"marker_id"?: string | null,"raw_name": string,"ref_range_text"?: string | null,"unit"?: string | null,"value"?: string | null
                  }
                  Update: {
                    "confidence"?: Database["public"]['Enums']["import_confidence"],"created_at"?: string,"decided_by"?: string | null,"decision"?: Database["public"]['Enums']["import_decision"],"id"?: string,"import_id"?: string,"marker_id"?: string | null,"raw_name"?: string,"ref_range_text"?: string | null,"unit"?: string | null,"value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_items_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_items_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "result_imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_items_marker_id_fkey"
      columns: ["marker_id"]
isOneToOne: false
      referencedRelation: "markers"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_sync_log": {
                  Row: {
                    "created_at": string,"direction": Database["public"]['Enums']["sync_direction"],"entity": string,"entity_id": string | null,"error": string | null,"external_id": string | null,"finished_at": string | null,"id": number,"started_at": string,"status": Database["public"]['Enums']["sync_status"],"system": Database["public"]['Enums']["sync_system"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"direction": Database["public"]['Enums']["sync_direction"],"entity": string,"entity_id"?: string | null,"error"?: string | null,"external_id"?: string | null,"finished_at"?: string | null,"id"?: never,"started_at"?: string,"status": Database["public"]['Enums']["sync_status"],"system": Database["public"]['Enums']["sync_system"]
                  }
                  Update: {
                    "created_at"?: string,"direction"?: Database["public"]['Enums']["sync_direction"],"entity"?: string,"entity_id"?: string | null,"error"?: string | null,"external_id"?: string | null,"finished_at"?: string | null,"id"?: never,"started_at"?: string,"status"?: Database["public"]['Enums']["sync_status"],"system"?: Database["public"]['Enums']["sync_system"]
                  }
                  Relationships: [
                    
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"can_act": boolean | null,"created_at": string,"email": string,"expires_at": string,"failed_attempts": number,"full_name": string | null,"id": string,"invited_by": string,"job_title": string | null,"kind": Database["public"]['Enums']["invitation_kind"],"patient_id": string | null,"relationship": Database["public"]['Enums']["guardian_relationship"] | null,"revoked_at": string | null,"role": Database["public"]['Enums']["app_role"] | null,"sent_at": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"can_act"?: boolean | null,"created_at"?: string,"email": string,"expires_at": string,"failed_attempts"?: number,"full_name"?: string | null,"id"?: string,"invited_by": string,"job_title"?: string | null,"kind": Database["public"]['Enums']["invitation_kind"],"patient_id"?: string | null,"relationship"?: Database["public"]['Enums']["guardian_relationship"] | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"sent_at"?: string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"can_act"?: boolean | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"failed_attempts"?: number,"full_name"?: string | null,"id"?: string,"invited_by"?: string,"job_title"?: string | null,"kind"?: Database["public"]['Enums']["invitation_kind"],"patient_id"?: string | null,"relationship"?: Database["public"]['Enums']["guardian_relationship"] | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"sent_at"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_orders": {
                  Row: {
                    "appointment_id": string | null,"barcode": string | null,"created_at": string,"due_by": string | null,"id": string,"lab_partner_id": string,"order_ref": string,"ordered_by": string,"paid_at": string | null,"panel_id": string,"patient_id": string,"price_pence": number,"sample_taken_at": string | null,"status": Database["public"]['Enums']["order_status"],"stripe_checkout_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"barcode"?: string | null,"created_at"?: string,"due_by"?: string | null,"id"?: string,"lab_partner_id": string,"order_ref": string,"ordered_by": string,"paid_at"?: string | null,"panel_id": string,"patient_id": string,"price_pence": number,"sample_taken_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stripe_checkout_id"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"barcode"?: string | null,"created_at"?: string,"due_by"?: string | null,"id"?: string,"lab_partner_id"?: string,"order_ref"?: string,"ordered_by"?: string,"paid_at"?: string | null,"panel_id"?: string,"patient_id"?: string,"price_pence"?: number,"sample_taken_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stripe_checkout_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_orders_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_lab_partner_id_fkey"
      columns: ["lab_partner_id"]
isOneToOne: false
      referencedRelation: "lab_partners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_ordered_by_fkey"
      columns: ["ordered_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_panel_id_fkey"
      columns: ["panel_id"]
isOneToOne: false
      referencedRelation: "lab_panels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_panel_markers": {
                  Row: {
                    "created_at": string,"marker_id": string,"panel_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"marker_id": string,"panel_id": string
                  }
                  Update: {
                    "created_at"?: string,"marker_id"?: string,"panel_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_panel_markers_marker_id_fkey"
      columns: ["marker_id"]
isOneToOne: false
      referencedRelation: "markers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_panel_markers_panel_id_fkey"
      columns: ["panel_id"]
isOneToOne: false
      referencedRelation: "lab_panels"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_panels": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"code": string,"created_at": string,"fasting_required": boolean,"id": string,"lab_partner_id": string,"name": string,"preparation": string | null,"price_pence": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"code": string,"created_at"?: string,"fasting_required"?: boolean,"id"?: string,"lab_partner_id": string,"name": string,"preparation"?: string | null,"price_pence": number
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"code"?: string,"created_at"?: string,"fasting_required"?: boolean,"id"?: string,"lab_partner_id"?: string,"name"?: string,"preparation"?: string | null,"price_pence"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_panels_lab_partner_id_fkey"
      columns: ["lab_partner_id"]
isOneToOne: false
      referencedRelation: "lab_partners"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_partners": {
                  Row: {
                    "address": string | null,"api_enabled": boolean,"created_at": string,"id": string,"name": string,"results_channel": Database["public"]['Enums']["results_channel"]
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"api_enabled"?: boolean,"created_at"?: string,"id"?: string,"name": string,"results_channel": Database["public"]['Enums']["results_channel"]
                  }
                  Update: {
                    "address"?: string | null,"api_enabled"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"results_channel"?: Database["public"]['Enums']["results_channel"]
                  }
                  Relationships: [
                    
                  ]
                },"lab_report_signoffs": {
                  Row: {
                    "action_note": string | null,"id": string,"ordered_by": string | null,"outcome": string,"patient_id": string,"report_id": string,"signed_at": string,"signed_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_note"?: string | null,"id": string,"ordered_by"?: string | null,"outcome": string,"patient_id": string,"report_id": string,"signed_at"?: string,"signed_by": string
                  }
                  Update: {
                    "action_note"?: string | null,"id"?: string,"ordered_by"?: string | null,"outcome"?: string,"patient_id"?: string,"report_id"?: string,"signed_at"?: string,"signed_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_report_signoffs_ordered_by_fkey"
      columns: ["ordered_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_report_signoffs_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_report_signoffs_report_fkey"
      columns: ["report_id","patient_id"]
isOneToOne: true
      referencedRelation: "lab_reports"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "lab_report_signoffs_signed_by_fkey"
      columns: ["signed_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_reports": {
                  Row: {
                    "created_at": string,"document_id": string | null,"external_lab_name": string | null,"id": string,"lab_order_id": string | null,"lab_partner_id": string | null,"patient_comment": string | null,"patient_id": string,"received_at": string,"released_at": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"sample_date": string | null,"status": Database["public"]['Enums']["report_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id"?: string | null,"external_lab_name"?: string | null,"id"?: string,"lab_order_id"?: string | null,"lab_partner_id"?: string | null,"patient_comment"?: string | null,"patient_id": string,"received_at"?: string,"released_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"sample_date"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string | null,"external_lab_name"?: string | null,"id"?: string,"lab_order_id"?: string | null,"lab_partner_id"?: string | null,"patient_comment"?: string | null,"patient_id"?: string,"received_at"?: string,"released_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"sample_date"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_reports_document_fkey"
      columns: ["document_id","patient_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "lab_reports_lab_order_id_fkey"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_reports_lab_partner_id_fkey"
      columns: ["lab_partner_id"]
isOneToOne: false
      referencedRelation: "lab_partners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_reports_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"created_at": string,"ghl_calendar_id": string | null,"id": string,"kind": Database["public"]['Enums']["location_kind"],"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"ghl_calendar_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["location_kind"],"name": string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"ghl_calendar_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["location_kind"],"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"marker_conversions": {
                  Row: {
                    "created_at": string,"factor": number,"from_unit": string,"marker_id": string,"offset_value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"factor": number,"from_unit": string,"marker_id": string,"offset_value"?: number
                  }
                  Update: {
                    "created_at"?: string,"factor"?: number,"from_unit"?: string,"marker_id"?: string,"offset_value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "marker_conversions_marker_id_fkey"
      columns: ["marker_id"]
isOneToOne: false
      referencedRelation: "markers"
      referencedColumns: ["id"]
    }
                  ]
                },"markers": {
                  Row: {
                    "category": string,"code": string,"created_at": string,"explainer": string | null,"id": string,"name": string,"ref_high": number | null,"ref_low": number | null,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"code": string,"created_at"?: string,"explainer"?: string | null,"id"?: string,"name": string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null
                  }
                  Update: {
                    "category"?: string,"code"?: string,"created_at"?: string,"explainer"?: string | null,"id"?: string,"name"?: string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"medications": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"dose": string | null,"id": string,"instructions": string | null,"kind": Database["public"]['Enums']["med_kind"],"name": string,"patient_id": string,"pharmacy": string | null,"prescriber_id": string | null,"run_out_reminded_for": string | null,"semble_prescription_id": string | null,"start_date": string,"status": Database["public"]['Enums']["med_status"],"supply_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"dose"?: string | null,"id"?: string,"instructions"?: string | null,"kind": Database["public"]['Enums']["med_kind"],"name": string,"patient_id": string,"pharmacy"?: string | null,"prescriber_id"?: string | null,"run_out_reminded_for"?: string | null,"semble_prescription_id"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["med_status"],"supply_days": number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"dose"?: string | null,"id"?: string,"instructions"?: string | null,"kind"?: Database["public"]['Enums']["med_kind"],"name"?: string,"patient_id"?: string,"pharmacy"?: string | null,"prescriber_id"?: string | null,"run_out_reminded_for"?: string | null,"semble_prescription_id"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["med_status"],"supply_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "medications_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medications_prescriber_id_fkey"
      columns: ["prescriber_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"enabled": boolean,"topic": Database["public"]['Enums']["notification_topic"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"enabled"?: boolean,"topic": Database["public"]['Enums']["notification_topic"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"enabled"?: boolean,"topic"?: Database["public"]['Enums']["notification_topic"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"topic": Database["public"]['Enums']["notification_topic"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"topic": Database["public"]['Enums']["notification_topic"],"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"topic"?: Database["public"]['Enums']["notification_topic"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_allergies": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"patient_id": string,"reaction": string | null,"recorded_by": string | null,"severity": string | null,"substance": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"patient_id": string,"reaction"?: string | null,"recorded_by"?: string | null,"severity"?: string | null,"substance": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"patient_id"?: string,"reaction"?: string | null,"recorded_by"?: string | null,"severity"?: string | null,"substance"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_allergies_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_allergies_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_feedback": {
                  Row: {
                    "answered_at": string | null,"answered_by": string | null,"appointment_id": string | null,"could_improve": string | null,"created_at": string,"expires_at": string,"follow_up_due": string | null,"id": string,"may_quote": boolean | null,"patient_id": string,"quote_checked_at": string | null,"quote_checked_by": string | null,"rating": string | null,"reminded_at": string | null,"score": number | null,"sent_at": string,"wants_contact": boolean | null,"went_well": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"appointment_id"?: string | null,"could_improve"?: string | null,"created_at"?: string,"expires_at"?: string,"follow_up_due"?: string | null,"id"?: string,"may_quote"?: boolean | null,"patient_id": string,"quote_checked_at"?: string | null,"quote_checked_by"?: string | null,"rating"?: string | null,"reminded_at"?: string | null,"score"?: number | null,"sent_at"?: string,"wants_contact"?: boolean | null,"went_well"?: string | null
                  }
                  Update: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"appointment_id"?: string | null,"could_improve"?: string | null,"created_at"?: string,"expires_at"?: string,"follow_up_due"?: string | null,"id"?: string,"may_quote"?: boolean | null,"patient_id"?: string,"quote_checked_at"?: string | null,"quote_checked_by"?: string | null,"rating"?: string | null,"reminded_at"?: string | null,"score"?: number | null,"sent_at"?: string,"wants_contact"?: boolean | null,"went_well"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_feedback_answered_by_fkey"
      columns: ["answered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_feedback_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_feedback_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_feedback_quote_checked_by_fkey"
      columns: ["quote_checked_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_guardians": {
                  Row: {
                    "can_act": boolean,"can_view": boolean,"created_at": string,"guardian_user_id": string,"id": string,"patient_id": string,"relationship": Database["public"]['Enums']["guardian_relationship"],"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "can_act"?: boolean,"can_view"?: boolean,"created_at"?: string,"guardian_user_id": string,"id"?: string,"patient_id": string,"relationship": Database["public"]['Enums']["guardian_relationship"],"verified_by"?: string | null
                  }
                  Update: {
                    "can_act"?: boolean,"can_view"?: boolean,"created_at"?: string,"guardian_user_id"?: string,"id"?: string,"patient_id"?: string,"relationship"?: Database["public"]['Enums']["guardian_relationship"],"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_guardians_guardian_user_id_fkey"
      columns: ["guardian_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_guardians_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_guardians_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_profiles": {
                  Row: {
                    "archived_at": string | null,"clinic_ref": string,"booked_online_at": string | null,"contact_email": string | null,"contact_phone": string | null,"country": string | null,"created_at": string,"date_of_birth": string,"first_name": string,"gender_identity": string | null,"ghl_contact_id": string | null,"id": string,"last_name": string,"primary_clinician_id": string | null,"semble_patient_id": string | null,"sex": string | null,"stripe_customer_id": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"clinic_ref": string,"booked_online_at"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"country"?: string | null,"created_at"?: string,"date_of_birth": string,"first_name": string,"gender_identity"?: string | null,"ghl_contact_id"?: string | null,"id"?: string,"last_name": string,"primary_clinician_id"?: string | null,"semble_patient_id"?: string | null,"sex"?: string | null,"stripe_customer_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"clinic_ref"?: string,"booked_online_at"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"country"?: string | null,"created_at"?: string,"date_of_birth"?: string,"first_name"?: string,"gender_identity"?: string | null,"ghl_contact_id"?: string | null,"id"?: string,"last_name"?: string,"primary_clinician_id"?: string | null,"semble_patient_id"?: string | null,"sex"?: string | null,"stripe_customer_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_profiles_primary_clinician_id_fkey"
      columns: ["primary_clinician_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"last_seen_at": string | null,"locale": string,"phone": string | null,"status": Database["public"]['Enums']["account_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"last_seen_at"?: string | null,"locale"?: string,"phone"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"last_seen_at"?: string | null,"locale"?: string,"phone"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prescribable_medicines": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"sort_order": number,"weight_loss": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"weight_loss"?: boolean
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"weight_loss"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"question_replies": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"from_clinic": boolean,"id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"from_clinic": boolean,"id"?: string,"question_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"from_clinic"?: boolean,"id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_replies_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_replies_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "answered_at": string | null,"asked_by": string,"body": string,"created_at": string,"ghl_conversation_id": string | null,"id": string,"patient_id": string,"status": Database["public"]['Enums']["question_status"],"subject": string,"urgency": Database["public"]['Enums']["question_urgency"]
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"asked_by": string,"body": string,"created_at"?: string,"ghl_conversation_id"?: string | null,"id"?: string,"patient_id": string,"status"?: Database["public"]['Enums']["question_status"],"subject": string,"urgency"?: Database["public"]['Enums']["question_urgency"]
                  }
                  Update: {
                    "answered_at"?: string | null,"asked_by"?: string,"body"?: string,"created_at"?: string,"ghl_conversation_id"?: string | null,"id"?: string,"patient_id"?: string,"status"?: Database["public"]['Enums']["question_status"],"subject"?: string,"urgency"?: Database["public"]['Enums']["question_urgency"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_asked_by_fkey"
      columns: ["asked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"repeat_request_items": {
                  Row: {
                    "created_at": string,"id": string,"medication_id": string | null,"medicine_id": string | null,"other_name": string | null,"patient_id": string,"request_id": string,"supply_months": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"medication_id"?: string | null,"medicine_id"?: string | null,"other_name"?: string | null,"patient_id": string,"request_id": string,"supply_months": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"medication_id"?: string | null,"medicine_id"?: string | null,"other_name"?: string | null,"patient_id"?: string,"request_id"?: string,"supply_months"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "repeat_request_items_medication_fkey"
      columns: ["medication_id","patient_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "repeat_request_items_medicine_id_fkey"
      columns: ["medicine_id"]
isOneToOne: false
      referencedRelation: "prescribable_medicines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repeat_request_items_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repeat_request_items_request_fkey"
      columns: ["request_id","patient_id"]
isOneToOne: false
      referencedRelation: "repeat_requests"
      referencedColumns: ["id","patient_id"]
    }
                  ]
                },"repeat_requests": {
                  Row: {
                    "cancelled_at": string | null,"created_at": string,"decided_by": string | null,"decision_note": string | null,"fee_pence": number,"ghl_task_id": string | null,"has_future_appointment": boolean | null,"has_side_effects": boolean | null,"id": string,"medication_id": string | null,"note": string | null,"paid_at": string | null,"patient_id": string,"requested_at": string,"requested_by": string,"resolved_at": string | null,"side_effects": string | null,"status": Database["public"]['Enums']["request_status"],"still_losing_weight": boolean | null,"stripe_checkout_session_id": string | null,"stripe_payment_intent_id": string | null,"wants_appointment": boolean | null,"weight_lost_last_month": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"created_at"?: string,"decided_by"?: string | null,"decision_note"?: string | null,"fee_pence"?: number,"ghl_task_id"?: string | null,"has_future_appointment"?: boolean | null,"has_side_effects"?: boolean | null,"id"?: string,"medication_id"?: string | null,"note"?: string | null,"paid_at"?: string | null,"patient_id": string,"requested_at"?: string,"requested_by": string,"resolved_at"?: string | null,"side_effects"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"still_losing_weight"?: boolean | null,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"wants_appointment"?: boolean | null,"weight_lost_last_month"?: string | null
                  }
                  Update: {
                    "cancelled_at"?: string | null,"created_at"?: string,"decided_by"?: string | null,"decision_note"?: string | null,"fee_pence"?: number,"ghl_task_id"?: string | null,"has_future_appointment"?: boolean | null,"has_side_effects"?: boolean | null,"id"?: string,"medication_id"?: string | null,"note"?: string | null,"paid_at"?: string | null,"patient_id"?: string,"requested_at"?: string,"requested_by"?: string,"resolved_at"?: string | null,"side_effects"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"still_losing_weight"?: boolean | null,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"wants_appointment"?: boolean | null,"weight_lost_last_month"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "repeat_requests_medication_fkey"
      columns: ["medication_id","patient_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "repeat_requests_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repeat_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repeat_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"result_imports": {
                  Row: {
                    "created_at": string,"document_id": string,"handled_by": string | null,"id": string,"lab_report_id": string | null,"patient_id": string | null,"received_at": string,"status": Database["public"]['Enums']["import_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id": string,"handled_by"?: string | null,"id"?: string,"lab_report_id"?: string | null,"patient_id"?: string | null,"received_at"?: string,"status"?: Database["public"]['Enums']["import_status"]
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string,"handled_by"?: string | null,"id"?: string,"lab_report_id"?: string | null,"patient_id"?: string | null,"received_at"?: string,"status"?: Database["public"]['Enums']["import_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_imports_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_imports_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_imports_lab_report_id_fkey"
      columns: ["lab_report_id"]
isOneToOne: false
      referencedRelation: "lab_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_imports_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"results": {
                  Row: {
                    "created_at": string,"doctor_comment": string | null,"flag": Database["public"]['Enums']["result_flag"] | null,"id": string,"lab_report_id": string,"marker_id": string,"original_unit": string | null,"original_value": number | null,"patient_id": string,"ref_high": number | null,"ref_low": number | null,"unit": string | null,"value_numeric": number | null,"value_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doctor_comment"?: string | null,"flag"?: Database["public"]['Enums']["result_flag"] | null,"id"?: string,"lab_report_id": string,"marker_id": string,"original_unit"?: string | null,"original_value"?: number | null,"patient_id": string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"doctor_comment"?: string | null,"flag"?: Database["public"]['Enums']["result_flag"] | null,"id"?: string,"lab_report_id"?: string,"marker_id"?: string,"original_unit"?: string | null,"original_value"?: number | null,"patient_id"?: string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_lab_report_fkey"
      columns: ["lab_report_id","patient_id"]
isOneToOne: false
      referencedRelation: "lab_reports"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "results_marker_id_fkey"
      columns: ["marker_id"]
isOneToOne: false
      referencedRelation: "markers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"safeguarding_alerts": {
                  Row: {
                    "added_by": string | null,"alert_type": string,"created_at": string,"id": string,"note": string,"patient_id": string,"review_due": string | null,"severity": Database["public"]['Enums']["safeguarding_severity"],"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"alert_type": string,"created_at"?: string,"id"?: string,"note": string,"patient_id": string,"review_due"?: string | null,"severity": Database["public"]['Enums']["safeguarding_severity"],"status"?: string
                  }
                  Update: {
                    "added_by"?: string | null,"alert_type"?: string,"created_at"?: string,"id"?: string,"note"?: string,"patient_id"?: string,"review_due"?: string | null,"severity"?: Database["public"]['Enums']["safeguarding_severity"],"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "safeguarding_alerts_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "safeguarding_alerts_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_locations": {
                  Row: {
                    "created_at": string,"is_primary": boolean,"location_id": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_primary"?: boolean,"location_id": string,"staff_id": string
                  }
                  Update: {
                    "created_at"?: string,"is_primary"?: boolean,"location_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_locations_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_profiles": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"clinical_role": Database["public"]['Enums']["staff_role"],"created_at": string,"ghl_user_id": string | null,"gmc_number": string | null,"id": string,"job_title": string | null,"semble_user_id": string | null,"signature_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"clinical_role": Database["public"]['Enums']["staff_role"],"created_at"?: string,"ghl_user_id"?: string | null,"gmc_number"?: string | null,"id"?: string,"job_title"?: string | null,"semble_user_id"?: string | null,"signature_path"?: string | null,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"clinical_role"?: Database["public"]['Enums']["staff_role"],"created_at"?: string,"ghl_user_id"?: string | null,"gmc_number"?: string | null,"id"?: string,"job_title"?: string | null,"semble_user_id"?: string | null,"signature_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wearable_readings": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"device": string | null,"entered_by": string,"id": string,"measured_on": string,"metric": Database["public"]['Enums']["wearable_metric"],"patient_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"device"?: string | null,"entered_by": string,"id"?: string,"measured_on": string,"metric": Database["public"]['Enums']["wearable_metric"],"patient_id": string,"value": number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"device"?: string | null,"entered_by"?: string,"id"?: string,"measured_on"?: string,"metric"?: Database["public"]['Enums']["wearable_metric"],"patient_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "wearable_readings_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wearable_readings_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patient_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "created_at": string,"error": string | null,"event_type": string,"external_event_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"source": Database["public"]['Enums']["webhook_source"],"status": Database["public"]['Enums']["webhook_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"event_type": string,"external_event_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"source": Database["public"]['Enums']["webhook_source"],"status"?: Database["public"]['Enums']["webhook_status"]
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"event_type"?: string,"external_event_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"source"?: Database["public"]['Enums']["webhook_source"],"status"?: Database["public"]['Enums']["webhook_status"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "check_feedback_quote":
{ Args: { "_checked": boolean,"_feedback": string }; Returns: undefined
                           },
"log_feedback_export":
{ Args: { "_rows": number,"_set": string }; Returns: undefined
                           },
"due_feedback_reminders":
{ Args: Record<PropertyKey, never>; Returns: {
              "feedback_id": string,"patient_id": string
            }[]
                           },
"queue_feedback":
{ Args: Record<PropertyKey, never>; Returns: {
              "feedback_id": string,"patient_id": string
            }[]
                           },
"record_feedback_follow_up":
{ Args: { "_feedback": string,"_note": string }; Returns: undefined
                           },
"submit_feedback":
{ Args: { "_could_improve": string,"_feedback": string,"_may_quote": boolean,"_score": number,"_wants_contact": boolean,"_went_well": string }; Returns: string
                           },
"book_online":
{ Args: { "_date_of_birth": string,"_email": string,"_first_name": string,"_last_name": string,"_location": string | null,"_phone": string,"_staff": string,"_starts_at": string,"_type": string }; Returns: {
              "appointment_id": string,"patient_id": string
            }[]
                           },
"clinic_diary":
{ Args: { "_from": string,"_to": string }; Returns: {
              "booked_online": boolean,"can_open": boolean,"clinic_ref": string,"clinician_id": string,"duration_min": number,"id": string,"location_id": string,"new_patient": boolean,"patient_id": string,"patient_name": string,"starts_at": string,"status": Database["public"]['Enums']["appt_status"],"type": string
            }[]
                           },
"move_appointment":
{ Args: { "_appointment": string,"_location"?: string,"_staff": string,"_starts_at": string }; Returns: undefined
                           },
"online_booking_clinicians":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"job_title": string,"profile_id": string,"staff_id": string
            }[]
                           },
"online_busy":
{ Args: { "_from": string,"_staff": string,"_to": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"accept_invitation":
{ Args: { "_date_of_birth"?: string,"_full_name"?: string,"_token_hash": string,"_user_id": string }; Returns: Database["public"]['Enums']["invitation_kind"]
                           },
"activity_log":
{ Args: { "_before"?: number,"_limit"?: number }; Returns: {
              "action": string,"actor_name": string,"actor_role": Database["public"]['Enums']["app_role"],"created_at": string,"entity": string,"id": number,"patient_name": string,"patient_ref": string
            }[]
                           },
"auth_throttle_hit":
{ Args: { "_keys": (string)[],"_limits": (number)[],"_window_seconds": number }; Returns: boolean
                           },
"book_appointment":
{ Args: { "_location"?: string,"_patient": string,"_staff": string,"_starts_at": string,"_type": string }; Returns: string
                           },
"cancel_appointment":
{ Args: { "_appointment": string }; Returns: undefined
                           },
"clinician_busy":
{ Args: { "_from": string,"_staff": string,"_to": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"create_invitation":
{ Args: { "_can_act"?: boolean,"_confirm_email_mismatch"?: boolean,"_email": string,"_full_name"?: string,"_inviter": string,"_job_title"?: string,"_kind": Database["public"]['Enums']["invitation_kind"],"_new_patient"?: Json,"_patient_id"?: string,"_relationship"?: Database["public"]['Enums']["guardian_relationship"],"_role"?: Database["public"]['Enums']["app_role"],"_token_hash": string }; Returns: string
                           },
"enter_report":
{ Args: { "_document_id"?: string,"_import_id"?: string,"_items": Json,"_lab_name"?: string,"_patient": string,"_sample_date": string }; Returns: string
                           },
"get_bookable_clinicians":
{ Args: { "_patient": string }; Returns: {
              "clinical_role": Database["public"]['Enums']["staff_role"],"full_name": string,"profile_id": string,"staff_id": string
            }[]
                           },
"get_invitable_patients":
{ Args: Record<PropertyKey, never>; Returns: {
              "clinic_ref": string,"first_name": string,"has_account": boolean,"id": string,"last_name": string
            }[]
                           },
"get_invitation":
{ Args: { "_token_hash": string }; Returns: {
              "account_exists": boolean,"email": string,"expires_at": string,"full_name": string,"inviter_name": string,"job_title": string,"kind": Database["public"]['Enums']["invitation_kind"],"role": Database["public"]['Enums']["app_role"],"status": string
            }[]
                           },
"get_my_patient_record":
{ Args: Record<PropertyKey, never>; Returns: {
              "can_act": boolean,"clinic_ref": string,"contact_email": string,"contact_phone": string,"country": string,"date_of_birth": string,"first_name": string,"id": string,"is_self": boolean,"last_name": string,"primary_clinician_id": string,"sex": string
            }[]
                           },
"get_staff_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"clinical_role": Database["public"]['Enums']["staff_role"],"full_name": string,"job_title": string,"profile_id": string,"staff_id": string
            }[]
                           },
"reorder_course":
{ Args: { "_course": string,"_order": Json }; Returns: undefined
                           },
"request_repeat":
{ Args: { "_has_future_appointment": boolean,"_has_side_effects": boolean,"_items": Json,"_note": string,"_patient": string,"_side_effects": string,"_still_losing_weight": boolean,"_wants_appointment": boolean,"_weight_lost_last_month": string }; Returns: string
                           },
"cancel_repeat_request":
{ Args: { "_request": string }; Returns: undefined
                           },
"decide_repeat_request":
{ Args: { "_note": string,"_request": string,"_status": Database["public"]['Enums']["request_status"] }; Returns: undefined
                           },
"mark_repeat_request_paid":
{ Args: { "_amount": number,"_payment_intent": string,"_request": string,"_session": string }; Returns: boolean
                           },
"mark_run_out_reminded":
{ Args: { "_medication": string,"_run_out": string }; Returns: undefined
                           },
"close_question":
{ Args: { "_question": string }; Returns: undefined
                           },
"reply_to_question":
{ Args: { "_body": string,"_question": string }; Returns: boolean
                           },
"mark_google_revocation":
{ Args: { "_id": string,"_revoked": boolean }; Returns: undefined
                           },
"log_record_view":
{ Args: { "_entity": string,"_entity_id"?: string,"_patient": string }; Returns: undefined
                           },
"register_import":
{ Args: { "_document_id": string }; Returns: string
                           },
"remove_google_calendar_connection":
{ Args: { "_user": string }; Returns: undefined
                           },
"set_appointment_calendar_event":
{ Args: { "_appointment": string,"_event": string }; Returns: undefined
                           },
"set_patient_ghl_contact":
{ Args: { "_contact": string,"_patient": string }; Returns: undefined
                           },
"sign_clinical_note":
{ Args: { "_note": string }; Returns: undefined
                           },
"save_google_calendar_connection":
{ Args: { "_google_email": string,"_refresh_token_encrypted": string,"_scope": string,"_user": string }; Returns: undefined
                           },
"recording_failed":
{ Args: { "_error": string,"_recording": string }; Returns: undefined
                           },
"recording_sent":
{ Args: { "_job": string,"_recording": string }; Returns: undefined
                           },
"recording_transcribed":
{ Args: { "_body": string,"_recording": string,"_title": string }; Returns: string
                           },
"release_report":
{ Args: { "_action_note"?: string,"_comment"?: string,"_outcome"?: string,"_report": string }; Returns: undefined
                           },
"resend_invitation":
{ Args: { "_invitation": string,"_inviter": string,"_token_hash": string }; Returns: string
                           },
"revoke_invitation":
{ Args: { "_invitation": string,"_inviter": string }; Returns: undefined
                           },
"verify_invitation_identity":
{ Args: { "_date_of_birth"?: string,"_token_hash": string }; Returns: string
                           }
          }
          Enums: {
            "account_status": "invited"|"active"|"suspended","app_role": "patient"|"doctor"|"pa"|"health_coach"|"admin"|"nurse","appt_source": "ghl"|"semble"|"clinic_hub","appt_status": "booked"|"confirmed"|"cancelled"|"completed"|"no_show","care_relationship": "primary_doctor"|"doctor"|"pa"|"health_coach"|"nurse","consent_type": "care"|"partner_labs"|"research","diagnosis_status": "active"|"monitoring"|"treating"|"under_investigation"|"resolved","form_kind": "feedback"|"repeat_request"|"question","doc_kind": "letter"|"lab_report"|"patient_upload"|"referral"|"other","document_source": "patient_upload"|"email"|"tdl"|"semble"|"staff_upload","guardian_relationship": "parent"|"carer"|"power_of_attorney","import_confidence": "high"|"medium"|"low","import_decision": "pending"|"confirmed"|"rejected","import_status": "needs_match"|"matched"|"confirmed"|"rejected","invitation_kind": "patient"|"guardian"|"team","location_kind": "clinic"|"video","med_kind": "prescription"|"supplement","med_status": "active"|"paused"|"stopped","note_source": "typed"|"recording","note_status": "draft"|"signed","notification_channel": "email"|"whatsapp"|"sms"|"portal","notification_topic": "results"|"payments"|"appointments"|"messages","order_status": "sent_to_patient"|"paid"|"sample_taken"|"results_in"|"reviewed"|"cancelled","question_status": "awaiting_reply"|"answered"|"closed","question_urgency": "routine"|"important","recording_status": "uploading"|"transcribing"|"transcribed"|"failed","report_status": "awaiting_review"|"reviewed"|"released","request_status": "requested"|"approved"|"sent_to_pharmacy"|"declined","result_flag": "normal"|"borderline"|"low"|"high"|"critical","results_channel": "api"|"email"|"upload","safeguarding_severity": "low"|"moderate"|"high","staff_role": "doctor"|"pa"|"health_coach"|"admin"|"nurse","sync_direction": "in"|"out","sync_status": "ok"|"failed"|"retrying","sync_system": "ghl"|"semble"|"stripe"|"tdl"|"fathom","webhook_source": "stripe"|"tdl"|"ghl"|"semble"|"fathom","webhook_status": "received"|"processed"|"failed"|"ignored","wearable_metric": "sleep_minutes"|"sleep_score"|"readiness_score"|"resting_heart_rate"|"hrv_ms"|"steps"|"active_minutes"|"weight_kg"|"body_fat_percent"|"vo2_max"|"spo2_percent"|"temperature_deviation_c"
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
  "public": {
          Enums: {
            "account_status": ["invited", "active", "suspended"],"app_role": ["patient", "doctor", "pa", "health_coach", "admin", "nurse"],"appt_source": ["ghl", "semble", "clinic_hub"],"appt_status": ["booked", "confirmed", "cancelled", "completed", "no_show"],"care_relationship": ["primary_doctor", "doctor", "pa", "health_coach", "nurse"],"consent_type": ["care", "partner_labs", "research"],"diagnosis_status": ["active", "monitoring", "treating", "under_investigation", "resolved"],"form_kind": ["feedback", "repeat_request", "question"],"doc_kind": ["letter", "lab_report", "patient_upload", "referral", "other"],"document_source": ["patient_upload", "email", "tdl", "semble", "staff_upload"],"guardian_relationship": ["parent", "carer", "power_of_attorney"],"import_confidence": ["high", "medium", "low"],"import_decision": ["pending", "confirmed", "rejected"],"import_status": ["needs_match", "matched", "confirmed", "rejected"],"invitation_kind": ["patient", "guardian", "team"],"location_kind": ["clinic", "video"],"med_kind": ["prescription", "supplement"],"med_status": ["active", "paused", "stopped"],"note_source": ["typed", "recording"],"note_status": ["draft", "signed"],"notification_channel": ["email", "whatsapp", "sms", "portal"],"notification_topic": ["results", "payments", "appointments", "messages"],"order_status": ["sent_to_patient", "paid", "sample_taken", "results_in", "reviewed", "cancelled"],"question_status": ["awaiting_reply", "answered", "closed"],"question_urgency": ["routine", "important"],"recording_status": ["uploading", "transcribing", "transcribed", "failed"],"report_status": ["awaiting_review", "reviewed", "released"],"request_status": ["requested", "approved", "sent_to_pharmacy", "declined"],"result_flag": ["normal", "borderline", "low", "high", "critical"],"results_channel": ["api", "email", "upload"],"safeguarding_severity": ["low", "moderate", "high"],"staff_role": ["doctor", "pa", "health_coach", "admin", "nurse"],"sync_direction": ["in", "out"],"sync_status": ["ok", "failed", "retrying"],"sync_system": ["ghl", "semble", "stripe", "tdl", "fathom"],"webhook_source": ["stripe", "tdl", "ghl", "semble", "fathom"],"webhook_status": ["received", "processed", "failed", "ignored"],"wearable_metric": ["sleep_minutes", "sleep_score", "readiness_score", "resting_heart_rate", "hrv_ms", "steps", "active_minutes", "weight_kg", "body_fat_percent", "vo2_max", "spo2_percent", "temperature_deviation_c"]
          }
        }
} as const
