const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();

// 1. GLOBAL MIDDLEWARES
app.use(cors());
app.use(express.json()); // Essential for parsing incoming M-Pesa Callback payloads
app.use(express.urlencoded({ extended: true }));

// 2. PRODUCTION DIRECTORY SETUP FOR COMPRESSED ASSETS
const STORAGE_DIR = path.join(__dirname, 'secure_storage');
const TEMP_DIR = path.join(__dirname, 'temp_upload_hold');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// 3. MULTER CONFIGURATION FOR DYNAMIC FOLDER SCANNING
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        // Sanitizes directory slashes so nested folder structures don't break the local OS filesystem
        cb(null, Date.now() + '_' + file.originalname.replace(/\//g, '_'));
    }
});
const upload = multer({ storage });

// 4. IN-MEMORY PRODUCTION DATABASE INSTANCES
let productCatalogDatabase = [];
let liveMpesaTransactions = {};

// ==========================================
// 📂 ROUTE A: ADMIN PANEL FOLDER COMPRESSION & UPLOAD HOOK
// ==========================================
app.post('/api/v1/admin/upload', upload.array('assets'), (req, res) => {
    console.log("📥 Admin initiated a raw folder architectural upload sequence...");
    
    try {
        const { title, physics, price, felt } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No source files detected in upload stream." });
        }

        const productId = 'KP_PROD_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const secureZipName = `KAPLANCE-${title.toUpperCase().replace(/\s+/g, '-')}-${productId}.zip`;
        const finalZipPath = path.join(STORAGE_DIR, secureZipName);

        // Initiate archiving pipeline streams
        const outputStream = fs.createWriteStream(finalZipPath);
        const zipArchive = archiver('zip', { zlib: { level: 9 } }); // Max compression level

        outputStream.on('close', () => {
            console.log(`📦 Compression finished successfully. Total bytes: ${zipArchive.pointer()}`);
            
            // Clean out the temporary upload holding folder to save Railway container disk space
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });

            // Inject the formal structured product into our live server registry
            const freshAssetRecord = {
                id: productId,
                title: title,
                physics_engine: physics,
                felt_layout: felt,
                price: parseInt(price),
                download_vault_path: finalZipPath,
                created_at: new Date()
            };

            productCatalogDatabase.push(freshAssetRecord);
            console.log(`✨ Product "${title}" is now officially live on Kaplance Digital!`);
            
            return res.status(200).json({ success: true, message: "Asset folder packaged and pushed live." });
        });

        zipArchive.on('error', (err) => { throw err; });
        
        zipArchive.pipe(outputStream);
        
        // Loop through all uploaded files and append them to the zip bundle structure
        req.files.forEach(file => {
            zipArchive.file(file.path, { name: file.originalname });
        });
        
        zipArchive.finalize();

    } catch (error) {
        console.error("❌ Admin panel compilation crash error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server archiving breakdown." });
    }
});

// ==========================================
// 🛒 ROUTE B: PUBLIC STOREFRONT ACTIVE CATALOG FETCH HOOK
// ==========================================
app.get('/api/v1/products', (req, res) => {
    // Serves the live dynamic inventory array to index.html
    res.status(200).json(productCatalogDatabase);
});


// ==========================================
// 📲 REPLACED ROUTE C: INITIALIZE PRODUCTION M-PESA STK PUSH (MIGRATED)
// ==========================================
app.post('/api/v1/payment/stk-push', async (req, res) => {
    const { productId, phone, price } = req.body;
    console.log(`🔌 Production STK push triggered for ${phone} | KES ${price}`);

    try {
        // 1. Fetch live Production Access Token using your global helper function
        const token = await getMpesaToken();
        
        // 2. 🟢 PRODUCTION VARIABLE ALIGNMENT: Read variables cleanly from Railway Dashboard
        const shortCode = process.env.MPESA_SHORTCODE; 
        const passkey = process.env.MPESA_PASSKEY;
        const callbackUrl = process.env.CALLBACK_URL; // e.g. https://your-app.url

        if (!shortCode || !passkey || !callbackUrl) {
            console.error("❌ CRITICAL: Missing production environment variables (MPESA_SHORTCODE, MPESA_PASSKEY, or CALLBACK_URL).");
            return res.status(500).json({ success: false, message: "Server configuration environment error." });
        }
        
        // 3. Clean Inline Timestamp Generation (YYYYMMDDHHmmss)
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

        
        // 4. 🟢 PRODUCTION PAYLOAD: Changed to live gateway specification layouts
        const stkPayload = {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", // 💡 Switch to "CustomerBuyGoodsOnline" if utilizing a Till Number
            Amount: Math.floor(Number(price)), 
            PartyA: phone,            
            PartyB: shortCode,
            PhoneNumber: phone,       
            CallBackURL: callbackUrl,
            AccountReference: "MERLIN_VS",
            TransactionDesc: "Combat Stake"
        };

        // 5. 🟢 PRODUCTION GATEWAY CONNECTION: Routed out directly to Safaricom's live endpoint
        const stkResponse = await axios.post(
            'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', 
            stkPayload, 
            { 
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/json'
                } 
            }
        );

        // 6. Case-Sensitive Checkout Identifier Capture
        const checkoutRequestId = stkResponse.data.CheckoutRequestID || stkResponse.data.checkoutRequestId;
        
        if (!checkoutRequestId) {
            return res.status(400).json({ success: false, message: "Missing Checkout ID from Safaricom response configuration." });
        }

        // Cache the transaction session securely inside your in-memory array database
        liveMpesaTransactions[checkoutRequestId] = {
            productId: productId,
            phoneNumber: phone,
            amountExpected: Math.floor(Number(price)),
            state: "PENDING",
            activationCode: null
        };

        console.log(`[STK Push Status] Production Success for ${phone} | ID: ${checkoutRequestId}`);
        return res.status(200).json({ success: true, checkoutRequestId });

    } catch (error) {
        console.error("❌ PRODUCTION ROUTE CRASH ERROR:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Safaricom production gateway validation error."
        });
    }
});

