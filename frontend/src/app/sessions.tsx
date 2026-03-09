'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getSessions, addSession, deleteSession, restartSession, relinkSession, setAutoReply, setAiReplies, setQuickReplies } from '@/lib/api';
import { useSocket } from '@/components/providers/socket-provider';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, RefreshCw, Link2, Plus, Smartphone, Zap, Brain, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function Sessions() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

    const { socket } = useSocket();
    const activeQrSession = useRef<string | null>(null);

    useEffect(() => { fetchSessions(); }, []);

    useEffect(() => {
        if (!socket) return;
        const handleQr = async (data: any) => {
            if (activeQrSession.current === data.sessionId) { setQrCodeDataUrl(data.qr); setQrModalOpen(true); }
            fetchSessions();
        };
        const handleReady = (data: any) => {
            if (activeQrSession.current === data.sessionId) { setQrModalOpen(false); activeQrSession.current = null; toast.success('Session connected!'); }
            fetchSessions();
        };
        const handleDisconnect = () => fetchSessions();

        socket.on('session:qr', handleQr);
        socket.on('session:ready', handleReady);
        socket.on('session:disconnected', handleDisconnect);
        socket.on('session:auth_failure', handleDisconnect);
        return () => {
            socket.off('session:qr', handleQr);
            socket.off('session:ready', handleReady);
            socket.off('session:disconnected', handleDisconnect);
            socket.off('session:auth_failure', handleDisconnect);
        };
    }, [socket]);

    const fetchSessions = async () => {
        setLoading(true);
        try { setSessions(await getSessions()); }
        catch { toast.error('Failed to load sessions'); }
        finally { setLoading(false); }
    };

    const handleCreateSession = async () => {
        if (!newSessionName.trim()) return toast.error('Device name is required');
        try {
            const res = await addSession(newSessionName);
            setNewSessionName(''); setIsAddModalOpen(false);
            activeQrSession.current = res.sessionId;
            setQrCodeDataUrl(null); setQrModalOpen(true);
            fetchSessions();
        } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to create session'); }
    };

    const handleRelink = async (id: string) => { try { await relinkSession(id); activeQrSession.current = id; setQrCodeDataUrl(null); setQrModalOpen(true); } catch { toast.error('Failed to relink'); } };
    const handleRestart = async (id: string) => { try { await restartSession(id); toast.success('Restart initiated'); } catch { toast.error('Failed to restart'); } };
    const handleDelete = async (id: string) => { if (!confirm('Delete this session?')) return; try { await deleteSession(id); toast.success('Deleted'); fetchSessions(); } catch { toast.error('Failed to delete'); } };

    const toggleAutoReply = async (id: string, v: boolean) => { try { await setAutoReply(id, v); setSessions(p => p.map(s => s.id === id ? { ...s, auto_reply: v } : s)); } catch { toast.error('Failed to update'); } };
    const toggleAiReplies = async (id: string, v: boolean) => { try { await setAiReplies(id, v); setSessions(p => p.map(s => s.id === id ? { ...s, ai_replies: v } : s)); } catch { toast.error('Failed to update'); } };
    const toggleQuickReplies = async (id: string, v: boolean) => { try { await setQuickReplies(id, v); setSessions(p => p.map(s => s.id === id ? { ...s, quick_replies: v } : s)); } catch { toast.error('Failed to update'); } };

    const statusColor = (st: string) =>
        st === 'ready' ? 'badge-success' : st === 'disconnected' ? 'badge-destructive' : 'badge-warning';
    const dotColor = (st: string) =>
        st === 'ready' ? 'bg-emerald-500' : st === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500';

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
                className="flex justify-between items-center"
            >
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>WhatsApp Devices</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage your connected WhatsApp accounts</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 btn-primary-glow">
                    <Plus className="w-4 h-4" /> Add Account
                </Button>
            </motion.div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
            ) : sessions.length === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease }}>
                    <Card className="flex flex-col items-center justify-center p-14 text-center card-glass" style={{ border: '1px dashed var(--border)' }}>
                        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                            <Smartphone className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>No devices found</h3>
                        <p className="text-sm text-muted-foreground mb-6">Connect your first WhatsApp account to get started.</p>
                        <Button onClick={() => setIsAddModalOpen(true)} className="btn-primary-glow">Add Account</Button>
                    </Card>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {sessions.map((session, i) => (
                        <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i, duration: 0.35, ease }}
                        >
                            <Card className="card-glow overflow-hidden flex flex-col h-full">
                                {/* Card header strip */}
                                <CardHeader className="pb-4 pt-5"
                                    style={{ background: session.status === 'ready' ? 'rgba(16,185,129,0.05)' : session.status === 'disconnected' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)' }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                                {session.status === 'ready' && (
                                                    <span className="relative flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor(session.status)}`} />
                                                    </span>
                                                )}
                                                {session.status !== 'ready' && <span className={`h-2.5 w-2.5 rounded-full ${dotColor(session.status)}`} />}
                                                {session.name}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {session.phone ? `+${session.phone}` : 'No number linked'}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase ${statusColor(session.status)}`}>
                                            {session.status}
                                        </span>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-5 flex-1">
                                    <div className="space-y-4 bg-secondary/20 p-4 rounded-xl border border-border/50">
                                        {/* Master toggle */}
                                        <div className="flex items-center justify-between pb-3 border-b border-border/50">
                                            <div>
                                                <Label htmlFor={`auto-${session.id}`} className="text-sm font-semibold cursor-pointer">Master Auto-Reply</Label>
                                                <p className="text-xs text-muted-foreground">Enables all automated responses</p>
                                            </div>
                                            <Switch
                                                id={`auto-${session.id}`}
                                                checked={session.auto_reply === 1 || session.auto_reply === true}
                                                onCheckedChange={(c) => toggleAutoReply(session.id, c)}
                                            />
                                        </div>
                                        {/* Sub-toggles */}
                                        <div className={`space-y-3 transition-opacity ${!session.auto_reply ? 'opacity-40 pointer-events-none' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor={`ai-${session.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <Brain className="w-4 h-4 text-purple-400" /> AI Responses
                                                </Label>
                                                <Switch id={`ai-${session.id}`} checked={session.ai_replies === 1 || session.ai_replies === true} onCheckedChange={(c) => toggleAiReplies(session.id, c)} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor={`qr-${session.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <Zap className="w-4 h-4 text-yellow-400" /> Quick Replies
                                                </Label>
                                                <Switch id={`qr-${session.id}`} checked={session.quick_replies === 1 || session.quick_replies === true} onCheckedChange={(c) => toggleQuickReplies(session.id, c)} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="border-t border-border/50 p-4 flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleRelink(session.id)} className="gap-1.5 flex-1 text-xs">
                                        <Link2 className="w-3.5 h-3.5" /> Relink
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleRestart(session.id)} className="gap-1.5 flex-1 text-xs">
                                        <RefreshCw className="w-3.5 h-3.5" /> Restart
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(session.id)} className="px-3">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Session Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="card-glass">
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>New WhatsApp Device</DialogTitle>
                        <DialogDescription>Give this account a name to identify it easily.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Device Name</Label>
                            <Input
                                placeholder="e.g. Sales Team, Support"
                                value={newSessionName}
                                onChange={(e) => setNewSessionName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                                className="bg-secondary/50"
                            />
                        </div>
                        <Button className="w-full btn-primary-glow" onClick={handleCreateSession}>
                            Create & Get QR
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* QR Modal */}
            <Dialog open={qrModalOpen} onOpenChange={(open) => { setQrModalOpen(open); if (!open) activeQrSession.current = null; }}>
                <DialogContent className="sm:max-w-md card-glass">
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Scan QR Code</DialogTitle>
                        <DialogDescription>Open WhatsApp on your phone and scan to link.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-secondary/20 rounded-xl min-h-[300px]">
                        {qrCodeDataUrl ? (
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, ease }}>
                                <div className="bg-white p-4 rounded-xl shadow-lg">
                                    <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center text-muted-foreground">
                                <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                                <p className="text-sm">Generating QR Code...</p>
                                <p className="text-xs mt-1 opacity-60">Please wait, this may take a moment</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
