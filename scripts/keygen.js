/**
 * Key Generator for WhatsApp Bot Pro
 * Usage: node scripts/keygen.js [numberOfKeys] [daysValid]
 */

const crypto = require('crypto');

// This secret must match exactly with the one in src/license.js
const LICENSE_SECRET = 'WhatsAppBot-Pro-SecretKey-2026-v1';
const EPOCH = new Date('2024-01-01T00:00:00Z').getTime();

function generateKey(daysValid) {
    // 1. Calculate Expiry limit (days since epoch)
    const now = Date.now();
    const expiryDate = now + (daysValid * 24 * 60 * 60 * 1000);
    const daysSinceEpoch = Math.floor((expiryDate - EPOCH) / (1000 * 60 * 60 * 24));

    // Hex encode expiry (4 chars -> max ~179 years)
    const expiryHex = daysSinceEpoch.toString(16).toUpperCase().padStart(4, '0');

    // 2. Generate 2 random bytes (4 hex chars)
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();

    // 3. Payload = Expiry (4) + Random (4)
    const payload = expiryHex + randomHex;

    // 4. Create signature
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
    hmac.update(payload);
    const signature = hmac.digest('hex').toUpperCase().slice(0, 8);

    // Combine into a license key: EEEE-RRRR-SSSS-SSSS
    const full = payload + signature;
    return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}`;
}

const numKeys = parseInt(process.argv[2]) || 1;
const daysValid = parseInt(process.argv[3]) || 365; // Default 1 year

console.log(`\n=== Generating ${numKeys} License Key(s) (Valid for ${daysValid} days) ===\n`);
for (let i = 0; i < numKeys; i++) {
    console.log(`Key ${i + 1}: ${generateKey(daysValid)}`);
}
console.log(`\n=========================================\n`);
