import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {parseAccessManagement} from './management';

const person={membershipId:'10000000-0000-0000-0000-000000000001',email:null,role:'viewer',isCurrentUser:false};
it('preserves a missing email as null without dropping the member or leaking identity internals',()=>{
  expect(parseAccessManagement({people:[{...person,token:'secret',userId:'internal',identities:[],refresh_token:'secret'}],pendingInvitations:[]}))
    .toEqual({people:[person],pendingInvitations:[]});
});
it.each([null,{}, {people:[],pendingInvitations:null}, {people:[{...person,role:'admin'}],pendingInvitations:[]},
  {people:[{...person,email:{private:true}}],pendingInvitations:[]}, {people:[{...person,membershipId:'bad'}],pendingInvitations:[]},
  {people:[],pendingInvitations:[{invitationId:'bad'}]}])('rejects invalid bridge shape %j',value=>{
  expect(parseAccessManagement(value)).toBeNull();
});
it('never forwards historical invitations or unexpected timestamps',()=>{
  const row={invitationId:person.membershipId,email:'test@example.test',role:'editor',status:'accepted',createdAt:'2026-01-01',expiresAt:'2026-02-01'};
  expect(parseAccessManagement({people:[],pendingInvitations:[row]})).toBeNull();
  expect(parseAccessManagement({people:[],pendingInvitations:[{...row,status:'pending',expiresAt:'invalid'}]})).toBeNull();
});
