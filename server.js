const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const razorpay = new Razorpay({
    key_id: "rzp_test_XXXXXXXXXXXX",      // your Key ID
    key_secret: "rzp_test_YYYYYYYYYYYY"   // your Key Secret
});

// create order
app.post("/create-order", async (req, res) => {
    const { credits, userId } = req.body;
    const amount = credits * 100; // ₹1 per credit -> 50 credits = 5000 paise

    try {
        const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `credits_${userId}_${Date.now()}`,
            payment_capture: 1
        });
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// verify payment
app.post("/verify-payment", (req, res) => {
    // minimal demo: trust Razorpay auto capture
    res.json({ success: true });
});

app.listen(3000, () => console.log("Server running on port 3000"));
