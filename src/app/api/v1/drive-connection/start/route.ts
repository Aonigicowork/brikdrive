import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { getRequestId, createErrorResponse } from '@/lib/observability/logger';
import { generateRandomToken } from '@/lib/crypto/encryption';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return createErrorResponse('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', requestId);
  }

  try {
    const origin = req.nextUrl.origin;
    const redirectUri = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || `${origin}/api/v1/drive-connection/callback`;

    // Generate secure state containing userId, redirectUri and random entropy
    const rawState = JSON.stringify({
      userId: user.id,
      redirectUri,
      nonce: generateRandomToken(16),
      timestamp: Date.now(),
    });
    const state = Buffer.from(rawState).toString('base64url');

    const authUrl = googleDriveAdapter.getAuthorizationUrl(state, undefined, redirectUri);

    return NextResponse.json({
      authUrl,
      requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memulai koneksi Google Drive';
    return createErrorResponse('INTERNAL_ERROR', message, requestId);
  }
}
