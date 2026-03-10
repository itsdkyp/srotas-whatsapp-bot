'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Smartphone,
    Users,
    Megaphone,
    CalendarClock,
    FileText,
    Zap,
    Settings,
    HelpCircle,
    Shield,
    MessageSquareMore,
    Sun,
    Moon,
    ChevronRight
} from 'lucide-react';
import { getLicenseStatus, getSessions, getCampaigns } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from '../providers/socket-provider';

interface AppShellProps {
    children: (activePage: string) => React.ReactNode;
}

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sessions', label: 'Devices', icon: Smartphone },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'messaging', label: 'Campaigns', icon: Megaphone },
    { id: 'scheduler', label: 'Scheduler', icon: CalendarClock },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'quickreplies', label: 'Quick Replies', icon: Zap },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
];

export function AppShell({ children }: AppShellProps) {
    const [activePage, setActivePage] = useState('dashboard');
    const [hasEasterEgg, setHasEasterEgg] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const [isOnline, setIsOnline] = useState(false);
    const [isSendingCampaign, setIsSendingCampaign] = useState(false);
    const [isAutoReplyOn, setIsAutoReplyOn] = useState(false);

    const { socket } = useSocket();

    const fetchStatus = async () => {
        try {
            const [sessions, campaigns] = await Promise.all([
                getSessions(),
                getCampaigns()
            ]);

            const connectedSessions = sessions.filter((s: any) => s.status === 'ready');
            setIsOnline(connectedSessions.length > 0);

            const autoReplyOn = connectedSessions.some((s: any) => s.auto_reply === 1 || s.ai_replies_enabled === 1);
            setIsAutoReplyOn(autoReplyOn);

            const activeCampaign = campaigns.some((c: any) => c.status === 'running' || c.status === 'sending');
            setIsSendingCampaign(activeCampaign);
        } catch (e) {
            // ignore
        }
    };

    useEffect(() => {
        fetchStatus();

        if (socket) {
            socket.on('session:ready', fetchStatus);
            socket.on('session:disconnected', fetchStatus);
            socket.on('bulk:progress', fetchStatus);
            socket.on('bulk:complete', fetchStatus);

            return () => {
                socket.off('session:ready', fetchStatus);
                socket.off('session:disconnected', fetchStatus);
                socket.off('bulk:progress', fetchStatus);
                socket.off('bulk:complete', fetchStatus);
            };
        }
    }, [socket]);

    useEffect(() => {
        getLicenseStatus().then((status) => {
            if (status.isLifetime) setHasEasterEgg(true);
        }).catch(console.error);

        const saved = localStorage.getItem('theme');
        const dark = saved !== 'light';
        setIsDark(dark);
        document.documentElement.classList.toggle('dark', dark);
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const allNavItems = hasEasterEgg
        ? [...NAV_ITEMS, { id: 'admin', label: 'Admin', icon: Shield }]
        : NAV_ITEMS;

    const activeLabel = allNavItems.find(n => n.id === activePage)?.label || 'Dashboard';

    const [tourActive, setTourActive] = useState(false);
    const [tourStep, setTourStep] = useState(0);

    const TOUR_STEPS = [
        { id: 'dashboard', page: 'dashboard', title: 'Welcome to Srotas.bot!', desc: 'This dashboard gives you a real-time overview of your WhatsApp automation performance, including message delivery rates and active campaigns.' },
        { id: 'sessions', page: 'sessions', title: 'Device Management', desc: 'Connect multiple WhatsApp accounts simultaneously. Just click Add Account and scan the QR code to scale your outreach.' },
        { id: 'contacts', page: 'contacts', title: 'CRM & Contacts', desc: 'Import contacts in bulk via CSV, organize them into targeted groups, and manage your entire customer database here.' },
        { id: 'messaging', page: 'messaging', title: 'Bulk Campaigns', desc: 'Launch targeted messaging campaigns to your groups. The bot uses randomized human-like delays to prevent account bans.' },
        { id: 'scheduler', page: 'scheduler', title: 'Campaign Scheduler', desc: 'Automate your outreach. Set up daily, weekly, or monthly recurring messages so you never miss a touchpoint.' },
        { id: 'templates', page: 'templates', title: 'Smart Templates', desc: 'Create reusable message templates with dynamic variables like {{name}} or {{company}} for personalized outreach.' },
        { id: 'quickreplies', page: 'quickreplies', title: 'Keyword Auto-Replies', desc: 'Define trigger keywords (like "pricing" or "demo") and the bot will instantly reply with the exact information.' },
        { id: 'settings', page: 'settings', title: 'AI Persona Engine', desc: 'The real magic happens here. Connect your OpenAI or Gemini API key and define a System Prompt. The bot will automatically chat with users using your exact tone, knowledge, and persona!' }
    ];

    useEffect(() => {
        const handleStartTour = () => {
            setTourStep(0);
            setTourActive(true);
            setActivePage(TOUR_STEPS[0].page);
        };
        window.addEventListener('start-tour', handleStartTour);
        return () => window.removeEventListener('start-tour', handleStartTour);
    }, []);

    const nextTourStep = () => {
        if (tourStep < TOUR_STEPS.length - 1) {
            const next = tourStep + 1;
            setTourStep(next);
            setActivePage(TOUR_STEPS[next].page);
        } else {
            setTourActive(false);
        }
    };

    const prevTourStep = () => {
        if (tourStep > 0) {
            const prev = tourStep - 1;
            setTourStep(prev);
            setActivePage(TOUR_STEPS[prev].page);
        }
    };

    return (
        <div className="flex h-full bg-background text-foreground overflow-hidden">
            {/* ── Guided Tour Overlay ─────────────────────────────── */}
            <AnimatePresence>
                {tourActive && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-8 right-8 z-[100] w-[350px] bg-card/95 backdrop-blur-xl border border-primary/40 shadow-2xl rounded-2xl overflow-hidden"
                    >
                        <div className="h-1.5 w-full bg-secondary">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                animate={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    Step {tourStep + 1} of {TOUR_STEPS.length}
                                </span>
                                <button onClick={() => setTourActive(false)} className="text-muted-foreground hover:text-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>
                            <h3 className="text-lg font-bold mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                {TOUR_STEPS[tourStep].title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                                {TOUR_STEPS[tourStep].desc}
                            </p>
                            <div className="flex justify-between items-center pt-3 border-t border-border/50">
                                <button
                                    onClick={prevTourStep}
                                    disabled={tourStep === 0}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${tourStep === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary'}`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={nextTourStep}
                                    className="text-xs font-bold px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    {tourStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sidebar ─────────────────────────────── */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="w-64 xl:w-72 flex flex-col flex-shrink-0"
                style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
            >
                {/* Logo + Theme Toggle */}
                <div
                    className="h-16 flex items-center justify-between px-5 flex-shrink-0"
                    style={{ borderBottom: '1px solid var(--sidebar-border)' }}
                >
                    <div
                        className="flex items-center gap-3 select-none"
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center blue-glow flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                        >
                            <MessageSquareMore className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="font-bold text-base tracking-tight leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                Srotas<span className="text-primary">.bot</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Dashboard</div>
                        </div>
                    </div>

                    {/* Theme toggle — icon only, next to logo */}
                    <button
                        onClick={toggleTheme}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex-shrink-0"
                        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {isDark ? (
                                <motion.div
                                    key="moon"
                                    initial={{ rotate: -30, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 30, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Moon className="w-4 h-4" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="sun"
                                    initial={{ rotate: 30, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -30, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Sun className="w-4 h-4" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                    {allNavItems.map((item, i) => {
                        const Icon = item.icon;
                        const isActive = activePage === item.id;
                        const isAdmin = item.id === 'admin';

                        return (
                            <motion.button
                                key={item.id}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.04 * i, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                onClick={() => setActivePage(item.id)}
                                whileHover={{ x: 3 }}
                                whileTap={{ scale: 0.97 }}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
                                    ${isActive
                                        ? 'nav-active'
                                        : isAdmin
                                            ? 'text-purple-400 hover:bg-purple-400/10'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : isAdmin ? 'text-purple-400' : ''}`} />
                                    {item.label}
                                </div>
                                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary opacity-60" />}
                            </motion.button>
                        );
                    })}
                </nav>

                {/* Footer — status only, no theme toggle */}
                <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
                    <div className="flex flex-col gap-3 px-1 items-center justify-center text-center">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                {isOnline ? (
                                    <>
                                        {isSendingCampaign ? (
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                        ) : isAutoReplyOn ? (
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                        ) : null}
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </>
                                ) : (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-400" />
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                            <span>designed by</span>
                            <motion.a
                                href="https://srotas.tech"
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold tracking-wider inline-flex items-center text-xs"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 100'%3E%3Cpath d='M0,50 C150,150 250,-50 400,50 L400,150 L0,150 Z' fill='%233b82f6' /%3E%3C/svg%3E")`,
                                    backgroundColor: '#93c5fd', // light blue base
                                    backgroundSize: '15px 150%',
                                    backgroundRepeat: 'repeat-x',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    color: 'transparent'
                                }}
                                animate={{ backgroundPosition: ['0px 30%', '15px 30%'] }}
                                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                            >
                                srotas.tech
                            </motion.a>
                        </div>
                    </div>
                </div>
            </motion.aside>

            {/* ── Main Content ─────────────────────────── */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {/* Header */}
                <div
                    className="h-16 flex-shrink-0 flex items-center justify-between px-8"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div>
                        <h2 className="text-base font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            {activeLabel}
                        </h2>
                        <p className="text-xs text-muted-foreground">Srotas.bot · WhatsApp Automation Platform</p>
                    </div>
                    <button
                        onClick={() => setActivePage('updates')}
                        className="text-xs px-3 py-1 rounded-full badge-blue font-medium cursor-pointer hover:opacity-80 transition-opacity"
                        title="Check for updates"
                    >v1.2.0</button>
                </div>

                {/* Page with transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activePage}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="flex-1 overflow-y-auto"
                    >
                        {children(activePage)}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
