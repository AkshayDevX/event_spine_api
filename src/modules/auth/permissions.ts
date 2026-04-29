export const permissionScopes = [
  "workflow:read",
  "workflow:write",
  "workflow:execute",
  "api_keys:manage",
] as const;

export type PermissionScope = (typeof permissionScopes)[number];
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | "api_key";

const roleScopes: Record<WorkspaceRole, PermissionScope[]> = {
  owner: [...permissionScopes],
  admin: [...permissionScopes],
  member: ["workflow:read", "workflow:write", "workflow:execute"],
  viewer: ["workflow:read"],
  api_key: [],
};

export function scopesForRole(role: WorkspaceRole): PermissionScope[] {
  return roleScopes[role] ?? roleScopes.viewer;
}

export function hasRequiredScopes(
  actualScopes: readonly string[],
  requiredScopes: readonly PermissionScope[],
) {
  if (requiredScopes.length === 0) return true;
  return requiredScopes.every(
    (scope) => actualScopes.includes(scope) || actualScopes.includes("*"),
  );
}
