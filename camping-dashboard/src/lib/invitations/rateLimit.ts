import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { InvitationFailure, type InvitationOperation } from './service';

export interface RateRule { key:string; limit:number; seconds:number }
export type ConsumeRates = (rules:RateRule[]) => Promise<{allowed:boolean; retryAfter:number}>;
export type LimitOperation = (actor:string, operation:InvitationOperation, tripId?:string, email?:string) => Promise<void>;
export function invitationLimiter(secret:string, consume:ConsumeRates) {
  if (secret.length<32) throw new Error('Rate configuration unavailable');
  const rule = (parts:string[],limit:number,seconds:number):RateRule => ({
    key:createHmac('sha256',secret).update(JSON.stringify(parts)).digest('hex'),limit,seconds,
  });
  const check = async (rules:RateRule[]) => {
    let result;
    try { result=await consume(rules); } catch { throw new InvitationFailure('invitation_failed',503); }
    if (typeof result?.allowed!=='boolean' || !Number.isInteger(result.retryAfter) || result.retryAfter<0) {
      throw new InvitationFailure('invitation_failed',503);
    }
    if (!result.allowed) throw new InvitationFailure('rate_limited',429,Math.max(1,result.retryAfter));
  };
  return {
    // Vercel overwrites x-forwarded-for at its edge. Never trust it outside that deployment.
    network:async (headers:Headers) => {
      const raw=process.env.VERCEL==='1' ? headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
      let network=raw && isIP(raw) ? raw : 'unavailable';
      if (isIP(network)===6) {
        // Normalize IPv6 and share a /64 bucket; changing privacy addresses does not reset the budget.
        const expanded=new URL(`http://[${network}]/`).hostname.slice(1,-1).split('::');
        const left=expanded[0].split(':').filter(Boolean), right=(expanded[1]??'').split(':').filter(Boolean);
        network=[...left,...Array(Math.max(0,8-left.length-right.length)).fill('0'),...right]
          .slice(0,4).map(part=>part.padStart(4,'0')).join(':');
      }
      await check([rule(['network',network],60,60)]);
    },
    operation:async (actor:string,operation:InvitationOperation,tripId?:string,email?:string) => {
      if (!email || !tripId) {
        const limit=operation==='inspect' ? 30 : operation==='accept' ? 10 : 20;
        await check([rule(['actor',actor,operation==='create'||operation==='resend' ? 'send' : operation],limit,
          operation==='create'||operation==='resend' ? 3600 : 60)]);
      } else {
        // Recipient resolved only after owner authorization. Create and resend share these budgets.
        await check([rule(['trip',tripId],30,3600),rule(['recipient',email],10,3600),
          rule(['trip-recipient',tripId,email],5,3600),rule(['send-cooldown',tripId,email],1,60)]);
      }
    },
  };
}
