const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

dotenv.config();

const app = express();

app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});



    
app.get("/api/payment/callback", (req, res) => {
    console.log("M-PESA callback recieved");

    console.log(JSON.stringify(req.body,null,2));

    res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
});


const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

app.post("/api/donate", async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;

        let phone = String(phoneNumber || "").trim().replace(/\s+/g, "");

if (phone.startsWith("+")) {
    phone = phone.slice(1);
}

if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
}

if (!/^254[17]\d{8}$/.test(phone)) {
    return res.status(400).json({
        error: "Enter a valid Kenyan mobile number, e.g. 254712345678."
    });
}

        if (!amount || !phone) {
            return res.status(400).json({
                success: false,
                message: "Amount and phone number are required."
            });
        }
        

        // Get M-PESA access token
        const auth = Buffer.from(
            `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
        ).toString("base64");

        const tokenResponse = await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Create timestamp
        const date = new Date();

        const timestamp =
            date.getFullYear().toString() +
            String(date.getMonth() + 1).padStart(2, "0") +
            String(date.getDate()).padStart(2, "0") +
            String(date.getHours()).padStart(2, "0") +
            String(date.getMinutes()).padStart(2, "0") +
            String(date.getSeconds()).padStart(2, "0");

        // Generate password
        const password = Buffer.from(
            `${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`
        ).toString("base64");

        // Send STK Push
        console.log("SHORTCODE BEING SENT:", process.env.SHORTCODE);

        const stkResponse = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
                
                BusinessShortCode: process.env.SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: Number(amount),
                PartyA: phone,
                PartyB: process.env.SHORTCODE,
                PhoneNumber: phone,
                CallBackURL: process.env.CALLBACK_URL,
                AccountReference: "Donation",
                TransactionDesc: "Invitation Donation"
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json({
            success: true,
            message: "STK Push sent successfully.",
            data: stkResponse.data
        });

    } catch (error) {

        console.error(
            "M-PESA ERROR:",
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            message: "M-PESA request failed.",
            error: error.response?.data || error.message
        });
    }
});