/* ═══════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════ */

let messagesChartInstance = null;
let hourlyChartInstance = null;

// ─── Load Dashboard ───

async function loadDashboard() {
    const dateRange = document.getElementById('dashboardDateRange')?.value || '30days';

    try {
        console.log('[Dashboard] Loading analytics for range:', dateRange);
        const data = await api('GET', `/api/analytics?range=${dateRange}`);
        console.log('[Dashboard] Received data:', data);

        // Update chart title based on range
        updateChartTitle(dateRange);

        // Update stats
        updateStats(data.stats);

        // Update charts
        updateMessagesChart(data.messagesOverTime);
        updateHourlyChart(data.hourlyPattern);

        // Update lists
        updateTopCampaigns(data.topCampaigns);
        updateSessionsSummary(data.sessions);

        // Update AI analytics
        updateAiAnalytics(data.aiAnalytics);

        // Update Quick Reply analytics
        updateQuickReplyAnalytics(data.quickReplyAnalytics);

    } catch (err) {
        console.error('[Dashboard] Failed to load:', err);
        showEmptyDashboard();
    }
}

function updateChartTitle(range) {
    const titleEl = document.getElementById('messagesChartTitle');
    if (!titleEl) return;

    const titles = {
        'today': '📈 Messages Today (Hourly)',
        'yesterday': '📈 Messages Yesterday (Hourly)',
        '7days': '📈 Messages - Last 7 Days',
        '30days': '📈 Messages - Last 30 Days',
        'all': '📈 Messages - Last 12 Weeks'
    };

    titleEl.textContent = titles[range] || '📈 Messages Over Time';
}

// ─── Update Stats Cards ───

function updateStats(stats) {
    document.getElementById('statTotalMessages').textContent = formatNumber(stats.totalMessages);
    document.getElementById('statPeopleReached').textContent = formatNumber(stats.peopleReached);
    document.getElementById('statMediaSent').textContent = formatNumber(stats.mediaSent);
    document.getElementById('statDeliveryRate').textContent = stats.deliveryRate + '%';
}


function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ─── Charts ───

function updateMessagesChart(data) {
    const ctx = document.getElementById('messagesChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (messagesChartInstance) {
        messagesChartInstance.destroy();
    }

    const isDarkTheme = !document.body.classList.contains('light-theme');
    const textColor = isDarkTheme ? '#9ca3af' : '#6b7280';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // Determine tick settings based on data length
    const dataLength = data.labels.length;
    let maxTicksLimit = 12;
    let autoSkip = true;

    if (dataLength === 24) {
        // Hourly (today) - show every 3 hours
        maxTicksLimit = 8;
    } else if (dataLength === 7) {
        // Weekly - show all days
        maxTicksLimit = 7;
        autoSkip = false;
    } else if (dataLength === 30) {
        // Monthly - show ~10 ticks
        maxTicksLimit = 10;
    } else {
        // All time (weeks) - show all
        maxTicksLimit = dataLength;
        autoSkip = false;
    }

    messagesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Sent',
                    data: data.sent,
                    borderColor: '#25d366',
                    backgroundColor: 'rgba(37, 211, 102, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: dataLength <= 12 ? 4 : 2,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Failed',
                    data: data.failed,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: dataLength <= 12 ? 4 : 2,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        display: true,
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: autoSkip,
                        maxTicksLimit: maxTicksLimit
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        precision: 0
                    }
                }
            }
        }
    });
}

