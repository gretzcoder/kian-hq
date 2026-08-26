/**
 * Google Drive API Client for Edge / Cloudflare Workers
 * Authenticates using Service Account RS256 JWT assertion via Web Crypto API.
 */

// Helper to convert base64 / base64url
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string): string {
  let str = '';
  if (typeof buffer === 'string') {
    str = btoa(buffer);
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import a PKCS#8 PEM private key using Web Crypto API.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');

  const binaryStr = atob(cleanPem);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Generate Google OAuth2 Access Token using RS256 Signed JWT
 */
export async function getGoogleDriveAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  if (!clientEmail || !privateKeyPem) {
    throw new Error('Kredensial Service Account (email & private key) belum diset di Setting Storage.');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  const cryptoKey = await importPrivateKey(privateKeyPem);
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signature = base64UrlEncode(signatureBuffer);
  const jwtAssertion = `${unsignedToken}.${signature}`;

  // Exchange JWT for OAuth2 Access Token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtAssertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Gagal otentikasi Google Drive Service Account: ${tokenResponse.status} - ${errorText}`);
  }

  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Create a public folder inside parentFolderId
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId && parentFolderId.trim()) {
    metadata.parents = [parentFolderId.trim()];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membuat folder Google Drive: ${errText}`);
  }

  const folder = (await res.json()) as { id: string; webViewLink: string };

  // Make folder publicly accessible for viewing
  await makeDriveItemPublic(accessToken, folder.id);

  return folder;
}

/**
 * Make a Google Drive file or folder publicly accessible (reader: anyone)
 */
export async function makeDriveItemPublic(accessToken: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (err) {
    console.warn(`[gdrive] Could not set public permission for file ${fileId}:`, err);
  }
}

/**
 * Upload a file directly to Google Drive
 */
export async function uploadFileToDrive(
  accessToken: string,
  fileData: ArrayBuffer | Uint8Array,
  fileName: string,
  mimeType: string,
  parentFolderId?: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: any = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
  };
  if (parentFolderId && parentFolderId.trim()) {
    metadata.parents = [parentFolderId.trim()];
  }

  const encoder = new TextEncoder();
  const metaHeader = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const metaHeaderBytes = encoder.encode(metaHeader);
  const fileBytes = new Uint8Array(fileData);
  const footerBytes = encoder.encode(closeDelimiter);

  const bodyLength = metaHeaderBytes.byteLength + fileBytes.byteLength + footerBytes.byteLength;
  const multipartBody = new Uint8Array(bodyLength);

  multipartBody.set(metaHeaderBytes, 0);
  multipartBody.set(fileBytes, metaHeaderBytes.byteLength);
  multipartBody.set(footerBytes, metaHeaderBytes.byteLength + fileBytes.byteLength);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal upload file ke Google Drive: ${res.status} - ${errText}`);
  }

  const result = (await res.json()) as { id: string; webViewLink: string; webContentLink?: string };

  // Grant public view permission
  await makeDriveItemPublic(accessToken, result.id);

  const webViewLink = result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
  const webContentLink = result.webContentLink || `https://drive.google.com/uc?id=${result.id}&export=download`;

  return {
    id: result.id,
    webViewLink,
    webContentLink,
  };
}

/**
 * Test credentials and verify root folder access
 */
export async function testGoogleDriveCredentials(
  clientEmail: string,
  privateKeyPem: string,
  rootFolderId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getGoogleDriveAccessToken(clientEmail, privateKeyPem);
    if (!token) return { success: false, message: 'Gagal mendapatkan OAuth token.' };

    if (rootFolderId && rootFolderId.trim()) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId.trim()}?fields=id,name,mimeType`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, message: `Root Folder ID tidak ditemukan atau tidak diberi akses ke Service Account. Error: ${errText}` };
      }
      const folderInfo = (await res.json()) as { name: string };
      return { success: true, message: `Terhubung ke Google Drive! Folder Root: "${folderInfo.name}"` };
    }

    return { success: true, message: `Terhubung ke Google Drive Service Account (${clientEmail})!` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Koneksi gagal.' };
  }
}
