// app/(authenticated)/layout.tsx
"use client";

import { UserProvider } from "../context/UserContext";
import { LegalGate } from "../components/legal/LegalGate";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <LegalGate>{children}</LegalGate>
    </UserProvider>
  );
}