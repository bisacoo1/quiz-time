export function resolveAuthRedirect(url: string, baseUrl: string): string {
  const base = new URL(baseUrl);

  try {
    const target = new URL(url, base);
    return target.origin === base.origin ? target.href : base.href;
  } catch {
    return base.href;
  }
}
