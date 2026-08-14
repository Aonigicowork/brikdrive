import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  const { fileId } = params;
  const supabase = createServerSupabaseClient();

  const { data: file, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('owner_id', user.id)
    .eq('upload_status', 'completed')
    .is('deleted_at', null)
    .single();

  if (error || !file || !file.provider_file_id) {
    return createErrorResponse('NOT_FOUND', 'File tidak ditemukan.', requestId);
  }

  try {
    const previewUrl = `https://www.googleapis.com/drive/v3/files/${file.provider_file_id}?alt=media`;
    const googleDirectUrl = `https://drive.google.com/file/d/${file.provider_file_id}/preview`;

    return NextResponse.json({
      previewUrl,
      googleDirectUrl,
      fileName: file.original_name,
      mimeType: file.mime_type,
      accessToken: driveCtx.accessToken,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan URL pratinjau';
    logger.error('Preview error', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
