export type ReportStatus = 'incomplete' | 'completed';
export type SendStatus = 'none' | 'pending_send_confirmation' | 'sent_confirmed';
export type ThemeMode = 'system' | 'light' | 'dark';
export type ManufacturerGroup =
  | 'ford'
  | 'stellantis'
  | 'mazda'
  | 'hyundai'
  | 'honda'
  | 'kia'
  | 'nissan'
  | 'toyota'
  | 'unknown';

export interface ReportRow {
  id: string;
  status: ReportStatus;
  send_status: SendStatus;
  created_at: number;
  updated_at: number;
  vin_text: string;
  unit_location: string;
  manufacturer_group: ManufacturerGroup;
  recipients: string;
  notes: string;
}

export interface ReportCodeRow {
  id: string;
  report_id: string;
  code: string;
  created_at: number;
}

export interface ReportPhotoRow {
  id: string;
  report_id: string;
  uri: string;
  created_at: number;
  is_vin: number;
}

export interface ReportListItem extends ReportRow {
  photo_count: number;
  code_count: number;
  has_vin_photo: number;
}

export interface ReportDetail extends ReportRow {
  codes: ReportCodeRow[];
  photos: ReportPhotoRow[];
}

export interface SettingsRow {
  id: 'singleton';
  default_recipients: string;
  default_export_email: string;
  theme_mode: ThemeMode;
  theme_primary: string;
  theme_accent: string;
}

export interface CodeOption {
  code: string;
  label: string;
}

export interface ExportReportData {
  report: ReportRow;
  codes: ReportCodeRow[];
  photos: ReportPhotoRow[];
}

export type ReportEventType = 'draft_opened' | 'sent_confirmed';

export interface ReportEventRow {
  id: string;
  report_id: string;
  event_type: ReportEventType;
  event_at: number;
  vin_text: string;
  manufacturer_group: ManufacturerGroup;
  unit_location: string;
  codes_pipe: string;
}

export interface PendingSendConfirmationItem {
  id: string;
  created_at: number;
  updated_at: number;
  vin_text: string;
  unit_location: string;
  manufacturer_group: ManufacturerGroup;
  codes_pipe: string;
}
