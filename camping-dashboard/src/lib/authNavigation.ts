import { getInvitationReturnPath } from './invitations/contracts';

export function returnToSignIn(invitationPath?: string) {
  window.location.replace(getInvitationReturnPath(invitationPath) ?? '/trips');
}
