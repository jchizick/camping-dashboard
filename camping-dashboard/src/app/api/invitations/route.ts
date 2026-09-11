import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabaseClient } from '@/lib/serverSupabase';
import { localInvitationDelivery, localInvitationsEnabled } from '@/lib/invitations/delivery';
import { callInvitationBridge } from '@/lib/invitations/server';
import { InvitationFailure, runInvitationOperation, type InvitationOperation } from '@/lib/invitations/service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow' };
const reply = (body: unknown,status = 200) => NextResponse.json(body,{status,headers});

async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new InvitationFailure('invalid_request',400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new InvitationFailure('invalid_request',413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(request: NextRequest) {
  // Origin is mandatory even for inspect: the token travels in JSON, never in an API URL.
  if (request.headers.get('origin') !== new URL(request.url).origin
    || request.headers.get('sec-fetch-site') === 'cross-site') return reply({code:'invalid_origin'},403);
  if (!localInvitationsEnabled()) return reply({code:'delivery_unavailable'},503);
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({code:'invalid_request'},400);
    const text = await boundedBody(request);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({code:'invalid_request'},400);
    const {operation,...input} = body;
    if (!['create','resend','revoke','inspect','accept'].includes(operation)) return reply({code:'invalid_request'},400);
    const client = await createRequestSupabaseClient();
    const {data:{user},error} = await client.auth.getUser();
    const actor = error ? null : user?.id ?? null;
    const result = await runInvitationOperation({call:callInvitationBridge,delivery:localInvitationDelivery,origin:new URL(request.url).origin},
      actor,operation as InvitationOperation,input);
    return reply(result);
  } catch (error) {
    if (error instanceof InvitationFailure) return reply({code:error.code},error.status);
    if (error instanceof SyntaxError) return reply({code:'invalid_request'},400);
    return reply({code:'invitation_failed'},503);
  }
}
