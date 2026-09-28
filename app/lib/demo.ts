// lib/demo.ts
//
// DEMO ACCOUNTS — accounts on the DEMO subscription tier (`subscription_tier` on the profile),
// used to show the product (on staging) without letting anyone change it. A demo account:
// - gets the regular dashboard plus the previews of what's coming (components/preview), which
//   no other account sees, at NEXT_PUBLIC_DEMO_URL: /dashboard itself when it isn't set, else
//   another path (the /demo route is there for that) or a full URL, where /dashboard sends it.
//   /demo sends everyone else back to /dashboard;
// - is read-only: apiFetch refuses every request that would change something (see
//   `isBlockedForDemo`), and the pages disable the controls that would send one.
// This is the frontend's half only: the backend must refuse a demo account's writes too, since
// anything in the browser can be bypassed.

import type { UserProfile } from "../models/User";

/** Where a demo account's dashboard lives: a path in this app, or a full URL elsewhere. */
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || "/dashboard";

export const DEMO_READ_ONLY_MESSAGE = "This is a demo account: changes are disabled.";

export const isDemoUser = (user: Pick<UserProfile, "subscription_tier"> | null | undefined) => user?.subscription_tier === "DEMO";

/**
 * Where a demo account must go to reach its dashboard from `pathname`, or null when it's already
 * there — DEMO_URL may well be this very page (e.g. "/dashboard", or a full URL of it).
 * `query` (?section=…) is carried over to a path in this app.
 */
export function demoRedirect(pathname: string, query: string): { url: string; external: boolean } | null {
  const target = new URL(DEMO_URL, window.location.origin);
  if (target.origin !== window.location.origin) return { url: target.href, external: true };
  if (target.pathname === pathname) return null;
  return { url: `${target.pathname}${target.search || query}`, external: false };
}

// Set by UserContext once it knows who's signed in; read by apiFetch on every request.
let readOnly = false;
export const setDemoReadOnly = (value: boolean) => {
  readOnly = value;
};

// Writes a demo account can't do without: accepting the legal documents (LegalGate won't let
// anyone past without it). The notification stream's ticket isn't here: useNotifications never
// asks for one on a demo account.
const ALLOWED_WRITES: { method: string; path: RegExp }[] = [
  { method: "POST", path: /^\/v1\/legal\/acceptances$/ },
];

/** Whether apiFetch must refuse this request because a demo account is signed in. */
export function isBlockedForDemo(endpoint: string, method = "GET") {
  const m = method.toUpperCase();
  if (!readOnly || m === "GET" || m === "HEAD") return false;
  const path = endpoint.split("?")[0];
  return !ALLOWED_WRITES.some((w) => w.method === m && w.path.test(path));
}
