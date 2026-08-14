import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { shareId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  const { shareId } = params;
  const supabase = createServerSupabaseClient();

  try {
    const { data: share, error: shareErr } = await supabase
      .from('file_shares')
      .select('*, files(*)')
      .eq('id', shareId)
      .eq('owner_id', user.id)
      .is('revoked_at', null)
      .single();

    if (shareErr || !share) {
      return createErrorResponse('NOT_FOUND', 'Tautan berbagi tidak ditemukan atau sudah dicabut.', requestId);
    }

    const now = new Date().toISOString();

    // 1. Mark revoked in database immediately so public link becomes unavailable
    await supabase
      .from('file_shares')
      .update({ revoked_at: now })
      .eq('id', shareId);

    // 2. Delete provider permission in Google Drive
    if (driveCtx && share.files?.provider_file_id && share.drive_permission_id) {
      try {
        await googleDriveAdapter.deletePermission(
          driveCtx.accessToken,
          share.files.provider_file_id,
          share.drive_permission_id
        );
      } catch (permErr) {
        logger.warn('Google Drive permission deletion failed during immediate revoke, queued for cron', {
          error: permErr instanceof Error ? permErr.message : String(permErr),
          shareId,
          requestId,
        });
      }
    }

    logger.info('Share revoked successfully', { shareId, fileId: share.file_id, userId: user.id, requestId });

    return NextResponse.json({
      success: true,
      message: 'Tautan berbagi berhasil dicabut.',
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mencabut tautan berbagi';
    logger.error('Revoke share exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
