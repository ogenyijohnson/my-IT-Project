
const express = require("express");
const router = express.Router();

const supabase = require("../../config/supabase");
const authClient = require("../auth/authClient");

// Request email verification code
router.post("/register", async (req, res) => {
    try {
        const { full_name, matric_number, email, level } = req.body;

        if (!full_name || !matric_number || !email || !level) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required registration details."
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanMatric = matric_number.trim().toUpperCase();

        // Check whether matric number already exists
        const { data: existingMatric, error: matricError } = await supabase
            .from("students")
            .select("id")
            .eq("matric_number", cleanMatric)
            .limit(1);

        if (matricError) throw matricError;

        if (existingMatric.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This matriculation number is already registered."
            });
        }

        // Check whether email already exists
        const { data: existingEmail, error: emailError } = await supabase
            .from("students")
            .select("id")
            .eq("email", cleanEmail)
            .limit(1);

        if (emailError) throw emailError;

        if (existingEmail.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        // Send email verification code
        const { error } = await authClient.auth.signInWithOtp({
            email: cleanEmail,
            options: {
                shouldCreateUser: true,
                data: {
                    full_name: full_name.trim(),
                    matric_number: cleanMatric,
                    level: level.trim()
                }
            }
        });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: "Verification code sent to your email."
        });

    } catch (error) {
        console.error("[REGISTRATION ERROR]", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to start registration. Please try again."
        });
    }
});


// Verify email code and save student information
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return res.status(400).json({
                success: false,
                message: "Email and verification code are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Verify the email code
        const { data, error } = await authClient.auth.verifyOtp({
            email: cleanEmail,
            token: String(token).trim(),
            type: "email"
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code."
            });
        }

        const user = data.user;
        const details = user?.user_metadata;

        if (
            !user ||
            !details?.full_name ||
            !details?.matric_number ||
            !details?.level
        ) {
            return res.status(400).json({
                success: false,
                message: "Registration details could not be verified."
            });
        }

        // Save verified student information
        const { data: student, error: insertError } = await supabase
            .from("students")
            .insert({
                auth_user_id: user.id,
                full_name: details.full_name,
                matric_number: details.matric_number,
                email: cleanEmail,
                level: details.level
            })
            .select("id, full_name, matric_number, email, level")
            .single();

        if (insertError) throw insertError;

        return res.status(201).json({
            success: true,
            message: "Registration successful.",
            student
        });

    } catch (error) {
        console.error("[OTP VERIFICATION ERROR]", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete registration. Please try again."
        });
    }
});

module.exports = router;
