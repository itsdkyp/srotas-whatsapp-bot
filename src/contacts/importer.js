const XLSX = require('xlsx');
const path = require('path');

/**
 * Parse a CSV or Excel file and return standardized contact rows.
 * Auto-detects phone, name, and company columns.
 */
function parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) return { contacts: [], columns: [] };

    const columns = Object.keys(rawRows[0]);

    // Auto-detect known columns
    const phoneCol = findColumn(columns, ['phone', 'mobile', 'number', 'whatsapp', 'tel', 'contact']);
    const nameCol = findColumn(columns, ['name', 'fullname', 'full_name', 'first_name', 'firstname']);
    const companyCol = findColumn(columns, ['company', 'organization', 'org', 'business', 'firm']);

    const contacts = rawRows.map((row) => {
        const phone = normalizePhone(String(row[phoneCol] || ''));
        const name = String(row[nameCol] || '');
        const company = String(row[companyCol] || '');

        // Collect remaining columns as custom fields
        const custom_fields = {};
        for (const col of columns) {
            if (col !== phoneCol && col !== nameCol && col !== companyCol) {
                custom_fields[col] = String(row[col] || '');
            }
        }

        return { phone, name, company, custom_fields };
    }).filter(c => c.phone); // remove rows without phone

    return {
        contacts,
        columns,
        detected: { phone: phoneCol, name: nameCol, company: companyCol },
        totalRows: rawRows.length,
    };
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

function normalizePhone(phone) {
    // Strip spaces, parens, but preserve @g.us / @c.us formats.
    let cleaned = phone.replace(/[^\d@\.\-a-zA-Z\+]/gi, '');
    return cleaned;
}

module.exports = { parseFile };
