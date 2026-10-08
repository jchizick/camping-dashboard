// Fictional identity; this adapter never imports production Auth or Supabase.
export function useAuth() {
  return {
    user: { id: 'demo', email: undefined as string | undefined,
      user_metadata: { full_name: 'Demo camper', name: undefined as string | undefined } },
    identity: { userId: 'demo', source: 'online' },
  };
}
