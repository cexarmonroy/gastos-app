export function isPublicPortalEnabled(): boolean {
  return process.env.PUBLIC_PORTAL_ENABLED !== "false";
}
