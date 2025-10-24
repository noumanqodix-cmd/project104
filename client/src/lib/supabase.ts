import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Debug logs before initialization
console.log("🔍 [Supabase Init] Starting client setup...");

const supabaseUrl = "https://guvpoifxhpypgrjrejjh.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnBvaWZ4aHB5cGdyanJlampoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDIyODQsImV4cCI6MjA3NTk3ODI4NH0.oI1-jvU-Oioov3fWgxNPy83eSl7VoAbhzO3H5G5AoRo"

console.log("🧩 [Supabase Env Check]");
console.log("  VITE_SUPABASE_URL:", supabaseUrl ? "✅ Found" : "❌ Missing");
console.log("  VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Found" : "❌ Missing");

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
console.log("🚀 [Supabase Init] Creating Supabase client...");
console.log("✅ [Supabase Init] Client successfully created!");
console.log("🧾 [Supabase Status]: Initialized ✅");
export { supabase };
