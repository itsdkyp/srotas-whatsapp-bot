/* ═══════════════════════════════════════
   Help Page
   ═══════════════════════════════════════ */

const downloadSampleCsvBtn = document.getElementById('downloadSampleCsvBtn');

function loadHelpPage() {
    // Page is static HTML, nothing to load
}

// ─── Accordion Toggle ───

function toggleHelp(header) {
    const item = header.parentElement;
    const content = item.querySelector('.help-content');
    const toggle = item.querySelector('.help-toggle');
    const isOpen = item.classList.contains('open');

    if (isOpen) {
        item.classList.remove('open');
        content.style.maxHeight = '0';
        toggle.textContent = '▼';
    } else {
        item.classList.add('open');
        content.style.maxHeight = content.scrollHeight + 'px';
        toggle.textContent = '▲';
    }
}

// ─── Download Sample CSV ───

downloadSampleCsvBtn.addEventListener('click', () => {
    // Create sample CSV data with all possible fields
    const headers = ['phone', 'name', 'company', 'email', 'city', 'product', 'designation', 'website', 'notes'];
    const sampleData = [
        ['+919876543210', 'John Doe', 'Acme Corp', 'john@acme.com', 'Mumbai', 'Premium Plan', 'CEO', 'https://acme.com', 'VIP customer'],
        ['+919876543211', 'Jane Smith', 'Tech Solutions', 'jane@techsol.com', 'Delhi', 'Standard Plan', 'CTO', 'https://techsol.com', 'Interested in enterprise'],
        ['+919876543212', 'Bob Johnson', 'Global Industries', 'bob@global.com', 'Bangalore', 'Enterprise Plan', 'Manager', 'https://global.com', 'Renewal due next month'],
        ['+919876543213', 'Alice Williams', 'StartUp Inc', 'alice@startup.com', 'Pune', 'Basic Plan', 'Founder', 'https://startup.com', 'New customer'],
        ['+919876543214', 'Charlie Brown', 'Consulting Group', 'charlie@consulting.com', 'Chennai', 'Professional Plan', 'Director', 'https://consulting.com', 'Requires support'],
    ];

    // Build CSV content
    const csvRows = [];
    csvRows.push(headers.join(','));
    for (const row of sampleData) {
        csvRows.push(row.map(field => `"${field}"`).join(','));
    }
    const csvContent = csvRows.join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_sample.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast('Sample CSV downloaded — edit it with your contacts and import', 'success');
});
