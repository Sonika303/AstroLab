// backend.js
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
require("dotenv").config(); // optional, for secrets

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ⚡ Configure Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_S7fa84e8duHqi0",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "2B4lLm13SzoGzPIKzG2wrB1d",
});

// ===== CREATE ORDER =====
app.post("/create-order", async (req, res) => {
    const { credits, userId } = req.body;
    if (!credits || !userId) return res.status(400).json({ error: "Missing fields" });

    const amount = credits * 100; // ₹1 = 100 paise

    try {
        const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `credits_${userId}_${Date.now()}`,
            payment_capture: 1,
        });
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Order creation failed" });
    }
});

// ===== VERIFY PAYMENT =====
app.post("/verify-payment", (req, res) => {
    const { payment, credits, userId } = req.body;
    if (!payment || !credits || !userId) return res.status(400).json({ success: false });

    const crypto = require("crypto");
    const generatedSignature = crypto.createHmac("sha256", razorpay.key_secret)
        .update(payment.razorpay_order_id + "|" + payment.razorpay_payment_id)
        .digest("hex");

    if (generatedSignature === payment.razorpay_signature) {
        // 🔥 Payment verified, add credits to Firebase
        const admin = require("firebase-admin");
        const serviceAccount = require("./firebaseServiceAccount.json"); // download from Firebase console

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://astrolab-b8956-default-rtdb.firebaseio.com"
            });
        }

        const db = admin.database();
        db.ref(`presence/${userId}/credits`).transaction(c => (c || 0) + credits)
            .then(() => res.json({ success: true }))
            .catch(() => res.json({ success: false }));
    } else {
        res.json({ success: false });
    }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
