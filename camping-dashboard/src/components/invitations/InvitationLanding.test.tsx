// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({replace:vi.fn(),signIn:vi.fn(),signOut:vi.fn(),fetch:vi.fn()}));
const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
vi.mock('next/navigation',()=>({useParams:()=>({token:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}),useRouter:()=>({replace:mocks.replace})}));
vi.mock('@/lib/authContext',()=>({useAuth:()=>({signIn:mocks.signIn,switchInvitationAccount:mocks.signOut})}));
import InvitationLanding from './InvitationLanding';
const response = (body:unknown,status=200) => ({ok:status===200,status,json:async()=>body});
beforeEach(()=>{sessionStorage.clear();window.history.replaceState({},'', '/invite#'+token);vi.stubGlobal('fetch',mocks.fetch);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('only inspects on mount; explicit accept is required and uses replace after success',async()=>{
  mocks.fetch.mockResolvedValueOnce(response({outcome:'pending',tripName:'Synthetic trip',role:'viewer'}));
  render(<InvitationLanding/>);
  await screen.findByRole('button',{name:'Accept invitation'});
  // The initial request is inspection, never acceptance.
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({operation:'inspect',token});
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it('accepts explicitly without caller identity and avoids duplicate submissions',async()=>{
  mocks.fetch.mockResolvedValueOnce(response({outcome:'pending',tripName:'Synthetic trip',role:'editor'}));
  render(<InvitationLanding/>);const button=await screen.findByRole('button',{name:'Accept invitation'});
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  mocks.fetch.mockResolvedValue(response({outcome:'accepted',trip_id:'synthetic-trip'}));
  fireEvent.click(button);fireEvent.click(button);
  await waitFor(()=>expect(mocks.replace).toHaveBeenCalledWith('/trips/synthetic-trip'));
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({operation:'accept',token});
});
it('offers existing Google flow while signed out',async()=>{
  mocks.fetch.mockResolvedValue(response({outcome:'signed_out'}));render(<InvitationLanding/>);
  fireEvent.click(await screen.findByRole('button',{name:'Sign in with Google'}));
  await waitFor(()=>expect(mocks.signIn).toHaveBeenCalledOnce());expect(screen.queryByText('Accept invitation')).toBeNull();
});
it('masks wrong account, blocks acceptance, and preserves switch destination',async()=>{
  mocks.fetch.mockResolvedValue(response({outcome:'identity_mismatch',maskedEmail:'i***@example.test'}));render(<InvitationLanding/>);
  fireEvent.click(await screen.findByRole('button',{name:'Switch account'}));
  expect(screen.getByText(/i\*\*\*@example.test/)).toBeTruthy();
  await waitFor(()=>expect(mocks.signOut).toHaveBeenCalledWith('/invite'));
  expect(screen.queryByText('Accept invitation')).toBeNull();
});
it.each(['expired','revoked','unavailable','already_accepted','accepted'])('shows safe terminal %s without an accept action',async outcome=>{
  mocks.fetch.mockResolvedValue(response({outcome,trip_id:null}));render(<InvitationLanding/>);
  await waitFor(()=>expect(screen.queryByText('Checking invitation…')).toBeNull());
  expect(screen.queryByRole('button')).toBeNull();expect(document.body.textContent).not.toContain(token);
});
it('offers open trip only for a server-verified existing membership',async()=>{
  mocks.fetch.mockResolvedValue(response({outcome:'already_member',trip_id:'trip'}));render(<InvitationLanding/>);
  fireEvent.click(await screen.findByRole('button',{name:'Open trip'}));expect(mocks.replace).toHaveBeenCalledWith('/trips/trip');
});
it('handles network failure without caching or exposing tokens',async()=>{
  mocks.fetch.mockRejectedValue(new Error(token));render(<InvitationLanding/>);
  expect(await screen.findByRole('alert')).toBeTruthy();expect(document.body.textContent).not.toContain(token);
  expect(mocks.fetch.mock.calls[0][1].cache).toBe('no-store');
});

it('cleans before body-only inspection and resumes in the same tab',async()=>{
  mocks.fetch.mockImplementation(async(url,options)=>{
    expect(location.pathname+location.search+location.hash).toBe('/invite');
    expect(url).toBe('/api/invitations');
    expect(JSON.parse(options.body)).toEqual({operation:'inspect',token});
    return response({outcome:'signed_out'});
  });
  const first=render(<InvitationLanding/>); await screen.findByText('Sign in with Google');first.unmount();
  render(<InvitationLanding/>);await screen.findByText('Sign in with Google');
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
it('plain invite has a neutral empty state and makes no inspection request',async()=>{
  history.replaceState({},'', '/invite');render(<InvitationLanding/>);
  expect(await screen.findByText('Open the invitation link from your email.')).toBeTruthy();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('clears consumed state after successful acceptance',async()=>{
  mocks.fetch.mockResolvedValueOnce(response({outcome:'pending',tripName:'Test',role:'viewer'}));
  render(<InvitationLanding/>);const button=await screen.findByText('Accept invitation');
  mocks.fetch.mockResolvedValueOnce(response({outcome:'accepted',trip_id:'trip'}));fireEvent.click(button);
  await waitFor(()=>expect(mocks.replace).toHaveBeenCalled());expect(sessionStorage.length).toBe(0);
});

it('ignores an older acceptance response after a different invitation fragment arrives',async()=>{
  let finish!: (value:unknown)=>void;
  mocks.fetch.mockResolvedValueOnce(response({outcome:'pending',tripName:'First',role:'viewer'}));
  render(<InvitationLanding/>);const accept=await screen.findByText('Accept invitation');
  mocks.fetch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));fireEvent.click(accept);
  mocks.fetch.mockResolvedValueOnce(response({outcome:'pending',tripName:'Second',role:'viewer'}));
  history.replaceState({},'', '/invite#'+'C'.repeat(42)+'A');fireEvent(window,new HashChangeEvent('hashchange'));
  await screen.findByText('Second');finish(response({outcome:'expired'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Accept invitation'}).hasAttribute('disabled')).toBe(false));
  expect(screen.getByText('Second')).toBeTruthy();expect(sessionStorage.length).toBe(1);expect(mocks.replace).not.toHaveBeenCalled();
});
