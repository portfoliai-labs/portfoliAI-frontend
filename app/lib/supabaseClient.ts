// app/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single browser client for the whole app — Google sign-in (see useAuthFlow.ts)
// and its session are the only things Supabase is used for here.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
