import { AxiosError } from 'axios';

const AERO_TASK_FAILED = 'aero task failed';

/** Split "Aero task failed: …" into a short summary and optional detail tail. */
export function aeroTaskErrorParts(
  message: string,
  mySummary: string
): {
  summary: string;
  details?: string;
} {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith(AERO_TASK_FAILED)) {
    return { summary: mySummary, details: trimmed };
  }
  const rest = trimmed.slice(AERO_TASK_FAILED.length).replace(/^\s*:\s*/, '');
  return { summary: mySummary, details: rest || undefined };
}

const errorText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** Aero poll payloads that mean the task failed (not still pending). */
export function transcriptionPollError(response: unknown): string | undefined {
  if (response == null) return undefined;
  if (typeof response === 'string') {
    const text = errorText(response);
    return text?.toLowerCase().startsWith(AERO_TASK_FAILED) ? text : undefined;
  }
  if (typeof response !== 'object') return undefined;
  const body = response as Record<string, unknown>;
  const message = errorText(body.message);
  if (message?.toLowerCase().startsWith(AERO_TASK_FAILED)) return message;
  const error = errorText(body.error);
  if (error) return error;
  const detail = errorText(body.detail);
  if (detail) return detail;
  const status = errorText(body.status)?.toLowerCase();
  if (status === 'failed' || status === 'error') {
    return message ?? error ?? detail ?? 'Task failed';
  }
  return undefined;
}

export function axiosErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object') {
      const body = data as Record<string, unknown>;
      const message = errorText(body.message);
      if (message) return message;
      const detail = errorText(body.detail);
      if (detail) return detail;
      const error = errorText(body.error);
      if (error) return error;
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        const first = body.errors[0] as { detail?: string };
        const nested = errorText(first?.detail);
        if (nested) return nested;
      }
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
