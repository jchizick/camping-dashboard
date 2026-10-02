// Availability only: public environment values are compiled into the Next.js build.
// This is not a provider security control or a runtime kill switch.
export function emailCodeSignInEnabled() {
  return process.env.NEXT_PUBLIC_EMAIL_CODE_SIGN_IN_ENABLED === 'true';
}

export function emailCodeError(error: unknown, action: 'request' | 'verify'): Error {
  const value = error as { status?: number; code?: string; name?: string } | null;
  if (value?.status === 429 || value?.code === 'over_email_send_rate_limit' || value?.code === 'over_request_rate_limit') {
    return new Error('Too many attempts. Wait a minute before trying again.');
  }
  if (value?.code === 'otp_expired') return new Error('That code is invalid or expired. Try again or request a new code.');
  if (value?.name === 'AuthRetryableFetchError' || value?.name === 'TypeError') {
    return new Error('We could not connect. Check your connection and try again.');
  }
  return new Error(action === 'request'
    ? 'We could not request a code. Please try again shortly.'
    : 'We could not verify that code. Try again or request a new code.');
}
