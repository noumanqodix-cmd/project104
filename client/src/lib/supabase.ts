import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Debug logs before initialization
console.log("🔍 [Supabase Init] Starting client setup...");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("🧩 [Supabase Env Check]");
console.log("  VITE_SUPABASE_URL:", supabaseUrl ? "✅ Found" : "❌ Missing");
console.log("  VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Found" : "❌ Missing");

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
console.log("🚀 [Supabase Init] Creating Supabase client...");
console.log("✅ [Supabase Init] Client successfully created!");
console.log("🧾 [Supabase Status]: Initialized ✅");
export { supabase };
