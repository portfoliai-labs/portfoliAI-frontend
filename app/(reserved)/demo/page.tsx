// app/(reserved)/demo/page.tsx
"use client";

import { DashboardApp } from "../../components/dashboard/DashboardApp";

/**
 * A separate address for the demo dashboard, used when NEXT_PUBLIC_DEMO_URL=/demo (see
 * lib/demo): for demo accounts only; anyone else is sent back to /dashboard. With the variable
 * unset, demo accounts use /dashboard itself and this route just sends them there.
 */
export default function DemoDashboardPage() {
  return <DashboardApp demo />;
}
