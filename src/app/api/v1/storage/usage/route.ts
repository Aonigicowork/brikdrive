import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createServerSupabaseClient, createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';
import { StorageUsageResponse } from '@/types/database';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const supabase = createServerSupabaseClient();
  const admin = createAdminClient();

  try {
    // 1. Get profile quota
    const { data: profile } = await supabase
      .from('profiles')
      .select('app_quota_bytes')
      .eq('id', user.id)
      .maybeSingle();

    const quotaBytes = profile?.app_quota_bytes || 107374182400; // 100 GiB default

    // 2. Get active files aggregate
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('byte_size')
      .eq('owner_id', user.id)
      .eq('upload_status', 'completed')
      .is('deleted_at', null);

    if (filesError) throw filesError;

    const usedBytes = (files || []).reduce((acc, f) => acc + Number(f.byte_size || 0), 0);
    const activeFileCount = files?.length || 0;

    // 3. Get active folder count
    const { count: activeFolderCount } = await supabase
      .from('folders')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .is('deleted_at', null);

    // 4. Get connection info
    const { data: connection } = await admin
      .from('drive_connections')
      .select('google_email')
      .eq('owner_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();

    const responseData: StorageUsageResponse = {
      used_bytes: usedBytes,
      quota_bytes: quotaBytes,
      active_file_count: activeFileCount,
      active_folder_count: activeFolderCount || 0,
      provider_email: connection?.google_email,
      is_connected: !!connection,
    };

    return NextResponse.json({ ...responseData, requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat informasi kapasitas penyimpanan';
    logger.error('Storage usage fetch error', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
