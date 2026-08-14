import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/db/supabase-server';
import { decryptString } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const { uploadId } = params;
  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from('upload_sessions')
    .select('*, files(*)')
    .eq('id', uploadId)
    .eq('owner_id', user.id)
    .single();

  if (error || !session) {
    return createErrorResponse('NOT_FOUND', 'Sesi upload tidak ditemukan.', requestId);
  }

  // Check if session has expired
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return createErrorResponse('UPLOAD_EXPIRED', 'Sesi upload Google Drive telah kedaluwarsa. Silakan mulai ulang upload.', requestId);
  }

  if (session.status === 'completed') {
    return NextResponse.json({
      status: 'completed',
      fileId: session.file_id,
      requestId,
    });
  }

  try {
    const sessionUri = decryptString(session.resumable_uri_ciphertext);

    return NextResponse.json({
      uploadId: session.id,
      fileId: session.file_id,
      status: session.status,
      chunkSize: session.chunk_size,
      confirmedByte: session.confirmed_byte,
      sessionUri,
      file: session.files,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mendekripsi sesi upload';
    logger.error('Session decryption error', { message, uploadId, requestId });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
