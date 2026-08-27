export type RemoteWorkspaceFailureKind =
  | 'network'
  | 'temporary'
  | 'denied'
  | 'not-found';

export class RemoteWorkspaceError extends Error {
  constructor(
    message: string,
    readonly kind: RemoteWorkspaceFailureKind
  ) {
    super(message);
    this.name = 'RemoteWorkspaceError';
  }
}

export function isExplicitWorkspaceDenial(error: unknown) {
  return (
    error instanceof RemoteWorkspaceError &&
    (error.kind === 'denied' || error.kind === 'not-found')
  );
}
