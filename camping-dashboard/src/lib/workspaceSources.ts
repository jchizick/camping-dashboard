export const WORKSPACE_SOURCE_KEYS = [
  'trip',
  'currentWeather',
  'forecast',
  'weatherRefresh',
  'gear',
  'timeline',
  'meals',
  'crew',
  'parkIntel',
  'offlineStatus',
  'astro',
  'alerts',
  'alertRefresh',
  'settings',
  'prepFeed',
] as const;

export type WorkspaceSourceKey = (typeof WORKSPACE_SOURCE_KEYS)[number];
export type WorkspaceSourceState = 'complete' | 'failed';
export type WorkspaceSourceStatus = Record<
  WorkspaceSourceKey,
  WorkspaceSourceState
>;

export function createWorkspaceSourceStatus(
  state: WorkspaceSourceState
): WorkspaceSourceStatus {
  return Object.fromEntries(
    WORKSPACE_SOURCE_KEYS.map((key) => [key, state])
  ) as WorkspaceSourceStatus;
}

export function hasCompleteWorkspaceSources(
  status: WorkspaceSourceStatus
): boolean {
  return WORKSPACE_SOURCE_KEYS.every((key) => status[key] === 'complete');
}
