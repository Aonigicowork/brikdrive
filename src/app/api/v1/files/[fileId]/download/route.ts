import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  const { fileId } = params;
  const admin = createAdminClient();

  const { data: file, error } = await admin
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('owner_id', user.id)
    .eq('upload_status', 'completed')
    .is('deleted_at', null)
    .single();

  if (error || !file || !file.provider_file_id) {
    return createErrorResponse('NOT_FOUND', 'File tidak ditemukan atau belum selesai diunggah.', requestId);
  }

  try {
    const driveMediaUrl = `https://www.googleapis.com/drive/v3/files/${file.provider_file_id}?alt=media`;
    const driveHeaders: Record<string, string> = {
      Authorization: `Bearer ${driveCtx.accessToken}`,
    };

    const range = req.headers.get('range');
    if (range) {
      driveHeaders['Range'] = range;
    }

    const driveRes = await fetch(driveMediaUrl, {
      headers: driveHeaders,
    });

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      logger.error('Failed to stream download from Google Drive', { status: driveRes.status, errText, requestId });
      return createErrorResponse('INTERNAL_ERROR', 'Gagal mengunduh file dari Google Drive.', requestId);
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', file.mime_type || 'application/octet-stream');
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.original_name)}"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
    );
    responseHeaders.set('Cache-Control', 'private, no-cache');
    if (driveRes.headers.get('Content-Length')) {
      responseHeaders.set('Content-Length', driveRes.headers.get('Content-Length')!);
    }
    if (driveRes.headers.get('Content-Range')) {
      responseHeaders.set('Content-Range', driveRes.headers.get('Content-Range')!);
    }

    logger.info('Authorized direct file download stream started', { fileId, userId: user.id, requestId });

    return new NextResponse(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses unduhan';
    logger.error('Download stream exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
  // Backwards compatibility for POST
  return GET(req, { params });
}
