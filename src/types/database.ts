export type UploadStatus = 'initiated' | 'uploading' | 'completed' | 'failed' | 'aborted' | 'deleted';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  app_quota_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface DriveConnection {
  id: string;
  owner_id: string;
  google_email: string;
  root_folder_id: string;
  refresh_token_ciphertext: string;
  token_key_version: number;
  scopes: string[];
  connected_at: string;
  revoked_at: string | null;
}

export interface Folder {
  id: string;
  owner_id: string;
  drive_connection_id: string;
  parent_id: string | null;
  provider_folder_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BrikFile {
  id: string;
  owner_id: string;
  drive_connection_id: string;
  folder_id: string | null;
  original_name: string;
  normalized_name: string;
  mime_type: string;
  byte_size: number;
  provider_file_id: string | null;
  preview_provider_file_id: string | null;
  upload_status: UploadStatus;
  completed_at: string | null;
  deleted_at: string | null;
  purge_after: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSession {
  id: string;
  file_id: string;
  owner_id: string;
  resumable_uri_ciphertext: string;
  chunk_size: number;
  confirmed_byte: number;
  status: UploadStatus;
  expires_at: string;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileShare {
  id: string;
  file_id: string;
  owner_id: string;
  token_hash: string;
  drive_permission_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface DeletionJob {
  id: string;
  file_id: string;
  provider_file_id: string;
  preview_provider_file_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  next_attempt_at: string;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  event_type: string;
  file_id: string | null;
  share_id: string | null;
  request_id: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface StorageUsageResponse {
  used_bytes: number;
  quota_bytes: number;
  active_file_count: number;
  active_folder_count: number;
  provider_email?: string;
  is_connected: boolean;
}
