import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-server';
import { hashShareToken } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const requestId = getRequestId(req);
  const { token } = params;

  if (!token || token.trim().length === 0) {
    return createErrorResponse('NOT_FOUND', 'Tautan tidak valid.', requestId);
  }

  const tokenHash = hashShareToken(token);
  const admin = createAdminClient();

  try {
    const { data: share, error: shareErr } = await admin
      .from('file_shares')
      .select('*, files(*)')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .single();

    if (shareErr || !share || !share.files) {
      return createErrorResponse('NOT_FOUND', 'Tautan tidak valid atau telah dicabut.', requestId);
    }

    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return createErrorResponse('NOT_FOUND', 'Tautan telah kedaluwarsa.', requestId);
    }

    const file = share.files;
    if (file.deleted_at || file.upload_status !== 'completed') {
      return createErrorResponse('NOT_FOUND', 'File tidak ditemukan.', requestId);
    }

    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.provider_file_id}`;

    return NextResponse.json({
      downloadUrl: directDownloadUrl,
      fileName: file.original_name,
      mimeType: file.mime_type,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan URL unduh';
    logger.error('Public download exception', { message, requestId });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
