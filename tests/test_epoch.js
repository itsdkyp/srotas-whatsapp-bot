const crypto = require('crypto');
const EPOCH = new Date('2024-01-01T00:00:00Z').getTime();

const daysValid = 365;
const now = Date.now();
const expiryDate = now + (daysValid * 24 * 60 * 60 * 1000);
const daysSinceEpoch = Math.floor((expiryDate - EPOCH) / (1000 * 60 * 60 * 24));
const expiryHex = daysSinceEpoch.toString(16).toUpperCase().padStart(4, '0');

console.log({
    daysValid,
    now,
    EPOCH,
    expiryDate,
    diff: expiryDate - EPOCH,
    daysSinceEpoch,
    expiryHex
});
