import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-server';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { decryptString } from '@/lib/crypto/encryption';
import { getRequestId, createErrorResponse, logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return createErrorResponse('FORBIDDEN', 'Unauthorized cron trigger', requestId);
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let revokedSharesCount = 0;
  let processedDeletionsCount = 0;

  try {
    // 1. Process Expired Shares
    const { data: expiredShares } = await admin
      .from('file_shares')
      .select('*, files(*), drive_connections:owner_id(*)')
      .lt('expires_at', now)
      .is('revoked_at', null)
      .limit(50);

    if (expiredShares && expiredShares.length > 0) {
      for (const share of expiredShares) {
        // Mark revoked in DB
        await admin.from('file_shares').update({ revoked_at: now }).eq('id', share.id);
        revokedSharesCount++;

        // Revoke Google Drive permission if connection available
        try {
          const { data: conn } = await admin
            .from('drive_connections')
            .select('*')
            .eq('owner_id', share.owner_id)
            .is('revoked_at', null)
            .maybeSingle();

          if (conn && share.files?.provider_file_id && share.drive_permission_id) {
            const refreshToken = decryptString(conn.refresh_token_ciphertext);
            const accessToken = await googleDriveAdapter.refreshAccessToken(refreshToken);
            await googleDriveAdapter.deletePermission(
              accessToken,
              share.files.provider_file_id,
              share.drive_permission_id
            );
          }
        } catch (permErr) {
          logger.warn('Cron error deleting expired Drive permission', {
            shareId: share.id,
            error: permErr instanceof Error ? permErr.message : String(permErr),
            requestId,
          });
        }
      }
    }

    // 2. Process Pending Deletion Jobs
    const { data: pendingJobs } = await admin
      .from('deletion_jobs')
      .select('*, files(owner_id)')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', now)
      .lt('attempts', 5)
      .limit(25);

    if (pendingJobs && pendingJobs.length > 0) {
      for (const job of pendingJobs) {
        const ownerId = job.files?.owner_id;
        if (!ownerId) {
          await admin.from('deletion_jobs').update({ status: 'completed' }).eq('id', job.id);
          continue;
        }

        try {
          const { data: conn } = await admin
            .from('drive_connections')
            .select('*')
            .eq('owner_id', ownerId)
            .is('revoked_at', null)
            .maybeSingle();

          if (conn) {
            const refreshToken = decryptString(conn.refresh_token_ciphertext);
            const accessToken = await googleDriveAdapter.refreshAccessToken(refreshToken);

            // Delete original file
            await googleDriveAdapter.deleteFile(accessToken, job.provider_file_id);

            // Delete preview file if exists
            if (job.preview_provider_file_id) {
              await googleDriveAdapter.deleteFile(accessToken, job.preview_provider_file_id).catch(() => {});
            }

            await admin.from('deletion_jobs').update({ status: 'completed', updated_at: now }).eq('id', job.id);
            processedDeletionsCount++;
          }
        } catch (jobErr) {
          const attempts = (job.attempts || 0) + 1;
          const nextAttempt = new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000).toISOString();
          await admin
            .from('deletion_jobs')
            .update({
              attempts,
              status: attempts >= 5 ? 'failed' : 'pending',
              next_attempt_at: nextAttempt,
              last_error_code: jobErr instanceof Error ? jobErr.message : String(jobErr),
              updated_at: now,
            })
            .eq('id', job.id);
        }
      }
    }

    logger.info('Cron cleanup cycle finished', { revokedSharesCount, processedDeletionsCount, requestId });

    return NextResponse.json({
      success: true,
      revokedSharesCount,
      processedDeletionsCount,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron cleanup failed';
    logger.error('Cron cleanup exception', { message, requestId });
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
