'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getSettings, updateSettings, getLicenseStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Palette, KeyRound, Save, Infinity, Eye, EyeOff, CheckCircle, Sun, Moon, Cpu, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function Settings() {
    const [settings, setSettings] = useState({
        theme: 'dark',
        ai_provider: 'gemini',
        ai_model: '',
        ai_chat_history: false,
        ai_chat_history_limit: 20,
        ai_use_system_prompt: true,
        system_prompt: '',
        min_delay: '8000',
        max_delay: '18000',
        gemini_api_key: '',
        openai_api_key: ''
    });

    const availableModels = {
        gemini: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'],
        openai: ['gpt-5.4', 'gpt-5.4-thinking', 'gpt-5.2', 'gpt-5.2-codex', 'o4-mini', 'gpt-image-1.5']
    };

    const [license, setLicense] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [activeTab, setActiveTab] = useState('ai');

    useEffect(() => {
        getSettings().then(setSettings).catch(console.error);
        getLicenseStatus().then(setLicense).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettings(settings);
            toast.success('Settings saved successfully');
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 xl:p-8 max-w-[1200px] mx-auto space-y-6 w-full h-full flex flex-col">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage application configurations</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="btn-primary-glow gap-2 min-w-[140px] shadow-md">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease }}
                className="flex-1 flex flex-col"
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1 border border-border/50 max-w-md mx-auto">
                        <TabsTrigger value="ai" className="gap-2 text-xs">
                            <Cpu className="w-4 h-4" /> AI Engine
                        </TabsTrigger>
                        <TabsTrigger value="system" className="gap-2 text-xs">
                            <Settings2 className="w-4 h-4" /> System Config
                        </TabsTrigger>
                    </TabsList>

                    {/* AI ENGINE TAB */}
                    <TabsContent value="ai" className="flex-1 flex flex-col gap-6 mt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                            {/* Left Column: API & Model + Easter Egg Settings */}
                            <div className="lg:col-span-1 flex flex-col gap-6 shrink-0">
                                {/* API & Model Configuration */}
                                <Card className="card-glow border-border/50 shadow-sm h-fit">
                                    <CardHeader className="pb-4 pt-5 px-5 border-b border-border/30">
                                        <CardTitle className="text-base flex items-center gap-2.5 font-semibold">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/20">
                                                <Brain className="w-3.5 h-3.5 text-purple-400" />
                                            </div>
                                            API & Model
                                        </CardTitle>
                                        <CardDescription className="text-[11px] mt-1">Select and authenticate your AI provider.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-foreground/80">Provider</Label>
                                            <Select
                                                value={settings.ai_provider}
                                                onValueChange={(v) => {
                                                    const prov = (v === 'openai' ? 'openai' : 'gemini');
                                                    setSettings({ ...settings, ai_provider: prov, ai_model: availableModels[prov][0] });
                                                }}
                                            >
                                                <SelectTrigger className="bg-secondary/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="gemini" className="text-xs">Google Gemini</SelectItem>
                                                    <SelectItem value="openai" className="text-xs">OpenAI</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-foreground/80">Model</Label>
                                            <Select
                                                value={settings.ai_model || availableModels[settings.ai_provider === 'openai' ? 'openai' : 'gemini'][0]}
                                                onValueChange={(v) => setSettings({ ...settings, ai_model: v || '' })}
                                            >
                                                <SelectTrigger className="bg-secondary/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {availableModels[settings.ai_provider === 'openai' ? 'openai' : 'gemini'].map(m => (
                                                        <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-foreground/80">
                                                {settings.ai_provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                                            </Label>
                                            <div className="relative">
                                                <Input type={showApiKey ? 'text' : 'password'}
                                                    value={settings.ai_provider === 'gemini' ? settings.gemini_api_key : settings.openai_api_key}
                                                    onChange={e => setSettings({ ...settings, [settings.ai_provider === 'gemini' ? 'gemini_api_key' : 'openai_api_key']: e.target.value })}
                                                    placeholder={`Enter ${settings.ai_provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`}
                                                    className="bg-secondary/30 font-mono pr-8 h-9 text-xs" />
                                                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Easter Egg Settings (Moved directly below API & Model) */}
                                {license?.isLifetime && (
                                    <Card className="card-glow border-purple-500/20 bg-purple-500/5 shadow-sm shrink-0">
                                        <CardContent className="p-5 flex flex-col gap-4">
                                            <div>
                                                <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                                                    Chat Context
                                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-[9px] uppercase tracking-wider">Easter Egg</span>
                                                </h3>
                                                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                                                    Allows the AI to read previous messages.
                                                    <span className="text-orange-400 block mt-1 font-medium">Privacy Warning: History is sent to the AI API.</span>
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-3 bg-background/50 border border-border/50 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-medium cursor-pointer">Active</Label>
                                                    <Switch
                                                        checked={settings.ai_chat_history}
                                                        onCheckedChange={(checked: boolean) => setSettings({ ...settings, ai_chat_history: checked })}
                                                    />
                                                </div>
                                                <div className={`flex items-center justify-between pt-2 border-t border-border/40 transition-opacity ${!settings.ai_chat_history ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    <Label className="text-xs text-muted-foreground">Message Limit</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={500}
                                                        className="w-16 h-7 text-xs text-center font-mono border-border/60"
                                                        value={settings.ai_chat_history_limit}
                                                        onChange={(e) => setSettings({ ...settings, ai_chat_history_limit: parseInt(e.target.value) || 20 })}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Right: Instructions (Wider area) */}
                            <Card className="card-glow border-border/50 lg:col-span-2 flex flex-col shadow-sm min-h-[500px]">
                                <CardHeader className="pb-4 pt-5 px-5 border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold">System Instructions</CardTitle>
                                        <CardDescription className="text-[11px] mt-0.5">Define the core persona, logic, and rules for the AI.</CardDescription>
                                    </div>
                                    {license?.isLifetime && (
                                        <div className="flex items-center gap-2 bg-secondary/30 border border-border/50 px-3 py-1.5 rounded-full shadow-sm">
                                            <Switch
                                                checked={settings.ai_use_system_prompt}
                                                onCheckedChange={(checked: boolean) => setSettings({ ...settings, ai_use_system_prompt: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Enabled</span>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0 flex-1 flex flex-col relative">
                                    <Textarea
                                        className="flex-1 w-full h-full font-mono text-[13px] resize-none border-0 rounded-none bg-secondary/5 p-5 leading-relaxed focus-visible:ring-0 focus-visible:bg-secondary/10 transition-colors"
                                        value={settings.system_prompt}
                                        onChange={e => setSettings({ ...settings, system_prompt: e.target.value })}
                                        placeholder="You are a helpful assistant for our business..."
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* SYSTEM TAB */}
                    <TabsContent value="system" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Theme */}
                            <Card className="card-glow border-border/50 shadow-sm">
                                <CardHeader className="pb-4 pt-5 px-5 border-b border-border/30">
                                    <CardTitle className="text-base flex items-center gap-2.5 font-semibold">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/20">
                                            <Palette className="w-3.5 h-3.5 text-blue-400" />
                                        </div>
                                        Appearance
                                    </CardTitle>
                                    <CardDescription className="text-[11px] mt-1">Customize the user interface.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 flex flex-col items-center justify-center h-40">
                                    <div className="w-full max-w-[240px] flex bg-secondary/50 rounded-xl p-1.5 border border-border/50 relative shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSettings({ ...settings, theme: 'light' });
                                                localStorage.setItem('theme', 'light');
                                                document.documentElement.classList.toggle('dark', false);
                                            }}
                                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${settings.theme === 'light' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Sun className="w-4 h-4" /> Light
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSettings({ ...settings, theme: 'dark' });
                                                localStorage.setItem('theme', 'dark');
                                                document.documentElement.classList.toggle('dark', true);
                                            }}
                                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${settings.theme === 'dark' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Moon className="w-4 h-4" /> Dark
                                        </button>

                                        <div className="absolute inset-y-1.5 left-1.5 right-1.5 pointer-events-none">
                                            <div className="relative w-full h-full">
                                                <motion.div
                                                    className="absolute top-0 bottom-0 w-1/2 bg-background rounded-lg shadow-sm border border-border/40"
                                                    initial={false}
                                                    animate={{ x: settings.theme === 'dark' ? '100%' : '0%' }}
                                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* License */}
                            <Card className="card-glow border-border/50 shadow-sm flex flex-col">
                                <CardHeader className="pb-4 pt-5 px-5 border-b border-border/30 shrink-0">
                                    <CardTitle className="text-base flex items-center gap-2.5 font-semibold">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/20">
                                            <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                                        </div>
                                        License Information
                                    </CardTitle>
                                    <CardDescription className="text-[11px] mt-1">Your active subscription details.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-5 flex-1 flex flex-col justify-between h-40">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Active License</div>
                                            <div className="text-xs text-muted-foreground font-mono mt-0.5 tracking-wider">{license?.keyMasked || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-auto">
                                        <div className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/40">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Expires On</div>
                                            <div className="font-semibold text-xs">{license?.isLifetime ? 'Lifetime' : license?.expiryDate || '—'}</div>
                                        </div>
                                        <div className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/40">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Days Left</div>
                                            <div className="font-bold text-sm flex items-center justify-center text-primary">
                                                {license?.isLifetime ? <Infinity className="w-4 h-4" /> : (license?.daysRemaining || '—')}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
