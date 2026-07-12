const path = require('path');

/**
 * Parse a CSV or Excel file and return raw rows plus auto-detected column
 * mapping suggestions, for the frontend to preview/confirm before import.
 * Note: xlsx is lazy-loaded to avoid 2.5 MB startup cost — only loaded when actually importing.
 */
function parseFile(filePath) {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
        return { columns: [], rows: [], detected: {}, suggestedKeys: {}, sampleRow: null, totalRows: 0 };
    }

    const columns = Object.keys(rows[0]);

    const phoneCol = findColumn(columns, ['phone', 'mobile', 'number', 'whatsapp', 'tel', 'contact']);
    const nameCol = findColumn(columns, ['name', 'fullname', 'full_name', 'first_name', 'firstname']);
    const companyCol = findColumn(columns, ['company', 'organization', 'org', 'business', 'firm']);

    const suggestedKeys = {};
    for (const col of columns) suggestedKeys[col] = slugify(col);

    return {
        columns,
        rows,
        detected: { phone: phoneCol, name: nameCol, company: companyCol },
        suggestedKeys,
        sampleRow: rows[0],
        totalRows: rows.length,
    };
}

/**
 * Build final {phone, name, company, custom_fields} contact rows from raw
 * parsed rows using a caller-confirmed column mapping:
 *   mapping = { phone: 'Phone Number', name: 'Full Name', company: 'Company Name',
 *               customFields: { 'Deal Value': 'deal_value', 'City': 'city' } }
 * customFields keys are the original column headers; values are the
 * placeholder-safe keys to store them under (and use as {{placeholder}}).
 */
function buildContacts(rows, mapping) {
    const { phone: phoneCol, name: nameCol, company: companyCol, customFields = {} } = mapping || {};

    return rows.map((row) => {
        const phone = normalizePhone(String(row[phoneCol] || ''));
        const name = nameCol ? String(row[nameCol] || '') : '';
        const company = companyCol ? String(row[companyCol] || '') : '';

        const custom_fields = {};
        for (const [col, key] of Object.entries(customFields)) {
            const finalKey = slugify(key) || slugify(col);
            if (!finalKey) continue;
            custom_fields[finalKey] = String(row[col] || '');
        }

        return { phone, name, company, custom_fields };
    }).filter(c => c.phone);
}

function findColumn(columns, candidates) {
    for (const col of columns) {
        const lower = col.toLowerCase().replace(/[^a-z]/g, '');
        for (const c of candidates) {
            if (lower.includes(c)) return col;
        }
    }
    return columns[0]; // fallback to first column
}

// Turn a CSV header into a placeholder-safe key, e.g. "Deal Value" -> "deal_value"
function slugify(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizePhone(phone) {
    const raw = String(phone || '').trim();
    // Preserve WhatsApp JID formats untouched (e.g. re-importing an export that has them)
    if (/@(g\.us|c\.us|s\.whatsapp\.net)$/i.test(raw)) return raw;

    // Digits only — the rest of the app stores phones digit-only and adds the
    // display "+" itself (see contacts.tsx `+{c.phone}`), so a stray "+" or
    // formatting here would just end up baked into a broken displayed number.
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    // Bare 10-digit Indian mobile number with no country code — assume +91,
    // same heuristic already used when resolving numbers from WhatsApp itself
    // (see extractPhoneFromJid in sessionManager.js). Without this, these rows
    // were silently importing as invalid numbers missing their country code.
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
        digits = '91' + digits;
    }
    return digits;
}

module.exports = { parseFile, buildContacts, slugify };
