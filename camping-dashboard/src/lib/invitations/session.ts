// Browser-only, per-tab recovery across reloads and same-tab OAuth navigation.
// This is a recovery timeout, not the invitation's server-side expiry.
const KEY = 'field-protocol:invitation:v1';
export const INVITATION_RECOVERY_MS = 60 * 60 * 1000;
const tokenShape = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export function clearInvitationSession() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* Storage can be disabled. */ }
}

export function captureInvitationSession(): string | null {
  const fragment = window.location.hash;
  const hasOpener = Boolean(window.opener);
  // Browsers may clone sessionStorage for opener-created tabs. Never resume that copy.
  // Detaching also keeps subsequent same-tab OAuth/reloads from being treated as new tabs.
  try {
    if (hasOpener) {
      clearInvitationSession();
      window.opener = null;
    }
    // Clean before returning a secret or starting any request. If cleanup fails, fail closed.
    if (fragment || window.location.search) window.history.replaceState(window.history.state, '', '/invite');
    if (fragment) {
      clearInvitationSession();
      const token = fragment.slice(1);
      if (!tokenShape.test(token)) return null;
      window.sessionStorage.setItem(KEY, JSON.stringify({ token, expiresAt: Date.now() + INVITATION_RECOVERY_MS }));
      return token;
    }
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved.token === 'string' && tokenShape.test(saved.token)
      && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now()
      && saved.expiresAt <= Date.now() + INVITATION_RECOVERY_MS) return saved.token;
    clearInvitationSession();
    return null;
  } catch {
    clearInvitationSession();
    return null;
  }
}
