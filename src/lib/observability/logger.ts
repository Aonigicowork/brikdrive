import { NextResponse } from 'next/server';
import crypto from 'crypto';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'DRIVE_NOT_CONNECTED'
  | 'UPLOAD_EXPIRED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_ERROR'
  | 'INTERNAL_ERROR';

const STATUS_CODE_MAP: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  QUOTA_EXCEEDED: 409,
  DRIVE_NOT_CONNECTED: 409,
  UPLOAD_EXPIRED: 410,
  RATE_LIMITED: 429,
  DEPENDENCY_ERROR: 503,
  INTERNAL_ERROR: 500,
};

export function getRequestId(request?: Request): string {
  if (request) {
    const existing = request.headers.get('x-request-id');
    if (existing) return existing;
  }
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'authorization',
    'cookie',
    'password',
    'secret',
    'refresh_token',
    'access_token',
    'resumable_uri',
    'session_uri',
    'code',
    'token',
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info(message: string, meta: Record<string, unknown> = {}) {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...sanitizeLogData(meta) }));
  },
  warn(message: string, meta: Record<string, unknown> = {}) {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), ...sanitizeLogData(meta) }));
  },
  error(message: string, meta: Record<string, unknown> = {}) {
    console.error(JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...sanitizeLogData(meta) }));
  },
};

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  customStatus?: number
): NextResponse {
  const status = customStatus || STATUS_CODE_MAP[code] || 500;
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
      },
    },
    {
      status,
      headers: {
        'x-request-id': requestId,
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
