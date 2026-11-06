import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client — ONLY ever import this from Server Actions / Route
// Handlers ("use server" files). Never expose SUPABASE_SERVICE_ROLE_KEY to
// the client bundle (it is not NEXT_PUBLIC_-prefixed, so Next.js will not
// inline it into client code, but double-check before importing this from
// anything that isn't already server-only).
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
