
// Import Supabase
const { createClient } = require("@supabase/supabase-js");

// Check required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase credentials are missing. Check src/.env");
}

// Create the private Supabase connection
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
);

// Make Supabase available to other backend files
module.exports = supabase;
