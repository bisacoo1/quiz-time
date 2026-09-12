import { Wrench } from "lucide-react";

/**
 * Banner shown to signed-in users while MAINTENANCE_MODE is on.
 * Server-rendered by the root layout above the normal app UI.
 */
export function MaintenanceBanner({ name }: { name?: string | null }) {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <div className="maintenance-banner" role="status">
      <Wrench size={18} aria-hidden style={{ flexShrink: 0 }} />
      <span>
        <strong>Maintenance mode is on.</strong>{" "}
        {firstName ? `${firstName}, you` : "You"} are signed in, so you keep
        full access — everyone else sees a maintenance page.
      </span>
    </div>
  );
}
