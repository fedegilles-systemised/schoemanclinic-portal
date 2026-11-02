
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appointments": {
                  Row: {
                    "clinician_id": string | null,"created_at": string,"duration_min": number,"external_id": string | null,"id": string,"location_id": string | null,"patient_id": string,"source": Database["public"]['Enums']["appt_source"],"starts_at": string,"status": Database["public"]['Enums']["appt_status"],"synced_at": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinician_id"?: string | null,"created_at"?: string,"duration_min": number,"external_id"?: string | null,"id"?: string,"location_id"?: string | null,"patient_id": string,"source": Database["public"]['Enums']["appt_source"],"starts_at": string,"status"?: Database["public"]['Enums']["appt_status"],"synced_at"?: string | null,"type": string
                  }
                  Update: {
                    "clinician_id"?: string | null,"created_at"?: string,"duration_min"?: number,"external_id"?: string | null,"id"?: string,"location_id"?: string | null,"patient_id"?: string,"source"?: Database["public"]['Enums']["appt_source"],"starts_at"?: string,"status"?: Database["public"]['Enums']["appt_status"],"synced_at"?: string | null,"type"?: string
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
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"patient_id": string | null,"role": Database["public"]['Enums']["app_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by": string,"patient_id"?: string | null,"role": Database["public"]['Enums']["app_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"patient_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"token_hash"?: string
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
                    "archived_at": string | null,"created_at": string,"dose": string | null,"id": string,"instructions": string | null,"kind": Database["public"]['Enums']["med_kind"],"name": string,"patient_id": string,"pharmacy": string | null,"prescriber_id": string | null,"semble_prescription_id": string | null,"start_date": string,"status": Database["public"]['Enums']["med_status"],"supply_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"dose"?: string | null,"id"?: string,"instructions"?: string | null,"kind": Database["public"]['Enums']["med_kind"],"name": string,"patient_id": string,"pharmacy"?: string | null,"prescriber_id"?: string | null,"semble_prescription_id"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["med_status"],"supply_days": number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"dose"?: string | null,"id"?: string,"instructions"?: string | null,"kind"?: Database["public"]['Enums']["med_kind"],"name"?: string,"patient_id"?: string,"pharmacy"?: string | null,"prescriber_id"?: string | null,"semble_prescription_id"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["med_status"],"supply_days"?: number
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
                    "created_at": string,"id": string,"patient_id": string,"reaction": string | null,"recorded_by": string | null,"severity": string | null,"substance": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"patient_id": string,"reaction"?: string | null,"recorded_by"?: string | null,"severity"?: string | null,"substance": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patient_id"?: string,"reaction"?: string | null,"recorded_by"?: string | null,"severity"?: string | null,"substance"?: string
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
                    "archived_at": string | null,"clinic_ref": string,"contact_email": string | null,"contact_phone": string | null,"country": string | null,"created_at": string,"date_of_birth": string,"first_name": string,"ghl_contact_id": string | null,"id": string,"last_name": string,"primary_clinician_id": string | null,"semble_patient_id": string | null,"sex": string | null,"stripe_customer_id": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"clinic_ref": string,"contact_email"?: string | null,"contact_phone"?: string | null,"country"?: string | null,"created_at"?: string,"date_of_birth": string,"first_name": string,"ghl_contact_id"?: string | null,"id"?: string,"last_name": string,"primary_clinician_id"?: string | null,"semble_patient_id"?: string | null,"sex"?: string | null,"stripe_customer_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"clinic_ref"?: string,"contact_email"?: string | null,"contact_phone"?: string | null,"country"?: string | null,"created_at"?: string,"date_of_birth"?: string,"first_name"?: string,"ghl_contact_id"?: string | null,"id"?: string,"last_name"?: string,"primary_clinician_id"?: string | null,"semble_patient_id"?: string | null,"sex"?: string | null,"stripe_customer_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
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
                },"repeat_requests": {
                  Row: {
                    "created_at": string,"fee_pence": number,"ghl_task_id": string | null,"id": string,"medication_id": string,"note": string | null,"patient_id": string,"requested_at": string,"requested_by": string,"resolved_at": string | null,"status": Database["public"]['Enums']["request_status"],"stripe_payment_intent_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fee_pence"?: number,"ghl_task_id"?: string | null,"id"?: string,"medication_id": string,"note"?: string | null,"patient_id": string,"requested_at"?: string,"requested_by": string,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"stripe_payment_intent_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"fee_pence"?: number,"ghl_task_id"?: string | null,"id"?: string,"medication_id"?: string,"note"?: string | null,"patient_id"?: string,"requested_at"?: string,"requested_by"?: string,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"stripe_payment_intent_id"?: string | null
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
                    "created_at": string,"doctor_comment": string | null,"flag": Database["public"]['Enums']["result_flag"] | null,"id": string,"lab_report_id": string,"marker_id": string,"patient_id": string,"ref_high": number | null,"ref_low": number | null,"unit": string | null,"value_numeric": number | null,"value_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doctor_comment"?: string | null,"flag"?: Database["public"]['Enums']["result_flag"] | null,"id"?: string,"lab_report_id": string,"marker_id": string,"patient_id": string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"doctor_comment"?: string | null,"flag"?: Database["public"]['Enums']["result_flag"] | null,"id"?: string,"lab_report_id"?: string,"marker_id"?: string,"patient_id"?: string,"ref_high"?: number | null,"ref_low"?: number | null,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
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
            "auth_throttle_hit":
{ Args: { "_keys": (string)[],"_limits": (number)[],"_window_seconds": number }; Returns: boolean
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
                           }
          }
          Enums: {
            "account_status": "invited"|"active"|"suspended","app_role": "patient"|"doctor"|"pa"|"health_coach"|"admin","appt_source": "ghl"|"semble","appt_status": "booked"|"confirmed"|"cancelled"|"completed"|"no_show","care_relationship": "primary_doctor"|"doctor"|"pa"|"health_coach","consent_type": "care"|"partner_labs"|"research","diagnosis_status": "active"|"monitoring"|"treating"|"under_investigation"|"resolved","doc_kind": "letter"|"lab_report"|"patient_upload"|"referral"|"other","document_source": "patient_upload"|"email"|"tdl"|"semble","guardian_relationship": "parent"|"carer"|"power_of_attorney","import_confidence": "high"|"medium"|"low","import_decision": "pending"|"confirmed"|"rejected","import_status": "needs_match"|"matched"|"confirmed"|"rejected","location_kind": "clinic"|"video","med_kind": "prescription"|"supplement","med_status": "active"|"paused"|"stopped","notification_channel": "email"|"whatsapp"|"sms"|"portal","notification_topic": "results"|"payments"|"appointments"|"messages","order_status": "sent_to_patient"|"paid"|"sample_taken"|"results_in"|"reviewed"|"cancelled","question_status": "awaiting_reply"|"answered"|"closed","question_urgency": "routine"|"important","report_status": "awaiting_review"|"reviewed"|"released","request_status": "requested"|"approved"|"sent_to_pharmacy"|"declined","result_flag": "normal"|"borderline"|"low"|"high"|"critical","results_channel": "api"|"email"|"upload","safeguarding_severity": "low"|"moderate"|"high","staff_role": "doctor"|"pa"|"health_coach"|"admin","sync_direction": "in"|"out","sync_status": "ok"|"failed"|"retrying","sync_system": "ghl"|"semble"|"stripe"|"tdl"|"fathom","webhook_source": "stripe"|"tdl"|"ghl"|"semble"|"fathom","webhook_status": "received"|"processed"|"failed"|"ignored"
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
            "account_status": ["invited", "active", "suspended"],"app_role": ["patient", "doctor", "pa", "health_coach", "admin"],"appt_source": ["ghl", "semble"],"appt_status": ["booked", "confirmed", "cancelled", "completed", "no_show"],"care_relationship": ["primary_doctor", "doctor", "pa", "health_coach"],"consent_type": ["care", "partner_labs", "research"],"diagnosis_status": ["active", "monitoring", "treating", "under_investigation", "resolved"],"doc_kind": ["letter", "lab_report", "patient_upload", "referral", "other"],"document_source": ["patient_upload", "email", "tdl", "semble"],"guardian_relationship": ["parent", "carer", "power_of_attorney"],"import_confidence": ["high", "medium", "low"],"import_decision": ["pending", "confirmed", "rejected"],"import_status": ["needs_match", "matched", "confirmed", "rejected"],"location_kind": ["clinic", "video"],"med_kind": ["prescription", "supplement"],"med_status": ["active", "paused", "stopped"],"notification_channel": ["email", "whatsapp", "sms", "portal"],"notification_topic": ["results", "payments", "appointments", "messages"],"order_status": ["sent_to_patient", "paid", "sample_taken", "results_in", "reviewed", "cancelled"],"question_status": ["awaiting_reply", "answered", "closed"],"question_urgency": ["routine", "important"],"report_status": ["awaiting_review", "reviewed", "released"],"request_status": ["requested", "approved", "sent_to_pharmacy", "declined"],"result_flag": ["normal", "borderline", "low", "high", "critical"],"results_channel": ["api", "email", "upload"],"safeguarding_severity": ["low", "moderate", "high"],"staff_role": ["doctor", "pa", "health_coach", "admin"],"sync_direction": ["in", "out"],"sync_status": ["ok", "failed", "retrying"],"sync_system": ["ghl", "semble", "stripe", "tdl", "fathom"],"webhook_source": ["stripe", "tdl", "ghl", "semble", "fathom"],"webhook_status": ["received", "processed", "failed", "ignored"]
          }
        }
} as const
