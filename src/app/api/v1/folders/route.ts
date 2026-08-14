import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/db/supabase-server';
import { createFolderSchema } from '@/lib/validation/schemas';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const url = new URL(req.url);
  const parentId = url.searchParams.get('parentId');

  const supabase = createAdminClient();
  let query = supabase
    .from('folders')
    .select('*')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data: folders, error } = await query;
  if (error) {
    logger.error('Error fetching folders', { error: error.message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', 'Gagal memuat folder', requestId);
  }

  return NextResponse.json({ folders: folders || [], requestId });
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung. Hubungkan akun Drive terlebih dahulu.', requestId);
  }

  try {
    const json = await req.json();
    const parsed = createFolderSchema.safeParse(json);
    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, requestId);
    }

    const { name, parentId } = parsed.data;
    const supabase = createAdminClient();

    // Determine parent provider folder ID
    let parentProviderId = driveCtx.connection.root_folder_id;
    if (parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .select('provider_folder_id')
        .eq('id', parentId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .single();

      if (parentError || !parentFolder) {
        return createErrorResponse('NOT_FOUND', 'Folder induk tidak ditemukan.', requestId);
      }
      parentProviderId = parentFolder.provider_folder_id;
    }

    // Create folder in Google Drive
    const providerFolderId = await googleDriveAdapter.createFolder(
      driveCtx.accessToken,
      name,
      parentProviderId
    );

    // Save folder locally in Supabase
    const { data: newFolder, error: insertError } = await supabase
      .from('folders')
      .insert({
        owner_id: user.id,
        drive_connection_id: driveCtx.connection.id,
        parent_id: parentId || null,
        provider_folder_id: providerFolderId,
        name,
      })
      .select('*')
      .single();

    if (insertError) {
      logger.error('Error inserting folder to DB', { error: insertError.message, requestId, userId: user.id });
      return createErrorResponse('CONFLICT', 'Folder dengan nama ini sudah ada.', requestId);
    }

    logger.info('Folder created successfully', { folderId: newFolder.id, name, userId: user.id, requestId });
    return NextResponse.json({ folder: newFolder, requestId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membuat folder';
    logger.error('Folder creation exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
