/* Paste into DevTools on the authenticated STAGING app during an approved QA window.
 * No request runs on paste. No cookies/tokens are read, copied, persisted or logged.
 * Browser-managed same-origin credentials are the ephemeral session handoff.
 * Account identity must be checked in Account before each case; never run in production.
 */
globalThis.fieldProtocolAccessRemovalQA = async function ({tripId,membershipId,expected,confirmRemoval} = {}) {
  if (location.origin !== 'https://staging.fieldprotocol.online') throw new Error('STAGING_ORIGIN_REQUIRED');
  if (confirmRemoval !== true || !['allowed','denied','signed_out'].includes(expected)
    || typeof tripId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(tripId)
    || typeof membershipId !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(membershipId)) {
    throw new Error('EXPLICIT_SYNTHETIC_TARGET_AND_EXPECTATION_REQUIRED');
  }
  // The product route calls staging auth.getUser() and derives the actor itself.
  // A foreign-project session cannot be supplied as an actor or bearer override here.
  let response;
  try {
    response=await fetch('/api/invitations',{
      method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({operation:'remove_access',tripId,membershipId}),
      signal:AbortSignal.timeout(15000),
    });
  } catch { return {verdict:'UNVERIFIED',result:'TRANSPORT_UNKNOWN_DO_NOT_RETRY_AUTOMATICALLY'}; }
  let body;
  try {body=await response.json();}catch{return {verdict:'FAIL',result:'UNEXPECTED_RESPONSE'};}
  const result=response.status===200&&body?.outcome==='access_removed' ? 'allowed'
    :response.status===403&&body?.code==='not_authorized' ? 'denied'
    :response.status===401&&body?.code==='not_authenticated' ? 'signed_out' : 'unexpected';
  // No response echo, target identifiers, identity, cookies, keys or invitation content.
  return {verdict:result===expected?'PASS':'FAIL',status:response.status,result};
};