// ==========================================
// 🔐 GLOBAL PRODUCTION M-PESA TOKEN GENERATOR HOOK
// ==========================================
async function getMpesaToken() {
    // 🟢 PRODUCTION VARIABLE ALIGNMENT: Pulled dynamically from your secure Railway dashboard variables
    const consumer_key = process.env.MPESA_CONSUMER_KEY;
    const consumer_secret = process.env.MPESA_CONSUMER_SECRET;
    
    // 🟢 PRODUCTION GATEWAY: Routed directly to Safaricom's live authentication gateway
    const url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    if (!consumer_key || !consumer_secret) {
        throw new Error("CRITICAL CONFIG ERROR: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET inside Railway environment variables.");
    }

    // Standard string addition auth structure to bypass template limits
    const auth = "Basic " + Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

    try {
        const response = await axios.get(url, {
            headers: { 
                "Authorization": auth,
                "User-Agent": "Mozilla/5.0"
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("❌ PRODUCTION TOKEN GENERATION FAILED:", error.response ? error.response.data : error.message);
        throw error;
    }
}

// ==========================================
// 📥 ROUTE D: THE CRITICAL SECURE M-PESA WEBHOOK CALLBACK RECEIVER
// ==========================================
app.post('/api/v1/payment/callback', (req, res) => {
    console.log("📥 Incoming Safaricom Daraja cryptographic payment payload received...");
    
    try {
        const bodyData = req.body.Body;
        if (!bodyData || !bodyData.stkCallback) {
            return res.status(400).json({ success: false, message: "Malformed callback data signature dropped." });
        }

        const callbackPayload = bodyData.stkCallback;
        const incomingCheckoutId = callbackPayload.CheckoutRequestID;
        const numericResultCode = callbackPayload.ResultCode;

        // Safaricom ResultCode 0 strictly dictates user successfully entered PIN and funds shifted
        if (numericResultCode === 0) {
            const analyticalMetaItems = callbackPayload.CallbackMetadata.Item;
            let validatedCashAmount = 0;
            let safaricomReceiptId = "MPESA_REF_ERR";

            analyticalMetaItems.forEach(element => {
                if (element.Name === "Amount") validatedCashAmount = element.Value;
                if (element.Name === "MpesaReceiptNumber") safaricomReceiptId = element.Value;
            });

            // Crosscheck if this payment correlates with a registered pending user click session
            if (liveMpesaTransactions[incomingCheckoutId]) {
                const transactionalSession = liveMpesaTransactions[incomingCheckoutId];
                
                // Construct the functional unblur activation token code
                const operationalActivationKey = `MD-${safaricomReceiptId.substring(0, 4)}-${safaricomReceiptId.substring(4, 8)}-POOL`;
                
                transactionalSession.state = "COMPLETED";
                transactionalSession.activationCode = operationalActivationKey;

                console.log(`✅ [Payment Cleared] Transaction ID: ${safaricomReceiptId} confirmed KES ${validatedCashAmount}.`);
            }
        } else {
            // Client canceled prompt, entered an incorrect PIN, or timed out on their phone
            if (liveMpesaTransactions[incomingCheckoutId]) {
                liveMpesaTransactions[incomingCheckoutId].state = "FAILED";
            }
            console.warn(`❌ M-Pesa request session ${incomingCheckoutId} declined by phone handler with code ${numericResultCode}`);
        }

        // Standard operational validation requirement: Always acknowledge receipt back to Safaricom systems
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback structured metadata cataloged." });

    } catch (runtimeFault) {
        console.error("⚠️ CRITICAL FAULT within Webhook Parser logic:", runtimeFault.message);
        return res.status(500).json({ ResultCode: 1, ResultDesc: "Server processing bottleneck event." });
    }
});

// ==========================================
// 🔍 ROUTE E: FRONTEND LONG-POLLING LIVE PAYMENT STATE TRACKER
// ==========================================
app.get('/api/v1/payment/status/:checkoutRequestId', (req, res) => {
    const paymentStatusInstance = liveMpesaTransactions[req.params.checkoutRequestId];
    if (!paymentStatusInstance) {
        return res.status(404).json({ message: "Requested transaction instance key not active inside database registers." });
    }
    return res.status(200).json(paymentStatusInstance);
});
 
// ==========================================
// 🚀 DYNAMIC PORT BINDING AND SERVER BOOT
// ==========================================
const HOST_PORT = process.env.PORT || 8080;
app.listen(HOST_PORT, '0.0.0.0', () => {
    console.log(`🚀 Production Server actively engine-routing on Port ${HOST_PORT} (Host interface: 0.0.0.0)`);
});
