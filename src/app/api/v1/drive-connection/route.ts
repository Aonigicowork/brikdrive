import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from('drive_connections')
    .select('id, google_email, root_folder_id, connected_at')
    .eq('owner_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    logger.error('Error fetching drive connection', { error: error.message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', 'Gagal memuat status koneksi Drive', requestId);
  }

  return NextResponse.json({
    isConnected: !!connection,
    connection: connection || null,
    requestId,
  });
}

export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('drive_connections')
    .update({ revoked_at: new Date().toISOString() })
    .eq('owner_id', user.id)
    .is('revoked_at', null);

  if (error) {
    logger.error('Error revoking drive connection', { error: error.message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', 'Gagal memutus koneksi Google Drive', requestId);
  }

  logger.info('User disconnected Google Drive', { userId: user.id, requestId });
  return NextResponse.json({
    success: true,
    message: 'Koneksi Google Drive berhasil diputus.',
    requestId,
  });
}
