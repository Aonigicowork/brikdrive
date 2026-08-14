import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createServerSupabaseClient, createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const { fileId } = params;
  const supabase = createServerSupabaseClient();

  const { data: file, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !file) {
    return createErrorResponse('NOT_FOUND', 'File tidak ditemukan.', requestId);
  }

  return NextResponse.json({ file, requestId });
}

export async function DELETE(req: NextRequest, { params }: { params: { fileId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const { fileId } = params;
  const supabase = createServerSupabaseClient();
  const admin = createAdminClient();

  try {
    const { data: file, error: findError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();

    if (findError || !file) {
      return createErrorResponse('NOT_FOUND', 'File tidak ditemukan.', requestId);
    }

    const now = new Date().toISOString();
    const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days retention

    // 1. Soft-delete file in DB
    await supabase
      .from('files')
      .update({
        deleted_at: now,
        upload_status: 'deleted',
        purge_after: purgeAfter,
      })
      .eq('id', fileId);

    // 2. Revoke any active shares immediately
    await supabase
      .from('file_shares')
      .update({ revoked_at: now })
      .eq('file_id', fileId)
      .is('revoked_at', null);

    // 3. Enqueue deletion job if provider file exists
    if (file.provider_file_id) {
      await admin.from('deletion_jobs').insert({
        file_id: fileId,
        provider_file_id: file.provider_file_id,
        preview_provider_file_id: file.preview_provider_file_id || null,
        status: 'pending',
        attempts: 0,
      });
    }

    logger.info('File soft-deleted and queued for provider cleanup', { fileId, userId: user.id, requestId });
    return NextResponse.json({
      success: true,
      message: 'File berhasil dipindahkan ke sampah.',
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus file';
    logger.error('File deletion exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
