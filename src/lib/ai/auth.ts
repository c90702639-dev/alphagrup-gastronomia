import crypto from "node:crypto";

export const PORTAL_COOKIE = "ga_portal";

export function portalPassword(): string {
  return (import.meta.env.PORTAL_PASSWORD as string) || "alpha2026";
}

export function portalToken(): string {
  return crypto
    .createHash("sha256")
    .update(`${portalPassword()}::grupo-alpha-portal`)
    .digest("hex")
    .slice(0, 32);
}

export function isAuthed(
  cookies: { get: (k: string) => { value: string } | undefined },
): boolean {
  return cookies.get(PORTAL_COOKIE)?.value === portalToken();
}
