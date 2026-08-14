import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';
import { listFilesQuerySchema } from '@/lib/validation/schemas';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  const url = new URL(req.url);
  const parseResult = listFilesQuerySchema.safeParse({
    folderId: url.searchParams.get('folderId') || undefined,
    q: url.searchParams.get('q') || undefined,
    cursor: url.searchParams.get('cursor') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    sort: url.searchParams.get('sort') || undefined,
  });

  if (!parseResult.success) {
    return createErrorResponse('VALIDATION_ERROR', parseResult.error.issues[0].message, requestId);
  }

  const { folderId, q, cursor, limit, sort } = parseResult.data;
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from('files')
    .select('*')
    .eq('owner_id', user.id)
    .eq('upload_status', 'completed')
    .is('deleted_at', null);

  // Search filter
  if (q && q.trim().length > 0) {
    query = query.ilike('normalized_name', `%${q.trim()}%`);
  } else if (folderId) {
    query = query.eq('folder_id', folderId);
  } else {
    // Root folder items
    query = query.is('folder_id', null);
  }

  // Sorting
  switch (sort) {
    case 'name_asc':
      query = query.order('normalized_name', { ascending: true });
      break;
    case 'name_desc':
      query = query.order('normalized_name', { ascending: false });
      break;
    case 'size_asc':
      query = query.order('byte_size', { ascending: true });
      break;
    case 'size_desc':
      query = query.order('byte_size', { ascending: false });
      break;
    case 'date_asc':
      query = query.order('created_at', { ascending: true });
      break;
    case 'date_desc':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Cursor pagination
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  query = query.limit(limit + 1);

  const { data: files, error } = await query;
  if (error) {
    logger.error('Error fetching files', { error: error.message, requestId, userId: user.id });
    return createErrorResponse('INTERNAL_ERROR', 'Gagal memuat daftar file', requestId);
  }

  const hasMore = (files || []).length > limit;
  const items = hasMore ? files.slice(0, limit) : files || [];
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

  return NextResponse.json({
    files: items,
    nextCursor,
    hasMore,
    requestId,
  });
}
