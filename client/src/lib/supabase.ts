import { createClient } from "@supabase/supabase-js";

// Debug logs before initialization
console.log("🔍 [Supabase Init] Starting client setup...");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("🧩 [Supabase Env Check]");
console.log("  VITE_SUPABASE_URL:", supabaseUrl ? "✅ Found" : "❌ Missing");
console.log("  VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Found" : "❌ Missing");

let supabase = null;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ [Supabase Warning] Missing environment variables. Check your .env file and Vite config.");
  } else {
    console.log("🚀 [Supabase Init] Creating Supabase client...");
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ [Supabase Init] Client successfully created!");
  }
} catch (error) {
  console.error("❌ [Supabase Error] Failed to initialize client:", error);
}

console.log("🧾 [Supabase Status]:", supabase ? "Initialized ✅" : "Not initialized ❌");

export { supabase };
