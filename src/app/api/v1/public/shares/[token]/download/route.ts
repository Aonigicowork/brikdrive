import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-server';
import { hashShareToken } from '@/lib/crypto/encryption';
import { getActiveDriveConnection } from '@/lib/auth/session';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
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
    if (file.deleted_at || file.upload_status !== 'completed' || !file.provider_file_id) {
      return createErrorResponse('NOT_FOUND', 'File tidak ditemukan.', requestId);
    }

    const driveCtx = await getActiveDriveConnection(share.owner_id);
    if (!driveCtx) {
      return createErrorResponse('INTERNAL_ERROR', 'Koneksi Google Drive pemilik tidak tersedia.', requestId);
    }

    const driveMediaUrl = `https://www.googleapis.com/drive/v3/files/${file.provider_file_id}?alt=media`;
    const driveRes = await fetch(driveMediaUrl, {
      headers: {
        Authorization: `Bearer ${driveCtx.accessToken}`,
      },
    });

    if (!driveRes.ok) {
      return createErrorResponse('INTERNAL_ERROR', 'Gagal mengunduh file dari Google Drive.', requestId);
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', file.mime_type || 'application/octet-stream');
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.original_name)}"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
    );
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan unduhan publik';
    logger.error('Public download stream exception', { message, requestId });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  return GET(req, { params });
}
