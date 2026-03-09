// ─── Admin Panel — License Key Generator ───
// This panel is only revealed when the easter egg activation key is active.

(function () {
    let selectedDays = null;

    // ── Duration preset buttons ──
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#durationPresets .btn');
        if (!btn) return;
        selectedDays = parseInt(btn.dataset.days);
        // Highlight selected preset
        document.querySelectorAll('#durationPresets .btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        const customInput = document.getElementById('adminCustomDays');
        if (customInput) customInput.value = '';
    });

    // ── Generate button ──
    const generateBtn = document.getElementById('adminGenerateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const customInput = document.getElementById('adminCustomDays');
            const days = parseInt(customInput?.value) || selectedDays;
            if (!days || days < 1) {
                toast('Select a duration or enter custom days first.', 'error');
                return;
            }
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating…';
            try {
                const data = await api('POST', '/api/admin/generate-key', { days });
                const keyOutput = document.getElementById('adminKeyOutput');
                const keyValue = document.getElementById('adminKeyValue');
                const keyMeta = document.getElementById('adminKeyMeta');
                if (keyOutput && keyValue) {
                    keyValue.value = data.key;
                    keyMeta.textContent = `✅ Valid for ${days} day${days !== 1 ? 's' : ''} · Expires on ${new Date(data.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        }`;
                    keyOutput.style.display = 'block';
                    keyOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                renderHistory();
            } catch (err) {
                toast(err.message || 'Failed to generate key', 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '⚡ Generate Key';
            }
        });
    }

    // ── Copy button ──
    const copyBtn = document.getElementById('adminCopyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const keyValue = document.getElementById('adminKeyValue');
            if (!keyValue?.value) return;
            navigator.clipboard.writeText(keyValue.value).then(() => {
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
            });
        });
    }

    // ── Refresh history button ──
    const refreshBtn = document.getElementById('adminRefreshHistoryBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderHistory);

    // ── Render history table ──
    async function renderHistory() {
        const tbody = document.getElementById('adminHistoryBody');
        if (!tbody) return;
        try {
            const history = await api('GET', '/api/admin/history');
            if (!history.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No keys generated yet</td></tr>';
                return;
            }
            tbody.innerHTML = history.map((r, i) => `
                <tr style="border-top:1px solid var(--border-color);">
                    <td style="padding:10px 8px; font-family:monospace; font-size:12px; letter-spacing:1px;">${r.key}</td>
                    <td style="padding:10px 8px; text-align:center; color:var(--text-muted);">${r.days}d</td>
                    <td style="padding:10px 8px; text-align:center;">${new Date(r.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style="padding:10px 8px; text-align:center; color:var(--text-muted); font-size:12px;">${new Date(r.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style="padding:10px 8px; text-align:center;">
                        <button class="btn" style="font-size:11px; padding:4px 8px;" onclick="navigator.clipboard.writeText('${r.key}').then(()=>toast('Copied!','success'))">📋</button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--danger);">Failed to load history</td></tr>';
        }
    }

    // Load history when admin page is navigated to
    const origNavigateTo = window.navigateTo;
    if (origNavigateTo) {
        window.addEventListener('adminPageActive', renderHistory);
    }

    // Override navigateTo to fire event when admin page opened
    const _origNav = window.navigateTo;
    if (_origNav) {
        window.navigateTo = function (page) {
            _origNav(page);
            if (page === 'admin') renderHistory();
        };
    }
})();
