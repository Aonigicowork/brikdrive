import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getActiveDriveConnection } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';
import { updateFolderSchema } from '@/lib/validation/schemas';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function PATCH(req: NextRequest, { params }: { params: { folderId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  try {
    const json = await req.json();
    const parsed = updateFolderSchema.safeParse(json);
    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, requestId);
    }

    const { folderId } = params;
    const { name, parentId } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Verify folder ownership
    const { data: folder, error: findError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();

    if (findError || !folder) {
      return createErrorResponse('NOT_FOUND', 'Folder tidak ditemukan.', requestId);
    }

    // Prepare Google Drive update
    const updateParams: { name?: string; addParents?: string; removeParents?: string } = {};
    if (name) updateParams.name = name;

    let targetParentProviderId = undefined;
    if (parentId !== undefined) {
      if (parentId === null) {
        targetParentProviderId = driveCtx.connection.root_folder_id;
      } else {
        const { data: parentF } = await supabase
          .from('folders')
          .select('provider_folder_id')
          .eq('id', parentId)
          .eq('owner_id', user.id)
          .single();
        if (!parentF) return createErrorResponse('NOT_FOUND', 'Folder tujuan tidak ditemukan.', requestId);
        targetParentProviderId = parentF.provider_folder_id;
      }
    }

    if (name || targetParentProviderId) {
      await googleDriveAdapter.updateFolder(driveCtx.accessToken, folder.provider_folder_id, updateParams);
    }

    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({
        name: name || folder.name,
        parent_id: parentId !== undefined ? parentId : folder.parent_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', folderId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ folder: updatedFolder, requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui folder';
    logger.error('Folder patch exception', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { folderId: string } }) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser();

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const driveCtx = await getActiveDriveConnection(user.id);
  if (!driveCtx) {
    return createErrorResponse('DRIVE_NOT_CONNECTED', 'Google Drive belum terhubung.', requestId);
  }

  const { folderId } = params;
  const supabase = createServerSupabaseClient();

  try {
    const { data: folder, error: findError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();

    if (findError || !folder) {
      return createErrorResponse('NOT_FOUND', 'Folder tidak ditemukan.', requestId);
    }

    // Check if folder contains active files
    const { count: fileCount } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId)
      .eq('upload_status', 'completed')
      .is('deleted_at', null);

    if (fileCount && fileCount > 0) {
      return createErrorResponse('CONFLICT', 'Folder tidak dapat dihapus karena masih berisi file.', requestId);
    }

    // Check if folder contains child subfolders
    const { count: childFolderCount } = await supabase
      .from('folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', folderId)
      .is('deleted_at', null);

    if (childFolderCount && childFolderCount > 0) {
      return createErrorResponse('CONFLICT', 'Folder tidak dapat dihapus karena masih berisi subfolder.', requestId);
    }

    // Delete in Google Drive
    await googleDriveAdapter.deleteFile(driveCtx.accessToken, folder.provider_folder_id);

    // Mark deleted in Supabase
    await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', folderId);

    logger.info('Folder deleted', { folderId, userId: user.id, requestId });
    return NextResponse.json({ success: true, message: 'Folder berhasil dihapus.', requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus folder';
    logger.error('Folder deletion error', { message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
