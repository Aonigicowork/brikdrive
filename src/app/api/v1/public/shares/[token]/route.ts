import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-server';
import { hashShareToken } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const requestId = getRequestId(req);
  const { token } = params;

  if (!token || token.trim().length === 0) {
    return createErrorResponse('NOT_FOUND', 'Tautan tidak valid atau telah kedaluwarsa.', requestId);
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

    // Check expiration
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return createErrorResponse('NOT_FOUND', 'Tautan ini telah kedaluwarsa.', requestId);
    }

    const file = share.files;

    // Check if file is soft-deleted
    if (file.deleted_at || file.upload_status !== 'completed') {
      return createErrorResponse('NOT_FOUND', 'File sudah tidak tersedia.', requestId);
    }

    // Public preview/content URL via Google Drive
    const directContentUrl = `https://drive.google.com/uc?export=view&id=${file.provider_file_id}`;
    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.provider_file_id}`;
    const embedPreviewUrl = `https://drive.google.com/file/d/${file.provider_file_id}/preview`;

    return NextResponse.json(
      {
        fileName: file.original_name,
        mimeType: file.mime_type,
        byteSize: file.byte_size,
        createdAt: file.created_at,
        expiresAt: share.expires_at,
        contentUrl: directContentUrl,
        downloadUrl: directDownloadUrl,
        previewUrl: embedPreviewUrl,
        requestId,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat file publik';
    logger.error('Public share lookup exception', { message, requestId });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
