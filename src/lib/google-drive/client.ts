/**
 * Google Drive API Client & OAuth Adapter for BrikDrive
 * Least-privilege scope: https://www.googleapis.com/auth/drive.file
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleDriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
}

export class GoogleDriveAdapter {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/v1/drive-connection/callback';
  }

  /**
   * Generates Google OAuth authorization URL for offline Google Drive consent
   */
  getAuthorizationUrl(state: string, codeChallenge?: string, customRedirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: customRedirectUri || this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
    customRedirectUri?: string
  ): Promise<GoogleTokens> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: customRedirectUri || this.redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to exchange authorization code: ${res.status} ${errText}`);
    }

    return res.json();
  }

  /**
   * Refreshes access token using stored refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to refresh Google Drive access token: ${res.status} ${errText}`);
    }

    const data: GoogleTokens = await res.json();
    return data.access_token;
  }

  /**
   * Gets Google user info (email) from access token
   */
  async getUserEmail(accessToken: string): Promise<string> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve Google user profile');
    }
    const data = await res.json();
    return data.email;
  }

  /**
   * Ensures the root application folder 'BrikDrive' exists in the user's Google Drive
   */
  async ensureRootFolder(accessToken: string): Promise<string> {
    // Search for existing active folder named 'BrikDrive'
    const q = "name = 'BrikDrive' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents";
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'BrikDrive',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'BrikDrive Personal Cloud Storage Root Folder',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create BrikDrive root folder: ${createRes.status} ${err}`);
    }

    const newFolder = await createRes.json();
    return newFolder.id;
  }

  /**
   * Creates a subfolder in Google Drive
   */
  async createFolder(accessToken: string, name: string, parentProviderId: string): Promise<string> {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentProviderId],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Google Drive folder: ${res.status} ${err}`);
    }

    const folder = await res.json();
    return folder.id;
  }

  /**
   * Renames or moves a folder in Google Drive
   */
  async updateFolder(
    accessToken: string,
    folderId: string,
    params: { name?: string; addParents?: string; removeParents?: string }
  ): Promise<void> {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
    if (params.addParents) url.searchParams.set('addParents', params.addParents);
    if (params.removeParents) url.searchParams.set('removeParents', params.removeParents);

    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update folder in Google Drive: ${res.status} ${err}`);
    }
  }

  /**
   * Initiates a Resumable Upload Session directly with Google Drive API
   */
  async initiateResumableUpload(
    accessToken: string,
    params: {
      name: string;
      mimeType: string;
      parentFolderId: string;
      brikdriveFileId: string;
      byteSize: number;
    }
  ): Promise<string> {
    const metadata = {
      name: params.name,
      mimeType: params.mimeType,
      parents: [params.parentFolderId],
      appProperties: {
        brikdriveFileId: params.brikdriveFileId,
      },
    };

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': params.byteSize.toString(),
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to initiate resumable upload session: ${res.status} ${err}`);
    }

    const sessionUri = res.headers.get('Location');
    if (!sessionUri) {
      throw new Error('Google Drive API did not return Location header for resumable session');
    }

    return sessionUri;
  }

  /**
   * Reads and verifies file metadata from Google Drive server-side
   */
  async getFileInfo(accessToken: string, providerFileId: string): Promise<GoogleDriveFileInfo> {
    const fields = 'id,name,mimeType,size,parents,appProperties,trashed';
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${providerFileId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to fetch file metadata from Google Drive: ${res.status} ${err}`);
    }

    return res.json();
  }

  /**
   * Creates an 'anyone: reader' permission on Google Drive for public sharing
   */
  async createPublicPermission(accessToken: string, providerFileId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${providerFileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Google Drive public permission: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.id;
  }

  /**
   * Revokes / deletes a permission from a Google Drive file
   */
  async deletePermission(accessToken: string, providerFileId: string, permissionId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${providerFileId}/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Failed to delete permission on Google Drive: ${res.status} ${err}`);
    }
  }

  /**
   * Deletes a file permanently or moves it to trash in Google Drive
   */
  async deleteFile(accessToken: string, providerFileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${providerFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Failed to delete Google Drive file: ${res.status} ${err}`);
    }
  }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
