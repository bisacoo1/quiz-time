/**
 * Maintenance mode — a single env toggle:
 *
 *   MAINTENANCE_MODE=1   (also accepts true / yes / on)
 *
 * While it is on, only the maintenance owner can sign in or use the app.
 * Everyone else gets a server-rendered maintenance page.
 *
 * The env var is read inside this function on every request — never
 * statically evaluate it at module scope, or a build-time snapshot would
 * freeze the toggle.
 */
export const MAINTENANCE_OWNER_EMAIL = "ambrad_johnlloyd@fbc.ph.education";

export function isMaintenanceMode(): boolean {
  const raw = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Maintenance access is restricted to this exact Google account. */
export function isMaintenanceOwnerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === MAINTENANCE_OWNER_EMAIL;
}

/** New sign-ins and protected app requests share the same maintenance policy. */
export function isMaintenanceAccessAllowed(email: string | null | undefined): boolean {
  return !isMaintenanceMode() || isMaintenanceOwnerEmail(email);
}
