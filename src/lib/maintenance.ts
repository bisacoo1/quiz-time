/**
 * Maintenance mode — a single env toggle:
 *
 *   MAINTENANCE_MODE=1   (also accepts true / yes / on)
 *
 * While it is on, signed-out visitors get a server-rendered maintenance
 * page instead of the app; signed-in users (the owners) keep full access
 * and see a banner explaining the situation.
 *
 * The env var is read inside this function on every request — never
 * statically evaluate it at module scope, or a build-time snapshot would
 * freeze the toggle.
 */
export function isMaintenanceMode(): boolean {
  const raw = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
