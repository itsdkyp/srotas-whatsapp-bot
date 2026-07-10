
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getTemplates, addTemplate, deleteTemplate, updateTemplate, uploadMedia, getSettings, generateCampaignImage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { Trash2, Plus, MessageSquare, X, Upload, FileText, Sparkles, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function Templates() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });

    const [files, setFiles] = useState<File[]>([]);
    const [editingMediaPaths, setEditingMediaPaths] = useState<string[]>([]);
    const [previewFile, setPreviewFile] = useState<{ file?: File; url?: string; name: string } | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
    const [geminiKeySet, setGeminiKeySet] = useState(false);
    const [generatingImage, setGeneratingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateInputRef = useRef<HTMLTextAreaElement>(null);

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

    useEffect(() => {
        fetchTemplates();
        getSettings().then(s => setGeminiKeySet(!!s.gemini_api_key)).catch(() => setGeminiKeySet(false));
    }, []);

    const fetchTemplates = () => {
        getTemplates().then(setTemplates).catch(console.error);
    };

    const handleGenerateImage = async () => {
        if (!newTemplate.content.trim()) return toast.error('Write the template content first — the image is generated from it');
        if (files.length >= 10) return toast.error('Maximum 10 files allowed');
        setGeneratingImage(true);
        try {
            const res = await generateCampaignImage(newTemplate.content);
            const byteChars = atob(res.image);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const ext = (res.mimetype || 'image/png').split('/')[1] || 'png';
            const file = new File([bytes], `ai-image-${Date.now()}.${ext}`, { type: res.mimetype || 'image/png' });
            setFiles(prev => [file, ...prev]);
            toast.success('AI Image generated and attached!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate image');
        } finally {
            setGeneratingImage(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            if (files.length + newFiles.length > 10) {
                return toast.error('Maximum 10 files allowed');
            }
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const openEdit = (t: any) => {
        setEditingId(t.id.toString());
        setNewTemplate({ name: t.name, content: t.content });
        // Media files can't be easily edited via file input if already uploaded, 
        // but we'll clear the current files queue.
        setFiles([]);
        setEditingMediaPaths(getTemplateMediaUrls(t));
        setIsAddOpen(true);
    };

    const handleAdd = async () => {
        if (!newTemplate.name || !newTemplate.content) {
            return toast.error('Name and content are required');
        }
        try {
            let uploadedPaths: string[] = [];
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append('media', f));
                const res = await uploadMedia(formData);
                uploadedPaths = res.files.map((f: any) => f.path);
            }

            const payload = {
                name: newTemplate.name,
                content: newTemplate.content,
                buttons: null,
                mediaPaths: uploadedPaths.length > 0 ? uploadedPaths : (editingMediaPaths.length > 0 ? editingMediaPaths : null)
            };

            if (editingId) {
                await updateTemplate(editingId, payload);
                toast.success('Template updated');
            } else {
                await addTemplate(payload);
                toast.success('Template saved');
            }

            setIsAddOpen(false);
            setEditingId(null);
            setNewTemplate({ name: '', content: '' });
            setFiles([]);
            setEditingMediaPaths([]);
            fetchTemplates();
        } catch (error) {
            toast.error('Failed to save template');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await deleteTemplate(id);
            toast.success('Template deleted');
            fetchTemplates();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const insertTag = (tag: string) => {
        const textarea = templateInputRef.current;
        if (!textarea) {
            setNewTemplate(prev => ({ ...prev, content: prev.content + ` {{${tag}}} ` }));
            return;
        }
        const start = textarea.selectionStart ?? newTemplate.content.length;
        const end = textarea.selectionEnd ?? newTemplate.content.length;
        const text = newTemplate.content || '';
        const before = text.substring(0, start);
        const after = text.substring(end);

        const placeholder = `{{${tag}}}`;
        const leadingSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
        const trailingSpace = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n') && !/^[.,!?;:)]/.test(after) ? ' ' : '';
        const insertion = `${leadingSpace}${placeholder}${trailingSpace}`;

        const newContent = `${before}${insertion}${after}`;
        setNewTemplate(prev => ({ ...prev, content: newContent }));

        setTimeout(() => {
            textarea.focus();
            const newPos = start + insertion.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
                    <p className="text-muted-foreground">Create reusable messages for your campaigns</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> New Template
                </Button>
            </div>

            {templates.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold">No templates found</h3>
                    <p className="text-muted-foreground mb-6">Create a template to save time when sending campaigns.</p>
                    <Button onClick={() => setIsAddOpen(true)}>Create Template</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(t => {
                        const mediaUrls = getTemplateMediaUrls(t);
                        return (
                            <Card
                                key={t.id}
                                onClick={() => setPreviewTemplate(t)}
                                className="flex flex-col overflow-hidden border border-border/50 hover:border-primary/40 transition-all shadow-sm cursor-pointer group/card active:scale-[0.99]"
                            >
                                <CardHeader className="bg-secondary/30 pb-3">
                                    <CardTitle className="text-lg font-semibold flex items-center justify-between">
                                        <span className="truncate">{t.name}</span>
                                        {mediaUrls.length > 0 && (
                                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> Image Included
                                            </span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 flex-1 flex flex-col gap-3">
                                    {mediaUrls.length > 0 && (
                                        <div
                                            className="relative rounded-lg overflow-hidden bg-black/5 border border-border/40 group/img h-40 w-full"
                                        >
                                            <img
                                                src={mediaUrls[0]}
                                                alt={t.name}
                                                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                                                <Eye className="w-4 h-4" /> Click to view full chat & image
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-3">
                                        {t.content}
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t p-3 flex items-center justify-between gap-2 bg-secondary/10 mt-auto" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1.5 text-primary border-primary/30 hover:bg-primary/10" onClick={() => setPreviewTemplate(t)}>
                                        <Eye className="w-3.5 h-3.5" /> Preview Chat
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => openEdit(t)}>
                                            Edit
                                        </Button>
                                        <Button variant="destructive" size="sm" className="h-8 text-xs font-medium" onClick={() => handleDelete(t.id)}>
                                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) {
                    setEditingId(null);
                    setNewTemplate({ name: '', content: '' });
                    setFiles([]);
                    setEditingMediaPaths([]);
                }
            }}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Template' : 'New Template'}</DialogTitle>
                        <DialogDescription>Create a message template with personalized placeholders.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        {/* Left Side: Editor */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    placeholder="e.g. Welcome Message"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Message Content</Label>
                                <Textarea
                                    ref={templateInputRef}
                                    rows={8}
                                    placeholder="Hello {{name}}, thanks for choosing {{company}}!"
                                    value={newTemplate.content}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                />
                                <div className="flex gap-2 pt-1">
                                    {['name', 'phone', 'company'].map(tag => (
                                        <Button key={tag} type="button" variant="outline" size="sm" className="h-7 text-xs"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => insertTag(tag)}>
                                            {`{{${tag}}}`}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-border pt-4">
                                <Label className="flex justify-between items-center">
                                    <span>Attachments</span>
                                    <span className="text-xs text-muted-foreground">{files.length}/10 files</span>
                                </Label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
                                >
                                    <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                                    <span className="text-sm font-medium">Click to upload media</span>
                                </div>
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" />
                                {geminiKeySet && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGenerateImage}
                                        disabled={generatingImage || !newTemplate.content.trim()}
                                        className="w-full gap-2 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 mt-2"
                                    >
                                        {generatingImage
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating image…</>
                                            : <><Sparkles className="w-4 h-4" /> Generate Image with AI</>}
                                    </Button>
                                )}

                                {(files.length > 0 || editingMediaPaths.length > 0) && (
                                    <div className="space-y-2 mt-2 max-h-32 overflow-y-auto pr-1">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-secondary/60 rounded-md text-xs border border-border/40 group">
                                                <div className="flex items-center gap-1.5 truncate pr-2 min-w-0">
                                                    {file.type.startsWith('image/') ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewFile({ file, url: URL.createObjectURL(file), name: file.name })}
                                                            className="flex items-center gap-1.5 truncate text-left hover:text-primary transition-colors cursor-pointer"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 text-primary" />
                                                            <span className="truncate font-medium">{file.name}</span>
                                                        </button>
                                                    ) : (
                                                        <span className="truncate font-medium flex items-center gap-1.5">
                                                            <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                                                            {file.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20 shrink-0" onClick={() => removeFile(idx)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {files.length === 0 && editingMediaPaths.map((mediaUrl, idx) => (
                                            <div key={`existing-${idx}`} className="flex items-center justify-between p-2 bg-secondary/60 rounded-md text-xs border border-border/40 group">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile({ url: mediaUrl, name: `${newTemplate.name || 'Template'} Image` })}
                                                    className="flex items-center gap-1.5 truncate text-left hover:text-primary transition-colors cursor-pointer w-full"
                                                >
                                                    <Eye className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 text-primary" />
                                                    <span className="truncate font-medium">Saved Attached Image</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button className="w-full mt-2 btn-primary-glow" onClick={handleAdd}>{editingId ? 'Update Template' : 'Save Template'}</Button>
                        </div>

                        {/* Right Side: Preview */}
                        <div className="space-y-2 h-full flex flex-col">
                            <Label className="flex justify-between items-center text-xs uppercase tracking-wider text-muted-foreground">
                                <span>Message Preview</span>
                            </Label>
                            <div className="bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-xl border border-border/50 flex-1 min-h-[400px] overflow-y-auto flex flex-col gap-2"
                                style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundBlendMode: 'overlay' }}>

                                <div className="mt-auto"></div>

                                {/* First bubble: First file + Text */}
                                {(files.length > 0 || editingMediaPaths.length > 0 || newTemplate.content) && (
                                    <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative flex flex-col gap-1.5">
                                        {(files.length > 0 || editingMediaPaths.length > 0) && (
                                            <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                                {files.length > 0 ? (
                                                    files[0].type.startsWith('image/') ? (
                                                        <div
                                                            className="relative cursor-pointer group/img"
                                                            onClick={() => setPreviewFile({ file: files[0], url: URL.createObjectURL(files[0]), name: files[0].name })}
                                                        >
                                                            <img
                                                                src={URL.createObjectURL(files[0])}
                                                                alt="preview"
                                                                className="w-full h-auto object-cover max-h-[250px] rounded-md hover:opacity-90 transition-opacity"
                                                            />
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
                                                    <div
                                                        className="relative cursor-pointer group/img"
                                                        onClick={() => setPreviewFile({ url: editingMediaPaths[0], name: `${newTemplate.name || 'Template'} Image` })}
                                                    >
                                                        <img
                                                            src={editingMediaPaths[0]}
                                                            alt="preview"
                                                            className="w-full h-auto object-cover max-h-[250px] rounded-md hover:opacity-90 transition-opacity"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                                                            <Eye className="w-4 h-4" /> Click to view
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {newTemplate.content && (
                                            <p className="text-sm whitespace-pre-wrap break-words text-[#111b21] dark:text-[#e9edef] px-1" style={{ wordBreak: 'break-word' }}>
                                                {newTemplate.content.replace(/\{\{name\}\}/gi, 'John Doe')
                                                    .replace(/\{\{phone\}\}/gi, '+91 98765 43210')
                                                    .replace(/\{\{company\}\}/gi, 'Acme Corp')}
                                            </p>
                                        )}
                                        <div className="text-[10px] text-muted-foreground text-right opacity-70 mt-0.5 px-1">
                                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                                        </div>
                                    </div>
                                )}
                                {!newTemplate.content && files.length === 0 && editingMediaPaths.length === 0 && (
                                    <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                        <span className="text-muted-foreground italic text-sm px-1">Type a message...</span>
                                    </div>
                                )}

                                {/* Subsequent bubbles: Remaining files */}
                                {files.slice(1).map((f, i) => (
                                    <div key={i} className="bg-white dark:bg-[#005c4b] p-1.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                        <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                            {f.type.startsWith('image/') ? (
                                                <div
                                                    className="relative cursor-pointer group/img"
                                                    onClick={() => setPreviewFile({ file: f, url: URL.createObjectURL(f), name: f.name })}
                                                >
                                                    <img
                                                        src={URL.createObjectURL(f)}
                                                        alt="preview"
                                                        className="w-full h-auto object-cover max-h-[250px] rounded-md hover:opacity-90 transition-opacity"
                                                    />
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
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Image Preview Lightbox ───────────────────────────────── */}
            {!!previewFile && (
                <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
                    <DialogPortal>
                        <DialogOverlay className="z-[100] bg-black/80 backdrop-blur-sm" />
                        <div
                            className="fixed top-1/2 left-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl overflow-hidden rounded-xl border border-border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
                            style={{ background: 'var(--card)', backdropFilter: 'blur(12px)' }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
                                <span className="text-sm text-foreground font-medium truncate max-w-[80%]">{previewFile.name}</span>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile(null)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Image */}
                            <div className="flex items-center justify-center bg-secondary/20" style={{ minHeight: '50vh', maxHeight: '85vh', overflow: 'hidden' }}>
                                <img
                                    src={previewFile.url || (previewFile.file ? URL.createObjectURL(previewFile.file) : '')}
                                    alt={previewFile.name}
                                    style={{ maxHeight: '85vh', width: '100%', objectFit: 'contain' }}
                                />
                            </div>
                        </div>
                    </DialogPortal>
                </Dialog>
            )}

            {/* ─── Full Template Chat Preview Modal ─────────────────────── */}
            {!!previewTemplate && (
                <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
                    <DialogPortal>
                        <DialogOverlay className="z-[100] bg-black/80 backdrop-blur-sm" />
                        <div
                            className="fixed top-1/2 left-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-xl overflow-hidden rounded-2xl border border-border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 flex flex-col"
                            style={{ background: 'var(--card)', maxHeight: '90vh' }}
                        >
                            {/* WhatsApp Header */}
                            <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm shadow-inner">
                                        Bot
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm leading-tight truncate max-w-[240px] sm:max-w-[320px]">{previewTemplate.name}</h3>
                                        <p className="text-[11px] text-white/75">WhatsApp Message Preview</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreviewTemplate(null)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/20 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* WhatsApp Chat Body */}
                            <div
                                className="flex-1 p-5 overflow-y-auto flex flex-col justify-end min-h-[360px] relative"
                                style={{ backgroundColor: '#efeae2', backgroundImage: 'radial-gradient(#d3cbbd 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                            >
                                {/* Message Bubble */}
                                <div className="bg-white dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] p-3 rounded-xl rounded-tl-none shadow-md max-w-[92%] self-start flex flex-col gap-2 relative border border-black/5 dark:border-white/5 my-auto">
                                    {/* Attached Image inside Bubble */}
                                    {(() => {
                                        const mediaUrls = getTemplateMediaUrls(previewTemplate);
                                        if (mediaUrls.length > 0) {
                                            return (
                                                <div
                                                    className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 group/img cursor-pointer bg-black/5"
                                                    onClick={(e) => { e.stopPropagation(); setPreviewFile({ url: mediaUrls[0], name: `${previewTemplate.name} Image` }); }}
                                                >
                                                    <img
                                                        src={mediaUrls[0]}
                                                        alt="Template attachment"
                                                        className="w-full max-h-[280px] object-cover rounded-lg group-hover/img:opacity-95 transition-opacity"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                                                        <Eye className="w-4 h-4" /> Click to zoom image
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Message Text */}
                                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed px-0.5" style={{ wordBreak: 'break-word' }}>
                                        {previewTemplate.content}
                                    </p>

                                    {/* Timestamp & Checkmarks */}
                                    <div className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1 flex items-center justify-end gap-1 font-sans">
                                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        <span className="text-[#53bdeb] font-bold">✓✓</span>
                                    </div>

                                    {/* Interactive Buttons */}
                                    {(() => {
                                        let btns: any[] = [];
                                        try {
                                            if (previewTemplate.buttons_config) btns = JSON.parse(previewTemplate.buttons_config);
                                        } catch {}
                                        if (btns.length > 0) {
                                            return (
                                                <div className="flex flex-col gap-1.5 pt-2 mt-1 border-t border-black/10 dark:border-white/10">
                                                    {btns.map((b: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="bg-[#f0f2f5] dark:bg-[#111b21] text-[#00a884] dark:text-[#00a884] py-2 px-3 rounded-lg text-center text-xs font-bold shadow-sm flex items-center justify-center gap-2 border border-black/5 dark:border-white/5 hover:opacity-90 transition-opacity"
                                                        >
                                                            <span>{b.type === 'url' ? '🔗' : b.type === 'phone' ? '📞' : '↩️'}</span>
                                                            <span className="truncate">{b.text || b.display_text || 'Button'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="px-4 py-3 border-t border-border bg-secondary/30 flex items-center justify-between shrink-0">
                                <span className="text-xs text-muted-foreground italic">Tip: Click the image inside the chat to view full resolution.</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setPreviewTemplate(null); openEdit(previewTemplate); }}>
                                        Edit Template
                                    </Button>
                                    <Button size="sm" onClick={() => setPreviewTemplate(null)}>
                                        Done
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogPortal>
                </Dialog>
            )}
        </div>
    );
}
