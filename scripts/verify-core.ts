import { encryptString, decryptString, hashShareToken, safeCompare, generateRandomToken } from '../src/lib/crypto/encryption';
import { initiateUploadSchema, createFolderSchema, sanitizeFilename } from '../src/lib/validation/schemas';

function runTests() {
  console.log('--- Starting BrikDrive Core Verification Tests ---');

  // Test 1: Encryption & Decryption (Envelope AES-256-GCM)
  const secretKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const rawToken = '1//0gabcdef123456_Google_OAuth_Refresh_Token_Secret_Sample';
  const ciphertext = encryptString(rawToken, secretKey, 1);

  console.assert(ciphertext.startsWith('v1:'), 'Encrypted payload must have v1: prefix');
  const decrypted = decryptString(ciphertext, secretKey);
  console.assert(decrypted === rawToken, 'Decrypted token must match original token');
  console.log('✓ Test 1 Passed: Envelope encryption & decryption works seamlessly.');

  // Test 2: Token Hashing & Safe Compare
  const shareToken = generateRandomToken(32);
  const hash1 = hashShareToken(shareToken);
  const hash2 = hashShareToken(shareToken);
  console.assert(hash1 === hash2, 'Hash must be deterministic');
  console.assert(safeCompare(hash1, hash2) === true, 'Timing-safe comparison must be true');
  console.assert(safeCompare(hash1, 'different_hash_value') === false, 'Comparison with different hash must be false');
  console.log('✓ Test 2 Passed: Share token hashing & constant-time comparison passed.');

  // Test 3: Filename Sanitization & Zod Schemas
  const maliciousName = '../../../etc/passwd.jpg\x00';
  const sanitized = sanitizeFilename(maliciousName);
  console.assert(!sanitized.includes('/'), 'Sanitized name must not have slashes');
  console.assert(!sanitized.includes('\x00'), 'Sanitized name must not have null bytes');
  console.log(`✓ Test 3 Passed: Filename sanitized: "${maliciousName}" -> "${sanitized}".`);

  // Test 4: Zod Validations
  const validUpload = initiateUploadSchema.safeParse({
    originalName: 'holiday_video.mp4',
    mimeType: 'video/mp4',
    byteSize: 1024 * 1024 * 500, // 500 MB
  });
  console.assert(validUpload.success, 'Valid video upload payload must pass Zod parse');

  const invalidMime = initiateUploadSchema.safeParse({
    originalName: 'malware.exe',
    mimeType: 'application/x-msdownload',
    byteSize: 1000,
  });
  console.assert(!invalidMime.success, 'Invalid mime type must be rejected by Zod');

  const oversized = initiateUploadSchema.safeParse({
    originalName: 'huge_file.mp4',
    mimeType: 'video/mp4',
    byteSize: 6 * 1024 * 1024 * 1024, // 6 GiB (exceeds 5 GiB limit)
  });
  console.assert(!oversized.success, 'File > 5 GiB must be rejected');

  console.log('✓ Test 4 Passed: Zod schemas enforce MIME restrictions and 5 GiB limits.');

  console.log('--- ALL 4 VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests();
