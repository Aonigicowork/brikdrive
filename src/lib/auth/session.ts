import { createServerSupabaseClient, createAdminClient } from '@/lib/db/supabase-server';
import { decryptString } from '@/lib/crypto/encryption';
import { googleDriveAdapter } from '@/lib/google-drive/client';
import { DriveConnection } from '@/types/database';

export interface AuthenticatedUserContext {
  userId: string;
  email?: string;
  connection?: DriveConnection;
  accessToken?: string;
}

/**
 * Validates the current user session from Supabase cookies.
 * Returns the userId if authenticated, or null if no session.
 */
export async function getAuthenticatedUser(req?: Request): Promise<{ id: string; email?: string } | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return {
      id: user.id,
      email: user.email,
    };
  }

  // Fallback: Check Authorization header or query parameter
  if (req) {
    let token: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    } else {
      try {
        const url = new URL(req.url);
        token = url.searchParams.get('token') || url.searchParams.get('auth_token');
      } catch {
        // ignore
      }
    }

    if (token) {
      const admin = createAdminClient();
      const {
        data: { user: tokenUser },
      } = await admin.auth.getUser(token);

      if (tokenUser) {
        return {
          id: tokenUser.id,
          email: tokenUser.email,
        };
      }
    }
  }

  return null;
}

/**
 * Retrieves the active Google Drive connection for the given user,
 * decrypts the stored refresh token, and obtains a fresh access token.
 */
export async function getActiveDriveConnection(
  userId: string
): Promise<{ connection: DriveConnection; accessToken: string } | null> {
  const admin = createAdminClient();

  const { data: connection, error } = await admin
    .from('drive_connections')
    .select('*')
    .eq('owner_id', userId)
    .is('revoked_at', null)
    .single();

  if (error || !connection) {
    return null;
  }

  try {
    const refreshToken = decryptString(connection.refresh_token_ciphertext);
    const accessToken = await googleDriveAdapter.refreshAccessToken(refreshToken);

    return {
      connection: connection as DriveConnection,
      accessToken,
    };
  } catch (err) {
    console.error('Failed to decrypt or refresh Google Drive connection token:', err);
    return null;
  }
}