function updateHourlyChart(data) {
    const ctx = document.getElementById('hourlyChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    const isDarkTheme = !document.body.classList.contains('light-theme');
    const textColor = isDarkTheme ? '#9ca3af' : '#6b7280';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // Create gradient for bars
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(37, 211, 102, 0.8)');
    gradient.addColorStop(1, 'rgba(37, 211, 102, 0.3)');

    hourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Messages',
                data: data.counts,
                backgroundColor: gradient,
                borderColor: '#25d366',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: (context) => {
                            const hour = parseInt(context[0].label);
                            const period = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour % 12 || 12;
                            return `${displayHour}:00 ${period}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 9
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        precision: 0
                    }
                }
            }
        }
    });
}

// ─── Top Campaigns List ───

function updateTopCampaigns(campaigns) {
    const container = document.getElementById('topCampaignsList');
    if (!container) return;

    console.log('[Dashboard] Updating top campaigns:', campaigns);

    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:12px; opacity:0.3;">📭</div>
                <p>No campaigns yet</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="navigateTo('messaging')">Create Campaign</button>
            </div>
        `;
        return;
    }

    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item" onclick="viewCampaignAnalytics(${c.id})" style="cursor:pointer;">
            <div class="campaign-stats">
                <div class="campaign-count">${c.sent || 0}</div>
                <div class="campaign-label">sent</div>
            </div>
            <div class="campaign-info">
                <div class="campaign-name">${escapeHtml(c.name || 'Unnamed Campaign')}</div>
                <div class="campaign-meta">${formatDate(c.date)}</div>
            </div>
        </div>
    `).join('');
}

// ─── Sessions Summary ───

function updateSessionsSummary(sessions) {
    const container = document.getElementById('sessionsSummary');
    if (!container) return;

    console.log('[Dashboard] Updating sessions summary:', sessions);

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:12px; opacity:0.3;">📱</div>
                <p>No sessions connected</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="navigateTo('sessions')">Add Session</button>
            </div>
        `;
        return;
    }

    container.innerHTML = sessions.map(s => {
        const isConnected = s.status === 'ready';
        const statusText = isConnected ? 'Connected' :
                          s.status === 'qr_pending' ? 'QR Ready' :
                          s.status === 'initializing' ? 'Starting...' :
                          s.status === 'disconnected' ? 'Offline' :
                          s.status === 'error' ? 'Error' :
                          'Unknown';

        return `
            <div class="session-summary-item" onclick="navigateTo('sessions')" title="Click to manage this session">
                <div class="session-summary-icon">📱</div>
                <div class="session-summary-info">
                    <div class="session-summary-name">${escapeHtml(s.name)}</div>
                    <div class="session-summary-phone">${escapeHtml(s.phone || 'Not connected')}</div>
                    <div class="session-summary-status ${isConnected ? 'connected' : ''}">
                        ${isConnected ? '● ' : '○ '}${statusText}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ─── Empty State ───

function showEmptyDashboard() {
    document.getElementById('statTotalMessages').textContent = '0';
    document.getElementById('statPeopleReached').textContent = '0';
    document.getElementById('statMediaSent').textContent = '0';
    document.getElementById('statDeliveryRate').textContent = '0%';

    document.getElementById('topCampaignsList').innerHTML = `
        <div class="empty-dashboard">
            <div class="empty-dashboard-icon">📊</div>
            <p>No data available yet</p>
            <p style="font-size:14px;">Start by creating a campaign to see analytics</p>
        </div>
    `;

    document.getElementById('sessionsSummary').innerHTML = `
        <div class="empty-dashboard">
            <div class="empty-dashboard-icon">📱</div>
            <p>No sessions connected</p>
            <button class="btn btn-primary" onclick="navigateTo('sessions')">Add Session</button>
        </div>
    `;
}

// ─── Helpers ───

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── AI Analytics ───

function updateAiAnalytics(aiData) {
    if (!aiData) {
        aiData = { totalConversations: 0, messagesHandled: 0, avgResponseTime: 0, successRate: 0 };
    }

    document.getElementById('aiTotalConversations').textContent = aiData.totalConversations || 0;
    document.getElementById('aiMessagesHandled').textContent = aiData.messagesHandled || 0;
    document.getElementById('aiAvgResponseTime').textContent = (aiData.avgResponseTime || 0) + 's';
    document.getElementById('aiSuccessRate').textContent = (aiData.successRate || 0) + '%';
}

// ─── Quick Reply Analytics ───

function updateQuickReplyAnalytics(qrData) {
    if (!qrData) {
        qrData = { totalTriggers: 0, uniqueUsers: 0, avgResponseTime: 0, mostUsed: '—' };
    }

    document.getElementById('qrTotalTriggers').textContent = qrData.totalTriggers || 0;
    document.getElementById('qrUniqueUsers').textContent = qrData.uniqueUsers || 0;
    document.getElementById('qrAvgResponseTime').textContent = (qrData.avgResponseTime || 0) + 'ms';
    document.getElementById('qrMostUsed').textContent = qrData.mostUsed || '—';
}

// ─── Campaign Navigation ───

function viewCampaignAnalytics(campaignId) {
    console.log('[Dashboard] Opening campaign analytics:', campaignId);
    // Call the viewCampaign function from messaging.js to open the modal
    if (typeof viewCampaign === 'function') {
        viewCampaign(campaignId);
    } else {
        console.error('[Dashboard] viewCampaign function not found');
        toast('Failed to open campaign analytics', 'error');
    }
}

// ─── Date Range Filter ───

document.addEventListener('DOMContentLoaded', () => {
    const dateFilter = document.getElementById('dashboardDateRange');
    if (dateFilter) {
        dateFilter.addEventListener('change', () => {
            loadDashboard();
        });
    }
});
