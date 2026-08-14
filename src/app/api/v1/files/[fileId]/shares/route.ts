import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';
import { createShareSchema } from '@/lib/validation/schemas';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { generateRandomToken, hashShareToken } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const { fileId } = params;
  const supabase = createServerSupabaseClient();

  const { data: shares, error } = await supabase
    .from('file_shares')
    .select('id, expires_at, created_at, revoked_at')
    .eq('file_id', fileId)
    .eq('owner_id', user.id)
    .is('revoked_at', null);

  if (error) {
    logger.error('Failed to fetch file shares', { error: error.message, requestId });
    return createErrorResponse('INTERNAL_ERROR', 'Gagal memuat daftar share link', requestId);
  }

  return NextResponse.json({ shares: shares || [], requestId });
}

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
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
  const supabase = createServerSupabaseClient();

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = createShareSchema.safeParse(json);
    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, requestId);
    }

    const { expiresInHours } = parsed.data;

    // Verify file is completed and owned by user
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('owner_id', user.id)
      .eq('upload_status', 'completed')
      .is('deleted_at', null)
      .single();

    if (fileErr || !file || !file.provider_file_id) {
      return createErrorResponse('NOT_FOUND', 'File tidak ditemukan atau belum selesai diunggah.', requestId);
    }

    // Generate high entropy random token
    const rawToken = generateRandomToken(32);
    const tokenHash = hashShareToken(rawToken);

    // Create 'anyone: reader' permission on Google Drive
    const drivePermissionId = await googleDriveAdapter.createPublicPermission(
      driveCtx.accessToken,
      file.provider_file_id
    );

    // Calculate expiration if provided
    let expiresAt: string | null = null;
    if (expiresInHours) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    }

    // Insert into file_shares
    const { data: share, error: shareErr } = await supabase
      .from('file_shares')
      .insert({
        file_id: fileId,
        owner_id: user.id,
        token_hash: tokenHash,
        drive_permission_id: drivePermissionId,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (shareErr || !share) {
      // Rollback permission if DB insert fails
      await googleDriveAdapter.deletePermission(driveCtx.accessToken, file.provider_file_id, drivePermissionId).catch(() => {});
      logger.error('Failed to save share record', { error: shareErr?.message, requestId });
      return createErrorResponse('INTERNAL_ERROR', 'Gagal membuat tautan berbagi.', requestId);
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const shareUrl = `${appUrl}/share/${rawToken}`;

    logger.info('Share link created', { fileId, shareId: share.id, expiresAt, requestId });

    return NextResponse.json(
      {
        shareId: share.id,
        shareUrl,
        rawToken,
        expiresAt,
        createdAt: share.created_at,
        requestId,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membuat tautan berbagi';
    logger.error('Create share exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
