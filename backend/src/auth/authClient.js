


const { createClient } = require("@supabase/supabase-js");

// Check required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase authentication credentials are missing. Check src/.env");
}

// Create Supabase authentication client
const authClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
);

module.exports = authClient;
