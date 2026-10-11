import test from "node:test";
import assert from "node:assert/strict";
import {
  isMaintenanceAccessAllowed,
  isMaintenanceOwnerEmail,
  MAINTENANCE_OWNER_EMAIL,
} from "../src/lib/maintenance.ts";

test("maintenance owner email is matched case-insensitively after trimming", () => {
  assert.equal(isMaintenanceOwnerEmail(` ${MAINTENANCE_OWNER_EMAIL.toUpperCase()} `), true);
  assert.equal(isMaintenanceOwnerEmail("student@example.com"), false);
  assert.equal(isMaintenanceOwnerEmail(null), false);
});

test("maintenance mode allows only the configured maintenance owner", () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = "1";
  try {
    assert.equal(isMaintenanceAccessAllowed(MAINTENANCE_OWNER_EMAIL), true);
    assert.equal(isMaintenanceAccessAllowed("student@example.com"), false);
    assert.equal(isMaintenanceAccessAllowed(null), false);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test("maintenance disabled permits normal sign-in", () => {
  const previous = process.env.MAINTENANCE_MODE;
  delete process.env.MAINTENANCE_MODE;
  try {
    assert.equal(isMaintenanceAccessAllowed("student@example.com"), true);
    assert.equal(isMaintenanceAccessAllowed(null), true);
  } finally {
    if (previous !== undefined) process.env.MAINTENANCE_MODE = previous;
  }
});
