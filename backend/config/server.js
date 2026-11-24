
// Load environment variables
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

// Import required packages
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Import database and authentication routes
const supabase = require("./supabase");
const authRoutes = require("../src/routes/authRoutes");

// Create Express application
const app = express();

const PORT = process.env.PORT || 5000;

// Display debug messages
function debug(message, data = "") {
    if (process.env.DEBUG === "true") {
        console.log("[DEBUG]", message, data);
    }
}

// Apply security headers
app.use(helmet());

// Configure frontend access
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

// Read JSON request data
app.use(express.json({ limit: "10kb" }));

// Limit repeated API requests
app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false
}));

// Connect authentication routes
app.use("/api/auth", authRoutes);

// Test backend and database connection
app.get("/api/health", async (req, res) => {
    try {
        debug("Checking database connection");

        const { data, error } = await supabase
            .from("elections")
            .select("id, status")
            .eq("id", 1)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({
            success: true,
            message: "Election backend and database are connected.",
            database: "connected",
            electionStatus: data.status
        });

    } catch (err) {
        console.error("[DATABASE ERROR]", err.message);

        res.status(503).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// Handle unknown API requests
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// Handle unexpected errors
app.use((err, req, res, next) => {
    console.error("[SERVER ERROR]", err.message);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

// Start backend server
app.listen(PORT, "127.0.0.1", () => {
    console.log(`Election backend running on port ${PORT}`);
    debug("Debugging is enabled");
});
