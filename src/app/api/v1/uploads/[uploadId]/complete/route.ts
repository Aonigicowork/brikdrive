import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient, createAdminClient } from '@/lib/db/supabase-server';
import { completeUploadSchema } from '@/lib/validation/schemas';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  const { uploadId } = params;
  const supabase = createServerSupabaseClient();
  const admin = createAdminClient();

  try {
    const json = await req.json();
    const parsed = completeUploadSchema.safeParse(json);
    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, requestId);
    }

    const { providerFileId } = parsed.data;

    // 1. Get session & file
    const { data: session, error: sessionErr } = await supabase
      .from('upload_sessions')
      .select('*, files(*)')
      .eq('id', uploadId)
      .eq('owner_id', user.id)
      .single();

    if (sessionErr || !session || !session.files) {
      return createErrorResponse('NOT_FOUND', 'Sesi upload tidak ditemukan.', requestId);
    }

    const file = session.files;

    // 2. Server-side verification on Google Drive
    const providerFile = await googleDriveAdapter.getFileInfo(driveCtx.accessToken, providerFileId);

    if (providerFile.trashed) {
      return createErrorResponse('CONFLICT', 'File berada di sampah Google Drive.', requestId);
    }

    // Verify appProperties tag match
    if (providerFile.appProperties?.brikdriveFileId && providerFile.appProperties.brikdriveFileId !== file.id) {
      logger.warn('brikdriveFileId mismatch during complete verification', {
        expected: file.id,
        received: providerFile.appProperties.brikdriveFileId,
        requestId,
      });
      return createErrorResponse('FORBIDDEN', 'Metadata provider file tidak sesuai dengan sesi lokal.', requestId);
    }

    const now = new Date().toISOString();

    // 3. Update file status to completed
    const { data: updatedFile, error: fileUpdateErr } = await supabase
      .from('files')
      .update({
        provider_file_id: providerFileId,
        upload_status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', file.id)
      .select('*')
      .single();

    if (fileUpdateErr) throw fileUpdateErr;

    // 4. Update session status
    await supabase
      .from('upload_sessions')
      .update({
        status: 'completed',
        confirmed_byte: file.byte_size,
        updated_at: now,
      })
      .eq('id', uploadId);

    // 5. Audit event
    await admin.from('audit_events').insert({
      actor_id: user.id,
      event_type: 'FILE_UPLOAD_COMPLETED',
      file_id: file.id,
      request_id: requestId,
      metadata: {
        byte_size: file.byte_size,
        mime_type: file.mime_type,
        provider_file_id: providerFileId,
      },
    });

    logger.info('File upload successfully completed and verified', { fileId: file.id, uploadId, requestId });

    return NextResponse.json({
      file: updatedFile,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memverifikasi penyelesaian upload';
    logger.error('Upload completion exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
