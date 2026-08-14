import { NextRequest, NextResponse } from 'next/server';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { encryptString } from '@/lib/crypto/encryption';
import { createAdminClient } from '@/lib/db/supabase-server';
import { getRequestId, logger } from '@/lib/observability/logger';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (error || !code || !stateParam) {
    logger.warn('Google Drive OAuth callback error or rejected by user', { error, requestId });
    return NextResponse.redirect(`${appUrl}/drive?error=oauth_rejected`);
  }

  try {
    // Decode and verify state
    const stateJson = Buffer.from(stateParam, 'base64url').toString('utf8');
    const stateObj = JSON.parse(stateJson);
    const userId = stateObj.userId;

    if (!userId) {
      return NextResponse.redirect(`${appUrl}/drive?error=invalid_state`);
    }

    // Exchange authorization code for tokens
    const tokens = await googleDriveAdapter.exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      logger.warn('No refresh token returned; user might need to re-consent', { requestId, userId });
      // In production, prompt=consent ensures refresh_token is returned
    }

    const email = await googleDriveAdapter.getUserEmail(tokens.access_token);
    const rootFolderId = await googleDriveAdapter.ensureRootFolder(tokens.access_token);

    const encryptedRefreshToken = encryptString(tokens.refresh_token || tokens.access_token);

    const admin = createAdminClient();

    // Revoke any previous active connections for this user
    await admin
      .from('drive_connections')
      .update({ revoked_at: new Date().toISOString() })
      .eq('owner_id', userId)
      .is('revoked_at', null);

    // Insert new active connection
    const { error: insertError } = await admin.from('drive_connections').insert({
      owner_id: userId,
      google_email: email,
      root_folder_id: rootFolderId,
      refresh_token_ciphertext: encryptedRefreshToken,
      token_key_version: 1,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      connected_at: new Date().toISOString(),
    });

    if (insertError) {
      logger.error('Failed to store drive connection', { error: insertError.message, requestId, userId });
      return NextResponse.redirect(`${appUrl}/drive?error=db_error`);
    }

    logger.info('Google Drive successfully connected', { userId, email, requestId });
    return NextResponse.redirect(`${appUrl}/drive?connected=true`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown callback error';
    logger.error('Google Drive callback handler exception', { message, requestId });
    return NextResponse.redirect(`${appUrl}/drive?error=callback_failed`);
  }
}
