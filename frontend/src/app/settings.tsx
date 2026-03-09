'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getSettings, updateSettings, getLicenseStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Palette, KeyRound, Save, CheckCircle, Infinity } from 'lucide-react';
import { toast } from 'sonner';

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const SectionCard = ({ icon: Icon, title, description, children, color = '#3b82f6' }: any) => (
    <Card className="card-glow overflow-hidden">
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
                {title}
            </CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
    </Card>
);

export function Settings() {
    const [settings, setSettings] = useState({
        theme: 'dark',
        ai_provider: 'gemini',
        ai_model: '',
        system_prompt: '',
        min_delay: '8000',
        max_delay: '18000',
        gemini_api_key: '',
        openai_api_key: ''
    });

    const availableModels = {
        gemini: ['gemini-3.1-pro', 'gemini-3.0-pro', 'gemini-3.0-deep-think', 'gemini-3.0-flash', 'gemini-3.1-flash-lite', 'gemini-3.0-pro-image'],
        openai: ['gpt-5.4', 'gpt-5.4-thinking', 'gpt-5.2', 'gpt-5.2-codex', 'o4-mini', 'gpt-image-1.5']
    };

    const [license, setLicense] = useState<any>(null);
    const [saving, setSaving] = useState(false);

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
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage application configurations and AI providers</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
                {/* Left Column */}
                <div className="space-y-5">
                    {/* AI Provider */}
                    <SectionCard icon={Brain} title="AI Provider" description="Configure the AI engine for auto-replies" color="#8b5cf6">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Provider</Label>
                            <Select
                                value={settings.ai_provider}
                                onValueChange={(v) => {
                                    const prov = (v === 'openai' ? 'openai' : 'gemini');
                                    setSettings({ ...settings, ai_provider: prov, ai_model: availableModels[prov][0] });
                                }}
                            >
                                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini">Google Gemini</SelectItem>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model</Label>
                            <Select
                                value={settings.ai_model || availableModels[settings.ai_provider === 'openai' ? 'openai' : 'gemini'][0]}
                                onValueChange={(v) => setSettings({ ...settings, ai_model: v || '' })}
                            >
                                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels[settings.ai_provider === 'openai' ? 'openai' : 'gemini'].map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.ai_provider === 'gemini' && (
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gemini API Key</Label>
                                <Input type="password" value={settings.gemini_api_key}
                                    onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })}
                                    placeholder="Enter Gemini API key" className="bg-secondary/50 font-mono" />
                            </div>
                        )}
                        {settings.ai_provider === 'openai' && (
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">OpenAI API Key</Label>
                                <Input type="password" value={settings.openai_api_key}
                                    onChange={e => setSettings({ ...settings, openai_api_key: e.target.value })}
                                    placeholder="Enter OpenAI API key" className="bg-secondary/50 font-mono" />
                            </div>
                        )}
                    </SectionCard>

                    {/* Appearance */}
                    <SectionCard icon={Palette} title="Appearance" color="#3b82f6">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Theme</Label>
                            <Select
                                value={settings.theme}
                                onValueChange={(v) => {
                                    const theme = v || 'dark';
                                    setSettings({ ...settings, theme });
                                    localStorage.setItem('theme', theme);
                                    document.documentElement.classList.toggle('dark', theme === 'dark');
                                }}
                            >
                                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dark">Dark Mode</SelectItem>
                                    <SelectItem value="light">Light Mode</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </SectionCard>

                    {/* License */}
                    <SectionCard icon={KeyRound} title="License Information" color="#10b981">
                        <div className="flex justify-between items-center pb-3 border-b border-border/50">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Activation Key</span>
                            <span className="font-mono text-sm tracking-widest">{license?.keyMasked || '—'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="bg-secondary/40 rounded-xl p-4 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Expires On</div>
                                <div className="font-bold text-sm">{license?.isLifetime ? 'Lifetime' : license?.expiryDate || '—'}</div>
                            </div>
                            <div className="bg-secondary/40 rounded-xl p-4 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Days Remaining</div>
                                <div className="font-bold text-xl flex items-center justify-center">
                                    {license?.isLifetime ? <Infinity className="w-5 h-5 text-primary" /> : (license?.daysRemaining || '—')}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs badge-success px-2 py-0.5 rounded-full font-medium">Active License</span>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column — System Prompt */}
                <SectionCard icon={Brain} title="AI System Prompt" description="Define how the AI should behave when responding to messages automatically." color="#06b6d4">
                    <Textarea
                        className="h-[420px] font-mono text-sm resize-none bg-secondary/30 border-border/60"
                        value={settings.system_prompt}
                        onChange={e => setSettings({ ...settings, system_prompt: e.target.value })}
                        placeholder="You are a helpful assistant for our business..."
                    />
                    <p className="text-xs text-muted-foreground">
                        This prompt sets the personality, tone, and guidelines for AI auto-replies. Be specific about what the AI should and shouldn't answer.
                    </p>
                </SectionCard>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4, ease }}
                className="flex justify-end pt-2"
            >
                <Button size="lg" onClick={handleSave} disabled={saving} className="btn-primary-glow gap-2 min-w-[180px]">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </motion.div>
        </div>
    );
}
