"use client";

import { GoogleOAuthProvider } from '@react-oauth/google';
import HomePage from './homepage/page';

export default function Home() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <HomePage />
    </GoogleOAuthProvider>
  );
}