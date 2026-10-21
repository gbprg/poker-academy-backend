type TrackerRequest = Record<string, any>;

export const RATE_LIMITS = {
  ttlMs: 60_000,
  authAttempts: 5,
  globalPerMinute: 300,
} as const;

export function credentialScopedTracker(request: TrackerRequest): string {
  const ip =
    typeof request.ip === 'string' && request.ip.length > 0 ? request.ip : 'unknown-ip';
  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim().toLocaleLowerCase('en-US')
      : 'unknown-email';
  return `${ip}|login|${email}`;
}
