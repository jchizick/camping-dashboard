import 'server-only';
import type { InvitationMessage } from './delivery';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function invitationTemplate(message: InvitationMessage) {
  const name = message.tripName.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,200);
  const role = message.role === 'editor' ? 'Editor' : 'Viewer';
  const expires = new Date(message.expiresAt).toISOString().replace('T',' ').replace('.000Z',' UTC');
  const intro = `You have been invited to ${name} as a ${role}.`;
  const guidance = 'Sign in with the Google-account email that received this invitation. Nothing is accepted until you confirm.';
  const ignore = 'If you were not expecting this invitation, you can ignore this email.';
  return {
    subject:'Your Field Protocol trip invitation',
    text:`Field Protocol\n\n${intro}\nExpires ${expires}.\n\n${guidance}\n\nAccept invitation:\n${message.acceptanceUrl}\n\n${ignore}`,
    html:`<h1>Field Protocol</h1><p>${escapeHtml(intro)}</p><p>Expires ${escapeHtml(expires)}.</p><p>${guidance}</p><p><a href="${escapeHtml(message.acceptanceUrl)}">Review invitation</a></p><p>${ignore}</p>`,
  };
}
