import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AppError) {
    return jsonError(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return jsonError('VALIDATION_ERROR', '請求資料格式不符，請檢查輸入內容。', 400, {
      issues: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  console.error('[API Error]', err);
  return jsonError('INTERNAL_ERROR', '系統暫時無法處理請求，請稍後再試。', 500);
}
