
const express = require("express");
const router = express.Router();

const supabase = require("../../config/supabase");
const authClient = require("../auth/authClient");

// Clean matric number
function cleanMatricNumber(value) {
    return String(value || "").trim().toUpperCase();
}

// Clean email
function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
}

// Validate matric number
function isValidMatricNumber(matricNumber) {
    return /^202[3-6]\/\d{6}$/.test(matricNumber);
}


// STUDENT REGISTRATION
router.post("/register", async (req, res) => {
    try {
        const matricNumber = cleanMatricNumber(req.body?.matric_number);
        const email = cleanEmail(req.body?.email);

        // Check required registration details
        if (!matricNumber || !email) {
            return res.status(400).json({
                success: false,
                message: "Matric number and email are required."
            });
        }

        if (!isValidMatricNumber(matricNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid matriculation number format."
            });
        }

        // Find student in the existing department roster
        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, auth_user_id, full_name, matric_number, email, level, department")
            .eq("matric_number", matricNumber)
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "This matriculation number is not on the department's student register."
            });
        }

        // Prevent duplicate registration
        if (student.auth_user_id) {
            return res.status(409).json({
                success: false,
                message: "This student has already completed registration. Please log in."
            });
        }

        // Confirm email matches the existing student record
        if (cleanEmail(student.email) !== email) {
            return res.status(400).json({
                success: false,
                message: "The email address does not match the student record."
            });
        }

        // Send email verification code
        const { error: otpError } = await authClient.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true
            }
        });

        if (otpError) throw otpError;

        return res.status(200).json({
            success: true,
            message: "Verification code sent to your email."
        });

    } catch (error) {
        console.error("[REGISTRATION ERROR]", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start registration. Please try again."
        });
    }
});


// VERIFY REGISTRATION OTP
router.post("/verify-otp", async (req, res) => {
    try {
        const matricNumber = cleanMatricNumber(req.body?.matric_number);
        const email = cleanEmail(req.body?.email);
        const token = String(req.body?.token || "").trim();

        if (!matricNumber || !email || !token) {
            return res.status(400).json({
                success: false,
                message: "Matric number, email and verification code are required."
            });
        }

        if (!/^\d{6}$/.test(token)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid six-digit verification code."
            });
        }

        // Find the existing student record
        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, auth_user_id, full_name, matric_number, email, level, department")
            .eq("matric_number", matricNumber)
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student || cleanEmail(student.email) !== email) {
            return res.status(400).json({
                success: false,
                message: "Student registration details could not be verified."
            });
        }

        if (student.auth_user_id) {
            return res.status(409).json({
                success: false,
                message: "This student has already completed registration."
            });
        }

        // Verify OTP
        const { data, error: verifyError } = await authClient.auth.verifyOtp({
            email,
            token,
            type: "email"
        });

        if (verifyError) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code."
            });
        }

        if (!data.user || cleanEmail(data.user.email) !== email) {
            return res.status(400).json({
                success: false,
                message: "Email verification could not be completed."
            });
        }

        // Link verified Auth account to existing student record
        const { data: updatedStudent, error: updateError } = await supabase
            .from("students")
            .update({
                auth_user_id: data.user.id
            })
            .eq("id", student.id)
            .is("auth_user_id", null)
            .select("id, full_name, matric_number, email, level, department")
            .maybeSingle();

        if (updateError) throw updateError;

        if (!updatedStudent) {
            return res.status(409).json({
                success: false,
                message: "This student account has already been registered."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Registration completed successfully.",
            student: updatedStudent
        });

    } catch (error) {
        console.error("[OTP VERIFICATION ERROR]", error);

        return res.status(500).json({
            success: false,
            message: "Unable to complete registration. Please try again."
        });
    }
});


// STUDENT LOGIN
router.post("/login", async (req, res) => {
    try {
        const matricNumber = cleanMatricNumber(req.body?.matric_number);

        if (!matricNumber) {
            return res.status(400).json({
                success: false,
                message: "Matriculation number is required."
            });
        }

        if (!isValidMatricNumber(matricNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid matriculation number format."
            });
        }

        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, auth_user_id, email")
            .eq("matric_number", matricNumber)
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student || !student.auth_user_id) {
            return res.status(403).json({
                success: false,
                message: "You must complete registration before you can log in."
            });
        }

        if (!student.email) {
            return res.status(400).json({
                success: false,
                message: "No registered email address was found."
            });
        }

        const { error: otpError } = await authClient.auth.signInWithOtp({
            email: cleanEmail(student.email),
            options: {
                shouldCreateUser: false
            }
        });

        if (otpError) throw otpError;

        return res.status(200).json({
            success: true,
            message: "Login verification code sent to your registered email."
        });

    } catch (error) {
        console.error("[LOGIN ERROR]", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start login. Please try again."
        });
    }
});


// VERIFY LOGIN OTP
router.post("/verify-login-otp", async (req, res) => {
    try {
        const matricNumber = cleanMatricNumber(req.body?.matric_number);
        const token = String(req.body?.token || "").trim();

        if (!matricNumber || !token) {
            return res.status(400).json({
                success: false,
                message: "Matriculation number and verification code are required."
            });
        }

        if (!isValidMatricNumber(matricNumber) || !/^\d{6}$/.test(token)) {
            return res.status(400).json({
                success: false,
                message: "Invalid matriculation number or verification code."
            });
        }

        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, auth_user_id, full_name, matric_number, email, level, department")
            .eq("matric_number", matricNumber)
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student || !student.auth_user_id) {
            return res.status(403).json({
                success: false,
                message: "You must complete registration before you can log in."
            });
        }

        const { data, error: verifyError } = await authClient.auth.verifyOtp({
            email: cleanEmail(student.email),
            token,
            type: "email"
        });

        if (verifyError) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code."
            });
        }

        if (!data.user || data.user.id !== student.auth_user_id) {
            return res.status(403).json({
                success: false,
                message: "This account does not match the student record."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            session: data.session,
            student: {
                full_name: student.full_name,
                matric_number: student.matric_number,
                email: student.email,
                level: student.level,
                department: student.department
            }
        });

    } catch (error) {
        console.error("[LOGIN OTP ERROR]", error);

        return res.status(500).json({
            success: false,
            message: "Unable to complete login. Please try again."
        });
    }
});

module.exports = router;
