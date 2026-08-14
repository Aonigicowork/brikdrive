import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const { uploadId } = params;
  const supabase = createAdminClient();

  const { data: session, error: sessionErr } = await supabase
    .from('upload_sessions')
    .select('*, files(*)')
    .eq('id', uploadId)
    .eq('owner_id', user.id)
    .single();

  if (sessionErr || !session) {
    return createErrorResponse('NOT_FOUND', 'Sesi upload tidak ditemukan.', requestId);
  }

  const now = new Date().toISOString();

  // Mark session aborted
  await supabase
    .from('upload_sessions')
    .update({ status: 'aborted', updated_at: now })
    .eq('id', uploadId);

  // Mark file aborted/deleted
  if (session.file_id) {
    await supabase
      .from('files')
      .update({ upload_status: 'aborted', deleted_at: now, updated_at: now })
      .eq('id', session.file_id);
  }

  logger.info('Upload session cancelled by user', { uploadId, fileId: session.file_id, requestId });

  return NextResponse.json({
    success: true,
    message: 'Upload berhasil dibatalkan.',
    requestId,
  });
}
