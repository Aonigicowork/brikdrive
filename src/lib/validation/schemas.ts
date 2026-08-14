import { z } from 'zod';

// Sanitizes filenames by removing path traversal, control characters, and leading/trailing dots/spaces
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : 'unnamed_file';
}

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama folder wajib diisi')
    .max(120, 'Nama folder maksimal 120 karakter')
    .refine((val) => !/[/\\:*?"<>|]/.test(val), {
      message: 'Nama folder tidak boleh mengandung karakter khusus / \\ : * ? " < > |',
    }),
  parentId: z.string().uuid('ID folder parent tidak valid').nullable().optional(),
});

export const updateFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama folder wajib diisi')
    .max(120, 'Nama folder maksimal 120 karakter')
    .refine((val) => !/[/\\:*?"<>|]/.test(val), {
      message: 'Nama folder tidak boleh mengandung karakter khusus / \\ : * ? " < > |',
    })
    .optional(),
  parentId: z.string().uuid('ID folder parent tidak valid').nullable().optional(),
});

export const initiateUploadSchema = z.object({
  originalName: z.string().trim().min(1, 'Nama file wajib diisi').max(255, 'Nama file terlalu panjang'),
  mimeType: z
    .string()
    .trim()
    .refine((val) => val.startsWith('image/') || val.startsWith('video/'), {
      message: 'Hanya format foto (image/*) dan video (video/*) yang didukung.',
    }),
  byteSize: z
    .number()
    .int('Ukuran file harus berupa integer')
    .positive('Ukuran file harus lebih dari 0')
    .max(5368709120, 'Batas ukuran file maksimal adalah 5 GiB (5.368.709.120 byte)'),
  folderId: z.string().uuid('ID folder tidak valid').nullable().optional(),
});

export const completeUploadSchema = z.object({
  providerFileId: z.string().trim().min(5, 'Provider file ID tidak valid'),
});

export const createShareSchema = z.object({
  expiresInHours: z
    .number()
    .int()
    .min(1, 'Masa kedaluwarsa minimal 1 jam')
    .max(720, 'Masa kedaluwarsa maksimal 30 hari (720 jam)')
    .nullable()
    .optional(),
});

export const listFilesQuerySchema = z.object({
  folderId: z.string().uuid().nullable().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  sort: z.enum(['name_asc', 'name_desc', 'date_asc', 'date_desc', 'size_asc', 'size_desc']).default('date_desc'),
});
