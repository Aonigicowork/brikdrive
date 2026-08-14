import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient, createAdminClient } from '@/lib/db/supabase-server';
import { initiateUploadSchema, sanitizeFilename } from '@/lib/validation/schemas';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { encryptString } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

const CHUNK_SIZE = 16 * 1024 * 1024; // 16 MiB (exact multiple of 256 KiB)

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  try {
    const json = await req.json();
    const parsed = initiateUploadSchema.safeParse(json);
    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, requestId);
    }

    const { originalName, mimeType, byteSize, folderId } = parsed.data;
    const normalizedName = sanitizeFilename(originalName);
    const admin = createAdminClient();

    // 1. Validate quota
    const { data: profile } = await admin.from('profiles').select('app_quota_bytes').eq('id', user.id).maybeSingle();
    const quotaBytes = profile?.app_quota_bytes || 107374182400; // 100 GiB

    const { data: activeFiles } = await admin
      .from('files')
      .select('byte_size')
      .eq('owner_id', user.id)
      .eq('upload_status', 'completed')
      .is('deleted_at', null);

    const currentUsed = (activeFiles || []).reduce((sum: number, f: { byte_size: number | null }) => sum + Number(f.byte_size || 0), 0);
    if (currentUsed + byteSize > quotaBytes) {
      return createErrorResponse('QUOTA_EXCEEDED', 'Kapasitas penyimpanan BrikDrive tidak mencukupi.', requestId);
    }

    // 2. Resolve Google Drive parent folder ID
    let parentProviderId = driveCtx.connection.root_folder_id;
    if (folderId) {
      const { data: targetFolder, error: folderErr } = await admin
        .from('folders')
        .select('provider_folder_id')
        .eq('id', folderId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .single();

      if (folderErr || !targetFolder) {
        return createErrorResponse('NOT_FOUND', 'Folder tujuan tidak ditemukan.', requestId);
      }
      parentProviderId = targetFolder.provider_folder_id;
    }

    // 3. Create file row with status 'initiated'
    const { data: newFile, error: fileInsertError } = await admin
      .from('files')
      .insert({
        owner_id: user.id,
        drive_connection_id: driveCtx.connection.id,
        folder_id: folderId || null,
        original_name: originalName,
        normalized_name: normalizedName,
        mime_type: mimeType,
        byte_size: byteSize,
        upload_status: 'initiated',
      })
      .select('*')
      .single();

    if (fileInsertError || !newFile) {
      const errMsg = fileInsertError?.message || 'Gagal membuat rekaman file di database.';
      logger.error('Failed to create file record', { error: errMsg, requestId, userId: user.id });
      return createErrorResponse('INTERNAL_ERROR', errMsg, requestId);
    }

    // 4. Initiate Resumable Session with Google Drive API
    const sessionUri = await googleDriveAdapter.initiateResumableUpload(driveCtx.accessToken, {
      name: normalizedName,
      mimeType,
      parentFolderId: parentProviderId,
      brikdriveFileId: newFile.id,
      byteSize,
    });

    // 5. Store session encrypted (expires in 7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const encryptedSessionUri = encryptString(sessionUri);

    const { data: session, error: sessionInsertError } = await admin
      .from('upload_sessions')
      .insert({
        file_id: newFile.id,
        owner_id: user.id,
        resumable_uri_ciphertext: encryptedSessionUri,
        chunk_size: CHUNK_SIZE,
        status: 'initiated',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (sessionInsertError || !session) {
      const errMsg = sessionInsertError?.message || 'Gagal menyimpan sesi upload.';
      logger.error('Failed to store upload session', { error: errMsg, requestId });
      return createErrorResponse('INTERNAL_ERROR', errMsg, requestId);
    }

    logger.info('Resumable upload session initiated', { fileId: newFile.id, uploadId: session.id, byteSize, requestId });

    return NextResponse.json(
      {
        uploadId: session.id,
        fileId: newFile.id,
        chunkSize: CHUNK_SIZE,
        sessionUri, // Browser uses this directly to PUT chunk bytes
        expiresAt,
        requestId,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memulai upload resumable';
    logger.error('Initiate upload exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
