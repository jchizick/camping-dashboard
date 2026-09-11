import 'server-only';
import type { InvitationConfig } from './config';
import { DeliveryError, type InvitationDelivery } from './delivery';
import { invitationTemplate } from './template';

export function resendInvitationDelivery(config: InvitationConfig, request: typeof fetch = fetch): InvitationDelivery {
  return { async deliver(message, attemptId) {
    if (!attemptId || !/^[a-f0-9-]{36}$/i.test(attemptId)) throw new DeliveryError('invalid_request');
    const url = new URL(message.acceptanceUrl);
    if (url.origin !== config.origin || url.pathname !== '/invite' || url.search || !/^#[A-Za-z0-9_-]{43}$/.test(url.hash)) throw new DeliveryError('invalid_request');
    const payload = JSON.stringify({from:config.from,to:[message.email],reply_to:config.replyTo,...invitationTemplate(message)});
    // One in-request retry uses the same attempt UUID AND exact payload. Resend/rotation gets a new UUID.
    for (let retry=0; retry<2; retry++) {
      try {
        const response = await request('https://api.resend.com/emails',{method:'POST',redirect:'error',cache:'no-store',
          signal:AbortSignal.timeout(5000),headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`invitation/${attemptId}`},body:payload});
        if (response.ok) {
          const result = await response.json();
          if (typeof result.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(result.id)) throw new DeliveryError('provider_unknown');
          return { status:'sent', providerMessageId:result.id };
        }
        // Never read/persist/log provider error bodies (may echo recipients or content).
        if (response.status >= 500 && retry === 0) continue;
        throw new DeliveryError(response.status === 401 || response.status === 403 ? 'provider_auth'
          : response.status === 429 ? 'provider_rate_limited' : response.status >= 500 ? 'provider_unknown' : 'provider_rejected');
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        if (retry === 1) throw new DeliveryError('provider_unknown');
      }
    }
    throw new DeliveryError('provider_unknown');
  }};
}
