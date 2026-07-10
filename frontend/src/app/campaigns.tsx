'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, getGroups, getTemplates, sendBulkMessages, uploadMedia, getCampaigns, getCampaign, retryCampaign, restartCampaign, deleteCampaign, getContacts, getSettings, generateCampaignImage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/components/providers/socket-provider';
import { toast } from 'sonner';
import {
    Upload, X, Loader2, CheckCircle, Plus, BarChart3,
    RefreshCw, Trash2, RotateCcw, Rocket, ArrowLeft, Clock, Users, Megaphone, Smartphone, FileText, Sparkles, Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const safeFormatDate = (dateStr: any): string => {
    if (!dateStr) return '—';
    try {
        let cleanStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
        if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
            cleanStr += 'Z';
        }
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) {
            const d2 = new Date(dateStr);
            return isNaN(d2.getTime()) ? '—' : d2.toLocaleString();
        }
        return d.toLocaleString();
    } catch {
        return '—';
    }
};

const safeFormatTime = (dateStr: any): string => {
    if (!dateStr) return '—';
    try {
        let cleanStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
        if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
            cleanStr += 'Z';
        }
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) {
            const d2 = new Date(dateStr);
            return isNaN(d2.getTime()) ? '—' : d2.toLocaleTimeString();
        }
        return d.toLocaleTimeString();
    } catch {
        return '—';
    }
};

