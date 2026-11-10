export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidAuthEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
