// Load environment variables before initializing Supabase clients.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const supabase = require("./supabase");
const authRoutes = require("../src/routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const frontendDirectory = path.join(__dirname, "../../frontend");

function debug(message, data = "") {
    if (process.env.DEBUG === "true") {
        console.log("[DEBUG]", message, data);
    }
}

app.use(helmet());

// The frontend is served by this same server, so API requests are same-origin.
// Keep CORS available for an explicitly configured separate frontend origin.
const corsOptions = { credentials: true };
if (process.env.CLIENT_URL) corsOptions.origin = process.env.CLIENT_URL;
app.use(cors(corsOptions));

app.use(express.json({ limit: "10kb" }));
app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false
}));

// Serve static frontend files (including index.html and images).
app.use(express.static(frontendDirectory));

app.use("/api/auth", authRoutes);

app.get("/api/health", async (req, res) => {
    try {
        debug("Checking database connection");
        const { data, error } = await supabase
            .from("elections")
            .select("id, status")
            .eq("id", 1)
            .single();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: "Election backend and database are connected.",
            database: "connected",
            electionStatus: data.status
        });
    } catch (error) {
        console.error("[DATABASE ERROR]", error.message);
        return res.status(503).json({
            success: false,
            message: "Database connection failed. Check the Supabase configuration and elections table."
        });
    }
});

app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found." });
});

app.use((err, req, res, next) => {
    console.error("[SERVER ERROR]", err.message);
    res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Election backend and frontend running on port ${PORT}`);
    debug("Debugging is enabled");
});
