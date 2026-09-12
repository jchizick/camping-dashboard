// Diagnostic only. Never imported by the authorization gate.
// This describes direct ACL/PUBLIC paths, not role inheritance or body authorization.
export function describeExecute(catalog, signature, role) {
  const entries = catalog.filter(([kind, key]) => kind === 'function-grant' && key.startsWith(signature + '.'));
  const direct = entries.find(([, key]) => key === `${signature}.${role}.EXECUTE`);
  const throughPublic = entries.some(([, key]) => key === `${signature}.PUBLIC.EXECUTE`);
  return {direct: !!direct, throughPublic, aclAllows: !!direct || throughPublic, grantOption: direct?.[2] === true};
}

export function diagnoseExecute(before, after, signature, role) {
  const a = describeExecute(before, signature, role), b = describeExecute(after, signature, role);
  return {authorization: false, before: a, after: b,
    classification: a.grantOption !== b.grantOption ? 'GRANT_OPTION_CHANGE'
      : a.aclAllows !== b.aclAllows ? 'EXECUTION_ACCESS_CHANGE'
      : a.direct !== b.direct ? 'REDUNDANT_ACL_PATH_CHANGE' : 'NO_ROLE_ACCESS_CHANGE'};
}
