-- ==============================================================================
-- BrikDrive Supabase Schema Migration (v1.1)
-- ==============================================================================

-- 1. Custom Types
DO $$ BEGIN
    CREATE TYPE upload_status AS ENUM (
        'initiated',
        'uploading',
        'completed',
        'failed',
        'aborted',
        'deleted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    app_quota_bytes BIGINT NOT NULL DEFAULT 107374182400, -- Default 100 GiB
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Google Drive Connections Table
CREATE TABLE IF NOT EXISTS public.drive_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_email TEXT NOT NULL,
    root_folder_id TEXT NOT NULL,
    refresh_token_ciphertext TEXT NOT NULL,
    token_key_version INT NOT NULL DEFAULT 1,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/drive.file'],
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT unique_active_connection_per_owner UNIQUE (owner_id, revoked_at)
);

-- 4. Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drive_connection_id UUID NOT NULL REFERENCES public.drive_connections(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    provider_folder_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_folders_owner_parent ON public.folders(owner_id, parent_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_folder_name ON public.folders(owner_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::UUID), lower(name)) WHERE deleted_at IS NULL;

-- 5. Files Table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drive_connection_id UUID NOT NULL REFERENCES public.drive_connections(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    original_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0 AND byte_size <= 5368709120), -- Max 5 GiB
    provider_file_id TEXT,
    preview_provider_file_id TEXT,
    upload_status upload_status NOT NULL DEFAULT 'initiated',
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    purge_after TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_owner_folder ON public.files(owner_id, folder_id, created_at DESC) WHERE deleted_at IS NULL AND upload_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_files_search ON public.files(owner_id, lower(normalized_name)) WHERE deleted_at IS NULL AND upload_status = 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_provider_file_id ON public.files(provider_file_id) WHERE provider_file_id IS NOT NULL;

-- 6. Upload Sessions Table
CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resumable_uri_ciphertext TEXT NOT NULL,
    chunk_size INTEGER NOT NULL DEFAULT 16777216, -- 16 MiB
    confirmed_byte BIGINT NOT NULL DEFAULT 0,
    status upload_status NOT NULL DEFAULT 'initiated',
    expires_at TIMESTAMPTZ NOT NULL,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_owner ON public.upload_sessions(owner_id, status);

-- 7. File Shares Table
CREATE TABLE IF NOT EXISTS public.file_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    drive_permission_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_shares_token ON public.file_shares(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_shares_expiry ON public.file_shares(expires_at) WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

-- 8. Deletion Jobs Table
CREATE TABLE IF NOT EXISTS public.deletion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    provider_file_id TEXT NOT NULL,
    preview_provider_file_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_jobs_status ON public.deletion_jobs(status, next_attempt_at) WHERE status IN ('pending', 'failed');

-- 9. Audit Events Table
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    share_id UUID REFERENCES public.file_shares(id) ON DELETE SET NULL,
    request_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_events(actor_id, occurred_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- Drive Connections: Strict isolation. Client can only view basic connection info (never the ciphertext)
CREATE POLICY "Users can view own drive connection status" ON public.drive_connections
    FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id);

-- Folders: Owner has full CRUD on non-deleted folders
CREATE POLICY "Users can view own folders" ON public.folders
    FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own folders" ON public.folders
    FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can update own folders" ON public.folders
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = owner_id)
    WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can delete own folders" ON public.folders
    FOR DELETE TO authenticated USING ((select auth.uid()) = owner_id);

-- Files: Owner has full CRUD
CREATE POLICY "Users can view own files" ON public.files
    FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own files" ON public.files
    FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can update own files" ON public.files
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = owner_id)
    WITH CHECK ((select auth.uid()) = owner_id);

-- Upload Sessions: Owner only
CREATE POLICY "Users can view own upload sessions" ON public.upload_sessions
    FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id);

CREATE POLICY "Users can insert own upload sessions" ON public.upload_sessions
    FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can update own upload sessions" ON public.upload_sessions
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = owner_id)
    WITH CHECK ((select auth.uid()) = owner_id);

-- File Shares: Owner only for management
CREATE POLICY "Users can view and manage own file shares" ON public.file_shares
    FOR ALL TO authenticated USING ((select auth.uid()) = owner_id);

-- Deletion Jobs & Audit Events: Server-side only (No direct user client policies)

-- ==============================================================================
-- DATABASE TRIGGERS & FUNCTIONS
-- ==============================================================================

-- Trigger: Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Compute total active BrikDrive usage bytes for an owner
CREATE OR REPLACE FUNCTION public.get_brikdrive_storage_usage(user_id UUID)
RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(byte_size), 0)::BIGINT
    FROM public.files
    WHERE owner_id = user_id
      AND upload_status = 'completed'
      AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
