// app/(authenticated)/layout.tsx
"use client";

import { UserProvider } from "../context/UserContext";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      {children}
    </UserProvider>
  );
}