export function Campaigns() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [allSessions, setAllSessions] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [campaignHistory, setCampaignHistory] = useState<any[]>([]);

    const [view, setView] = useState<'history' | 'new'>('history');

    const [selectedSession, setSelectedSession] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [message, setMessage] = useState('');
    const [minDelay, setMinDelay] = useState(8000);
    const [maxDelay, setMaxDelay] = useState(18000);
    const [files, setFiles] = useState<File[]>([]);
    const [templateMediaUrls, setTemplateMediaUrls] = useState<string[]>([]);
    const [buttons, setButtons] = useState<{ label: string, response: string }[]>([]);
    const [geminiKeySet, setGeminiKeySet] = useState(false);
    const [generatingImage, setGeneratingImage] = useState(false);

    const getTemplateMediaUrls = (t: any): string[] => {
        if (!t) return [];
        let rawUrls: string[] = [];
        if (Array.isArray(t.media_paths)) rawUrls = t.media_paths;
        else if (typeof t.media_paths === 'string' && t.media_paths.trim()) {
            try {
                const parsed = JSON.parse(t.media_paths);
                if (Array.isArray(parsed)) rawUrls = parsed;
                else if (typeof parsed === 'string') rawUrls = [parsed];
            } catch (e) {
                rawUrls = [t.media_paths];
            }
        } else if (typeof t.media_path === 'string' && t.media_path.trim()) {
            rawUrls = [t.media_path];
        }
        return rawUrls.map(url => {
            if (!url || typeof url !== 'string') return '';
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
            const filename = url.split(/[/\\]/).pop();
            if (!filename) return '';
            return `/api/media/file/${filename}`;
        }).filter(Boolean);
    };

    const [previewContact, setPreviewContact] = useState<any>(null);

    // Unified progress state — used for both progress modal and analytics "live" view
    const [sending, setSending] = useState(false);
    const [progressStats, setProgressStats] = useState({ total: 0, sent: 0, failed: 0 });
    const [progressLogs, setProgressLogs] = useState<string[]>([]);
    const [progressModalOpen, setProgressModalOpen] = useState(false);

    // Analytics modal
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    // Track if the currently-viewed analytics campaign is the live/running one
    const [liveAnalyticsCampaignId, setLiveAnalyticsCampaignId] = useState<number | null>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | File | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const { socket } = useSocket();

    const loadData = () => {
        Promise.all([getSessions(), getGroups(), getTemplates(), getCampaigns()])
            .then(([s, g, t, c]) => {
                setSessions(s.filter((x: any) => x.status === 'ready'));
                setAllSessions(s);
                setGroups(g);
                setTemplates(t);
                setCampaignHistory(c.sort((a: any, b: any) => b.id - a.id));
                const readySessions = s.filter((x: any) => x.status === 'ready');
                if (readySessions.length > 0 && !selectedSession) setSelectedSession(readySessions[0].id.toString());
                if (g.length > 0 && !selectedGroup) setSelectedGroup(g[0].name);
            })
            .catch(console.error);
    };

    useEffect(() => {
        loadData();
        getSettings().then(s => setGeminiKeySet(!!s.gemini_api_key)).catch(() => setGeminiKeySet(false));
    }, []);

    useEffect(() => {
        if (selectedGroup) {
            getContacts(selectedGroup).then(c => {
                const list = Array.isArray(c) ? c : (c.contacts || []);
                if (list.length > 0) setPreviewContact(list[0]);
                else setPreviewContact(null);
            }).catch(() => setPreviewContact(null));
        } else {
            setPreviewContact(null);
        }
    }, [selectedGroup]);

    useEffect(() => {
        const handleTour = (e: any) => {
            const step = e.detail;
            if (step === 'messaging') {
                setView('new');
                setAnalyticsOpen(false);
            } else if (step === 'messaging-analytics') {
                setView('history');
                openAnalytics(1); // Open demo campaign ID 1
            } else {
                setAnalyticsOpen(false);
            }
        };
        window.addEventListener('tour-step', handleTour);
        return () => window.removeEventListener('tour-step', handleTour);
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('bulk:progress', (data: any) => {
            setProgressStats({ total: data.total, sent: data.sent, failed: data.failed });
            const logMsg = `Sent to ${data.lastPhone} (${data.lastStatus})`;
            setProgressLogs(prev => [`[${new Date().toLocaleTimeString()}] ${logMsg}`, ...prev].slice(0, 50));
        });

        socket.on('bulk:complete', (data: any) => {
            setSending(false);
            toast.success(`Campaign completed! Sent: ${data.sent}, Failed: ${data.failed}`);
            setLiveAnalyticsCampaignId(null);
            loadData();
            // Refresh analytics modal if it's the live campaign
            if (liveAnalyticsCampaignId) {
                getCampaign(liveAnalyticsCampaignId.toString()).then(setSelectedCampaign).catch(console.error);
            }
        });

        socket.on('bulk:error', (data: any) => {
            toast.error(`Campaign error: ${data.error}`);
            setSending(false);
            setLiveAnalyticsCampaignId(null);
        });

        return () => {
            socket.off('bulk:progress');
            socket.off('bulk:complete');
            socket.off('bulk:error');
        };
    }, [socket, liveAnalyticsCampaignId]);

    const handleTemplateSelect = (id: string) => {
        setSelectedTemplate(id);
        if (!id || id === 'none') {
            setMessage('');
            setTemplateMediaUrls([]);
            return;
        }
        const t = templates.find(x => x.id.toString() === id);
        if (t) {
            setMessage(t.content);
            try { setButtons(t.buttons_config ? JSON.parse(t.buttons_config) : []); } catch { setButtons([]); }
            setTemplateMediaUrls(getTemplateMediaUrls(t));
        } else {
            setTemplateMediaUrls([]);
        }
    };

    const insertTagAtCursor = (tag: string) => {
        const textarea = messageInputRef.current;
        if (!textarea) {
            setMessage(prev => prev + ` {{${tag}}} `);
            return;
        }
        const start = textarea.selectionStart ?? message.length;
        const end = textarea.selectionEnd ?? message.length;
        const text = message || '';
        const before = text.substring(0, start);
        const after = text.substring(end);

        const placeholder = `{{${tag}}}`;
        const leadingSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
        const trailingSpace = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n') && !/^[.,!?;:)]/.test(after) ? ' ' : '';
        const insertion = `${leadingSpace}${placeholder}${trailingSpace}`;

        const newText = `${before}${insertion}${after}`;
        setMessage(newText);

        setTimeout(() => {
            textarea.focus();
            const newPos = start + insertion.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            if (files.length + newFiles.length > 10) return toast.error('Maximum 10 files allowed');
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleGenerateImage = async () => {
        if (!message.trim()) return toast.error('Write the campaign message first — the image is generated from it');
        if (files.length >= 10) return toast.error('Maximum 10 files allowed');
        setGeneratingImage(true);
        try {
            const res = await generateCampaignImage(message);
            const byteChars = atob(res.image);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const ext = (res.mimetype || 'image/png').split('/')[1] || 'png';
            const file = new File([bytes], `ai-image-${Date.now()}.${ext}`, { type: res.mimetype || 'image/png' });
            // Put first so it becomes the captioned media in the campaign
            setFiles(prev => [file, ...prev]);
            toast.success('Image generated — check the preview');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate image');
        } finally {
            setGeneratingImage(false);
        }
    };

    const startSending = async (launchFn: () => Promise<any>, campaignIdForAnalytics?: number) => {
        setSending(true);
        setProgressModalOpen(true);
        setProgressStats({ total: 0, sent: 0, failed: 0 });
        setProgressLogs(['Starting campaign...']);
        if (campaignIdForAnalytics) setLiveAnalyticsCampaignId(campaignIdForAnalytics);

        try {
            await launchFn();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to start campaign');
            setSending(false);
            setProgressModalOpen(false);
            setLiveAnalyticsCampaignId(null);
        }
    };

    const handleSend = async () => {
        if (!selectedSession) return toast.error('Select a WhatsApp session');
        if (!selectedGroup) return toast.error('Select a target group');
        if (!message.trim() && files.length === 0 && templateMediaUrls.length === 0) return toast.error('Message or media is required');

        await startSending(async () => {
            let uploadedPaths: string[] = [];
            if (files.length > 0) {
                setProgressLogs(prev => ['Uploading media...', ...prev]);
                const formData = new FormData();
                files.forEach(f => formData.append('media', f));
                const res = await uploadMedia(formData);
                uploadedPaths = res.files.map((f: any) => f.path);
            }
            await sendBulkMessages({
                sessionId: selectedSession,
                group: selectedGroup,
                template: message,
                minDelay, maxDelay,
                mediaPaths: uploadedPaths.length > 0 ? uploadedPaths : (templateMediaUrls.length > 0 ? templateMediaUrls : null),
                buttons: buttons.length > 0 ? buttons : null,
                name: campaignName.trim() || undefined
            });

            // Reset form
            setMessage('');
            setFiles([]);
            setTemplateMediaUrls([]);
            setCampaignName('');
            setSelectedTemplate('');
        });
    };

    const openAnalytics = async (id: number) => {
        try {
            const data = await getCampaign(id.toString());
            setSelectedCampaign(data);
            if (data?.session_id) setSelectedSession(data.session_id.toString());
            setAnalyticsOpen(true);
        } catch { toast.error('Failed to load campaign data'); }
    };

    const handleRetry = async (id: number) => {
        if (!selectedSession) return toast.error('Please select a session first');
        if (!confirm('Retry all failed messages in this campaign?')) return;
        setAnalyticsOpen(false);
        setProgressLogs(['Retrying failed messages...']);
        await startSending(() => retryCampaign(id.toString(), selectedSession), id);
    };

    const handleRestart = async (id: number) => {
        if (!selectedSession) return toast.error('Please select a session first');
        if (!confirm('Restart this campaign to the entire group?')) return;
        setAnalyticsOpen(false);
        setProgressLogs(['Restarting campaign...']);
        await startSending(() => restartCampaign(id.toString(), selectedSession), id);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this campaign from history?')) return;
        try {
            await deleteCampaign(id.toString());
            toast.success('Campaign deleted');
            loadData();
            if (selectedCampaign?.id === id) setAnalyticsOpen(false);
        } catch { toast.error('Failed to delete campaign'); }
    };

    const statusStyle = (status: string) =>
        status === 'completed' ? 'badge-success' :
            status === 'running' ? 'badge-blue' :
                'badge-warning';

    const isLiveRunning = sending && liveAnalyticsCampaignId === selectedCampaign?.id;

    // ─── History View ─────────────────────────────────────────────────────────
    const HistoryView = () => (
        <motion.div
            key="history"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25, ease }}
            className="space-y-5"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Campaigns</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track analytics and manage previous sends</p>
                </div>
                <Button onClick={() => setView('new')} className="btn-primary-glow gap-2">
                    <Plus className="w-4 h-4" /> New Campaign
                </Button>
            </div>

            {/* Live progress banner when a campaign is running */}
            <AnimatePresence>
                {sending && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-primary/30 bg-primary/5"
                    >
                        <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Campaign running in background</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="text-emerald-500">{progressStats.sent} sent</span>
                                <span className="text-red-400">{progressStats.failed} failed</span>
                                <span>{progressStats.total ? `of ${progressStats.total}` : '...'}</span>
                            </div>
                        </div>
                        <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
                                animate={{ width: `${progressStats.total ? ((progressStats.sent + progressStats.failed) / progressStats.total) * 100 : 0}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setProgressModalOpen(true)} className="flex-shrink-0 text-xs">
                            View
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {campaignHistory.length === 0 ? (
                <Card className="card-glass" style={{ border: '1px dashed var(--border)' }}>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                            <Megaphone className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>No campaigns yet</h3>
                        <p className="text-sm text-muted-foreground mb-6">Create your first bulk message campaign.</p>
                        <Button onClick={() => setView('new')} className="btn-primary-glow gap-2">
                            <Plus className="w-4 h-4" /> New Campaign
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {campaignHistory.map((c, i) => {
                        const total = c.total || 0;
                        const sent = c.sent || 0;
                        const failed = c.failed || 0;
                        const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                        const isRunning = c.status === 'running' || (sending && liveAnalyticsCampaignId === c.id);
                        const sessionName = allSessions.find(s => s.id === c.session_id)?.name || c.session_id || 'Unknown Device';

                        return (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.04 * i, duration: 0.3, ease }}
                            >
                                <Card className="card-glow overflow-hidden">
                                    <div className="h-0.5" style={{
                                        background: isRunning
                                            ? 'linear-gradient(90deg,#3b82f6,#06b6d4,transparent)'
                                            : c.status === 'completed'
                                                ? 'linear-gradient(90deg,#10b981,transparent)'
                                                : 'linear-gradient(90deg,#f59e0b,transparent)'
                                    }} />
                                    <CardContent className="p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-base font-semibold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                                        {c.name || `Campaign #${c.id}`}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${statusStyle(isRunning ? 'running' : c.status)}`}>
                                                        {isRunning ? (
                                                            <span className="flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />
                                                                running
                                                            </span>
                                                        ) : c.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.group_name || '—'}</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {safeFormatDate(c.started_at)}</span>
                                                    <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> {sessionName}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-5 flex-shrink-0">
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-emerald-500">
                                                        {isRunning ? progressStats.sent : sent}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">Sent</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-red-500">
                                                        {isRunning ? progressStats.failed : failed}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">Failed</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-primary">{pct}%</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">Rate</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <div className="w-24 hidden md:block">
                                                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
                                                            animate={{
                                                                width: isRunning
                                                                    ? `${progressStats.total ? ((progressStats.sent + progressStats.failed) / progressStats.total) * 100 : 0}%`
                                                                    : `${pct}%`
                                                            }}
                                                            transition={{ duration: 0.4 }}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openAnalytics(c.id)}
                                                    className="gap-1.5 text-xs h-8 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-semibold border border-blue-500/30 rounded-lg shadow-sm transition-all"
                                                >
                                                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Analytics
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );

    // ─── New Campaign View ────────────────────────────────────────────────────
    const NewCampaignView = () => (
        <motion.div
            key="new"
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease }}
            className="space-y-6"
        >
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setView('history')} className="gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>New Campaign</h1>
                    <p className="text-sm text-muted-foreground">Configure and launch your bulk message</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-5">
                    <Card className="card-glow">
                        <div className="h-0.5" style={{ background: 'linear-gradient(90deg,#3b82f6,transparent)' }} />
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Audience & Sender</CardTitle>
                            <CardDescription className="text-xs">Select target group and sending session.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Campaign Name</Label>
                                <Input placeholder="e.g. Summer Promo" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="bg-secondary/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Device Name</Label>
                                <Select value={selectedSession} onValueChange={(v) => setSelectedSession(v || '')}>
                                    <SelectTrigger className="bg-secondary/50">
                                        <span className="truncate">
                                            {selectedSession ? (allSessions.find(s => s.id.toString() === selectedSession)?.name || sessions.find(s => s.id.toString() === selectedSession)?.name || selectedSession) : "Select device"}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allSessions.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name || s.id} ({s.phone || s.status})</SelectItem>)}
                                        {allSessions.length === 0 && <SelectItem value="none" disabled>No ready devices</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Send To (Group)</Label>
                                <Select value={selectedGroup} onValueChange={(v) => setSelectedGroup(v || '')}>
                                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select group" /></SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-glow">
                        <div className="h-0.5" style={{ background: 'linear-gradient(90deg,#f59e0b,transparent)' }} />
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-400" /> Sending Delay</CardTitle>
                            <CardDescription className="text-xs">Randomize delays to avoid bans.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Min (ms)</Label>
                                    <Input type="number" value={minDelay} onChange={e => setMinDelay(parseInt(e.target.value))} className="bg-secondary/50" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Max (ms)</Label>
                                    <Input type="number" value={maxDelay} onChange={e => setMaxDelay(parseInt(e.target.value))} className="bg-secondary/50" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 bg-secondary/40 p-2 rounded-lg">Sweet spot: 8000ms to 18000ms</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-5">
                    <Card className="card-glow">
                        <div className="h-0.5" style={{ background: 'linear-gradient(90deg,#8b5cf6,transparent)' }} />
                        <CardHeader className="pb-3">
                            <div>
                                <CardTitle className="text-sm">Message Content</CardTitle>
                                <CardDescription className="text-xs">Write your message from scratch or select a saved template.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {templates.length > 0 && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/40 dark:bg-secondary/20 border border-border/80 shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-lg bg-primary/15 text-primary">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold tracking-wide text-foreground">Load Saved Template</h4>
                                            <p className="text-[11px] text-muted-foreground">Quickly populate message and attachments</p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-[250px] shrink-0">
                                        <Select value={selectedTemplate} onValueChange={(v) => handleTemplateSelect(v || '')}>
                                            <SelectTrigger className="h-9 text-xs font-medium bg-background dark:bg-card border border-border/90 hover:border-primary/60 shadow-sm transition-all text-foreground">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <span className="truncate">
                                                        {selectedTemplate && selectedTemplate !== 'none'
                                                            ? (templates.find(t => t.id.toString() === selectedTemplate)?.name || selectedTemplate)
                                                            : "Load Template..."}
                                                    </span>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="font-medium text-muted-foreground">✨ Write from scratch</SelectItem>
                                                {templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id.toString()} className="font-medium">
                                                        {t.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message Body</Label>
                                <Textarea ref={messageInputRef} rows={7} placeholder="Hello {{name}}, welcome to {{company}}!" value={message}
                                    onChange={e => setMessage(e.target.value)} className="resize-y bg-secondary/30 border-border/60" />
                                <div className="flex gap-2 flex-wrap pt-1">
                                    <span className="text-xs text-muted-foreground self-center">Placeholders:</span>
                                    {['name', 'phone', 'company'].map(tag => (
                                        <Button key={tag} type="button" variant="secondary" size="sm" className="h-6 text-xs px-2"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => insertTagAtCursor(tag)}>
                                            {`{{${tag}}}`}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border/40 pt-5">
                                {/* Message Preview */}
                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                        Message Preview
                                    </Label>
                                    <div className="bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-xl border border-border/50 h-[300px] overflow-y-auto flex flex-col gap-2"
                                        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundBlendMode: 'overlay' }}>

                                        <div className="mt-auto"></div>

                                        {/* First bubble: First file + Text */}
                                        {(files.length > 0 || templateMediaUrls.length > 0 || message) && (
                                            <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative flex flex-col gap-1.5">
                                                {(files.length > 0 || templateMediaUrls.length > 0) && (
                                                    <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                                        {files.length > 0 ? (
                                                            files[0].type.startsWith('image/') ? (
                                                                <div className="relative cursor-pointer group/img" onClick={() => setPreviewFile(files[0])}>
                                                                    <img src={URL.createObjectURL(files[0])} alt="preview" className="w-full h-auto object-cover max-h-[200px] rounded-md hover:opacity-90 transition-opacity" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                                                                        <Eye className="w-4 h-4" /> Click to view
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-secondary/40 rounded-md">
                                                                    <FileText className="w-4 h-4" /> {files[0].name}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="relative cursor-pointer group/img" onClick={() => setPreviewFile({ url: templateMediaUrls[0], name: 'Attached Template Image' })}>
                                                                <img src={templateMediaUrls[0]} alt="preview" className="w-full h-auto object-cover max-h-[200px] rounded-md hover:opacity-90 transition-opacity" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                                                                    <Eye className="w-4 h-4" /> Click to view
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {message && (
                                                    <p className="text-sm whitespace-pre-wrap break-words text-[#111b21] dark:text-[#e9edef] px-1" style={{ wordBreak: 'break-word' }}>
                                                        {message.replace(/\{\{name\}\}/gi, previewContact?.name || 'John Doe')
                                                            .replace(/\{\{phone\}\}/gi, previewContact?.phone ? `+${previewContact.phone}` : '+91 98765 43210')
                                                            .replace(/\{\{company\}\}/gi, previewContact?.company || 'Acme Corp')}
                                                    </p>
                                                )}
                                                <div className="text-[10px] text-muted-foreground text-right opacity-70 mt-0.5 px-1">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                                                </div>
                                            </div>
                                        )}
                                        {!message && files.length === 0 && templateMediaUrls.length === 0 && (
                                            <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                                <span className="text-muted-foreground italic text-sm px-1">Type a message...</span>
                                            </div>
                                        )}

                                        {/* Subsequent bubbles: Remaining files */}
                                        {files.slice(1).map((f, i) => (
                                            <div key={i} className="bg-white dark:bg-[#005c4b] p-1.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                                <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                                    {f.type.startsWith('image/') ? (
                                                        <div className="relative cursor-pointer group/img" onClick={() => setPreviewFile(f)}>
                                                            <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-auto object-cover max-h-[200px] rounded-md hover:opacity-90 transition-opacity" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                                                                <Eye className="w-4 h-4" /> Click to view
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-secondary/40 rounded-md">
                                                            <FileText className="w-4 h-4" /> {f.name}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground text-right opacity-70 mt-0.5 px-1">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="flex justify-between items-center text-xs uppercase tracking-wider text-muted-foreground">
                                        <span>Media Attachments</span><span>{files.length || templateMediaUrls.length}/10</span>
                                    </Label>
                                    <div onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border/50 rounded-xl p-5 text-center cursor-pointer hover:bg-secondary/30 hover:border-primary/40 transition-all bg-secondary/10">
                                        <Upload className="w-7 h-7 mx-auto mb-2 text-primary/60" />
                                        <span className="text-sm font-medium">Click to browse files</span>
                                        <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, PDF, MP3, MP4</p>
                                    </div>
                                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange}
                                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" />
                                    {geminiKeySet && (
                                        <Button
                                            variant="outline"
                                            onClick={handleGenerateImage}
                                            disabled={generatingImage || !message.trim()}
                                            className="w-full gap-2 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                                        >
                                            {generatingImage
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating image…</>
                                                : <><Sparkles className="w-4 h-4" /> Generate Image with AI</>}
                                        </Button>
                                    )}
                                    {(files.length > 0 || templateMediaUrls.length > 0) && (
                                        <div className="space-y-1.5">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-secondary/40 rounded-lg text-xs border border-border/40 group">
                                                    <div className="flex items-center gap-1.5 truncate pr-2 min-w-0">
                                                        {file.type.startsWith('image/') ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewFile(file)}
                                                                className="flex items-center gap-1.5 truncate text-left hover:text-primary transition-colors cursor-pointer"
                                                            >
                                                                <Eye className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 text-primary" />
                                                                <span className="truncate font-medium">{file.name}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="truncate font-medium flex items-center gap-1.5">
                                                                <FileText className="w-3 h-3 flex-shrink-0 opacity-60" />
                                                                {file.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                                        className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive flex-shrink-0">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {files.length === 0 && templateMediaUrls.map((mediaUrl, idx) => (
                                                <div key={`template-media-${idx}`} className="flex items-center justify-between p-2 bg-secondary/40 rounded-lg text-xs border border-border/40 group">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewFile({ url: mediaUrl, name: 'Attached Template Image' })}
                                                        className="flex items-center gap-1.5 truncate text-left hover:text-primary transition-colors cursor-pointer w-full"
                                                    >
                                                        <Eye className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 text-primary" />
                                                        <span className="truncate font-medium">Saved Template Image</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setView('history')}>Cancel</Button>
                        <Button onClick={handleSend} disabled={sending} className="btn-primary-glow gap-2 min-w-[160px]">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            {sending ? 'Sending...' : 'Launch Campaign'}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto w-full">
            <AnimatePresence mode="wait">
                {view === 'history' ? HistoryView() : NewCampaignView()}
            </AnimatePresence>

            {/* ─── Progress Modal (background run) ─────────────────────── */}
            {/* Only one close button — use showCloseButton={false} on DialogContent */}
            <Dialog open={progressModalOpen} onOpenChange={setProgressModalOpen}>
                <DialogContent className="sm:max-w-lg card-glass" showCloseButton={false}>
                    <div className="flex items-center gap-3 mb-5">
                        {sending
                            ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            : <CheckCircle className="w-5 h-5 text-emerald-500" />
                        }
                        <div className="flex-1">
                            <h3 className="font-semibold">{sending ? 'Campaign Running' : 'Campaign Completed'}</h3>
                            <p className="text-xs text-muted-foreground">{sending ? 'You can minimize this and it will run in the background.' : 'All messages have been processed.'}</p>
                        </div>
                        <button
                            onClick={() => setProgressModalOpen(false)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                <span>Progress</span>
                                <span>{progressStats.sent + progressStats.failed} / {progressStats.total || '?'}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <motion.div className="h-full rounded-full"
                                    style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
                                    animate={{ width: `${progressStats.total ? ((progressStats.sent + progressStats.failed) / progressStats.total) * 100 : 0}%` }}
                                    transition={{ duration: 0.3 }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-xl text-center">
                                <div className="text-2xl font-bold">{progressStats.sent}</div>
                                <div className="text-xs font-medium uppercase tracking-wider mt-1">Sent</div>
                            </div>
                            <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-center">
                                <div className="text-2xl font-bold">{progressStats.failed}</div>
                                <div className="text-xs font-medium uppercase tracking-wider mt-1">Failed</div>
                            </div>
                        </div>
                        <div className="bg-secondary/40 rounded-xl p-3 h-40 overflow-y-auto font-mono text-xs border border-border/50">
                            {progressLogs.map((log, i) => (
                                <div key={i} className="mb-1 text-muted-foreground">{log}</div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        {sending ? (
                            <Button variant="outline" onClick={() => setProgressModalOpen(false)} className="flex-1">
                                Run in Background
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setProgressModalOpen(false)} className="flex-1">Close</Button>
                                <Button onClick={() => {
                                    setProgressModalOpen(false);
                                    setMessage(''); setFiles([]); setButtons([]); setCampaignName(''); setSelectedTemplate('');
                                    setView('new');
                                }} className="flex-1 btn-primary-glow">New Campaign</Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Analytics Modal ──────────────────────────────────────── */}
            {/* showCloseButton={false} — we render our own close in the header */}
            <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col card-glass p-0" showCloseButton={false}>
                    {selectedCampaign && (
                        <>
                            {/* Header — one row, one close button */}
                            <div className="flex items-start justify-between p-6 border-b border-border/50 flex-shrink-0">
                                <div>
                                    <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                        {selectedCampaign.name || `Campaign #${selectedCampaign.id}`}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {safeFormatDate(selectedCampaign.started_at)} · {selectedCampaign.group_name} · {allSessions.find(s => s.id === selectedCampaign.session_id)?.name || selectedCampaign.session_id || 'Unknown Device'}
                                        {isLiveRunning && (
                                            <span className="ml-2 inline-flex items-center gap-1 text-primary">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                                                Live
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                    {!isLiveRunning && (
                                        <>
                                            <div className="w-44">
                                                <Select value={selectedSession} onValueChange={(v) => setSelectedSession(v || '')}>
                                                    <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/60">
                                                        <span className="truncate">
                                                            {selectedSession ? (allSessions.find(s => s.id.toString() === selectedSession)?.name || sessions.find(s => s.id.toString() === selectedSession)?.name || selectedSession) : "Select device to send"}
                                                        </span>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {allSessions.map(s => (
                                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                                {s.name || s.id} ({s.phone || s.status})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleRetry(selectedCampaign.id)}
                                                className="gap-1.5 text-xs h-8 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-semibold border border-amber-500/30 rounded-lg shadow-sm transition-all"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 text-amber-400" /> Retry Failed
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleRestart(selectedCampaign.id)}
                                                className="gap-1.5 text-xs h-8 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 font-semibold border border-purple-500/30 rounded-lg shadow-sm transition-all"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 text-purple-400" /> Restart
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedCampaign.id)}
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <div className="w-px h-5 bg-border/50" />
                                        </>
                                    )}
                                    {/* Single close button */}
                                    <button
                                        onClick={() => setAnalyticsOpen(false)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Live progress bar (only when running) */}
                            <AnimatePresence>
                                {isLiveRunning && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        className="px-6 py-3 border-b border-border/50 bg-primary/5 flex-shrink-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="flex justify-between text-xs mb-1.5">
                                                    <span className="text-primary font-medium">Running...</span>
                                                    <span className="text-muted-foreground">{progressStats.sent + progressStats.failed} / {progressStats.total || '?'}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                                    <motion.div className="h-full rounded-full"
                                                        style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
                                                        animate={{ width: `${progressStats.total ? ((progressStats.sent + progressStats.failed) / progressStats.total) * 100 : 0}%` }}
                                                        transition={{ duration: 0.3 }} />
                                                </div>
                                            </div>
                                            <div className="flex gap-4 ml-2 flex-shrink-0 text-xs">
                                                <span className="text-emerald-500 font-semibold">{progressStats.sent} sent</span>
                                                <span className="text-red-400 font-semibold">{progressStats.failed} fail</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Total', value: isLiveRunning ? (progressStats.total || selectedCampaign.total) : selectedCampaign.total, color: 'text-foreground', bg: 'bg-secondary/40' },
                                        { label: 'Sent', value: isLiveRunning ? progressStats.sent : selectedCampaign.sent, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                        { label: 'Failed', value: isLiveRunning ? progressStats.failed : selectedCampaign.failed, color: 'text-red-500', bg: 'bg-red-500/10' },
                                        {
                                            label: 'Rate',
                                            value: (() => {
                                                const t = isLiveRunning ? progressStats.total : selectedCampaign.total;
                                                const s = isLiveRunning ? progressStats.sent : selectedCampaign.sent;
                                                return t > 0 ? `${Math.round((s / t) * 100)}%` : '0%';
                                            })(),
                                            color: 'text-primary', bg: 'bg-primary/10'
                                        },
                                    ].map(stat => (
                                        <div key={stat.label} className={`${stat.bg} rounded-xl p-4 text-center`}>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</div>
                                            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Live log (only when running) */}
                                {isLiveRunning && (
                                    <div className="bg-secondary/40 rounded-xl p-3 h-36 overflow-y-auto font-mono text-xs border border-border/50">
                                        {progressLogs.map((log, i) => <div key={i} className="mb-1 text-muted-foreground">{log}</div>)}
                                    </div>
                                )}

                                {/* Error Breakdown */}
                                {!isLiveRunning && selectedCampaign.errorBreakdown?.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold">Error Breakdown</h3>
                                        <div className="space-y-1.5">
                                            {selectedCampaign.errorBreakdown.map((errObj: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center p-2.5 bg-red-500/10 text-red-400 rounded-lg">
                                                    <span className="truncate pr-4 text-xs">{errObj.error}</span>
                                                    <span className="font-bold text-xs flex-shrink-0">{errObj.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Message Log (only for completed campaigns) */}
                                {!isLiveRunning && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold">Message Log</h3>
                                        <div className="rounded-xl overflow-hidden border border-border/50">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-secondary/30">
                                                        <TableHead className="text-xs">Phone</TableHead>
                                                        <TableHead className="text-xs">Name</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                        <TableHead className="text-xs">Time</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCampaign.messages?.map((m: any) => (
                                                        <TableRow key={m.id}>
                                                            <TableCell className="font-mono text-xs">{m.contact_phone}</TableCell>
                                                            <TableCell className="text-xs">{m.contact_name}</TableCell>
                                                            <TableCell>
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.status === 'sent' ? 'badge-success' : 'badge-destructive'}`}>
                                                                    {m.status}
                                                                </span>
                                                                {m.error_message && <p className="text-[10px] text-red-400 mt-0.5 max-w-[180px] truncate">{m.error_message}</p>}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{safeFormatTime(m.sent_at || m.created_at || selectedCampaign?.started_at)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ─── Image Preview Lightbox ───────────────────────────────── */}
            {!!previewFile && (
                <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
                    <DialogPortal>
                        <DialogOverlay />
                        <div
                            className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl overflow-hidden rounded-xl border border-border shadow-2xl"
                            style={{ background: 'var(--card)', backdropFilter: 'blur(12px)' }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
                                <span className="text-sm text-foreground font-medium truncate max-w-[80%]">
                                    {previewFile instanceof File ? previewFile.name : (previewFile as any).name}
                                </span>
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Image */}
                            <div className="flex items-center justify-center bg-secondary/20" style={{ minHeight: '50vh', maxHeight: '85vh', overflow: 'hidden' }}>
                                <img
                                    src={previewFile instanceof File ? URL.createObjectURL(previewFile) : (previewFile as any).url}
                                    alt={previewFile instanceof File ? previewFile.name : (previewFile as any).name}
                                    style={{ maxHeight: '85vh', width: '100%', objectFit: 'contain' }}
                                />
                            </div>
                        </div>
                    </DialogPortal>
                </Dialog>
            )}
        </div>
    );
}
