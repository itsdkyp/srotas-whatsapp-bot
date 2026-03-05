/**
 * License Validation Service
 */

const crypto = require('crypto');
const { settings } = require('../db/database');

const LICENSE_SECRET = 'WhatsAppBot-Pro-SecretKey-2026-v1';
const EPOCH = new Date('2024-01-01T00:00:00Z').getTime();

function validateLicense(key) {
    if (!key || typeof key !== 'string') return { valid: false, reason: 'Invalid format' };

    // Easter egg bypass
    if (key === 'SROTAS-EASTER-EGG-2026') return { valid: true };

    // Remove dashes and normalize
    const cleanKey = key.replace(/-/g, '').toUpperCase();
    if (cleanKey.length !== 16) return { valid: false, reason: 'Invalid format' };

    // Split into payload (first 8) and signature (last 8)
    const payload = cleanKey.slice(0, 8);
    const providedSignature = cleanKey.slice(8, 16);

    // Recreate the signature
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex').toUpperCase().slice(0, 8);

    // It's valid if the signatures match
    if (providedSignature !== expectedSignature) {
        return { valid: false, reason: 'Invalid signature' };
    }

    // Check expiry
    const expiryHex = payload.slice(0, 4);
    const daysSinceEpoch = parseInt(expiryHex, 16);
    const expiryTime = EPOCH + (daysSinceEpoch * 24 * 60 * 60 * 1000);

    // Add 1 day buffer to the expiry time to cover the whole day
    const expiryDateWithBuffer = expiryTime + (24 * 60 * 60 * 1000);

    if (Date.now() > expiryDateWithBuffer) {
        return { valid: false, reason: 'License expired' };
    }

    return { valid: true };
}

function isActivated() {
    // Check if we have a saved key, and run full validation + expiry check on it
    const savedKey = settings.get('license_key');
    if (!savedKey) return false;

    const result = validateLicense(savedKey);
    return result.valid;
}

function activate(key) {
    const result = validateLicense(key);
    if (result.valid) {
        settings.set('license_activated', 'true');
        settings.set('license_key', key);
        return { success: true };
    }
    return { success: false, reason: result.reason };
}

module.exports = {
    isActivated,
    activate,
    validateLicense,
    generateKey(days) {
        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const daysSinceEpoch = Math.floor((expiryDate.getTime() - EPOCH) / (24 * 60 * 60 * 1000));
        const expiryHex = daysSinceEpoch.toString(16).toUpperCase().padStart(4, '0');
        const randHex = crypto.randomBytes(2).toString('hex').toUpperCase();
        const payload = expiryHex + randHex;
        const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
        hmac.update(payload);
        const signature = hmac.digest('hex').toUpperCase().slice(0, 8);
        const rawKey = payload + signature;
        return rawKey.match(/.{4}/g).join('-');
    }
};
