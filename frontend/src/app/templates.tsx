
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getTemplates, addTemplate, deleteTemplate, updateTemplate } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Plus, MessageSquare, X, Upload, FileText } from 'lucide-react';
import { uploadMedia } from '@/lib/api';
import { toast } from 'sonner';

export function Templates() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });

    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = () => {
        getTemplates().then(setTemplates).catch(console.error);
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
                mediaPaths: uploadedPaths.length > 0 ? uploadedPaths : null
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
        setNewTemplate(prev => ({ ...prev, content: prev.content + ` {{${tag}}} ` }));
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
                    {templates.map(t => (
                        <Card key={t.id} className="flex flex-col">
                            <CardHeader className="bg-secondary/30 pb-4">
                                <CardTitle className="text-lg">{t.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1">
                                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                    {t.content.length > 150 ? t.content.substring(0, 150) + '...' : t.content}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t p-4 flex justify-end gap-2 bg-secondary/10">
                                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                                    Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) {
                    setEditingId(null);
                    setNewTemplate({ name: '', content: '' });
                    setFiles([]);
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
                                    rows={8}
                                    placeholder="Hello {{name}}, thanks for choosing {{company}}!"
                                    value={newTemplate.content}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                />
                                <div className="flex gap-2 pt-1">
                                    {['name', 'phone', 'company'].map(tag => (
                                        <Button key={tag} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertTag(tag)}>
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

                                {files.length > 0 && (
                                    <div className="space-y-2 mt-2 max-h-32 overflow-y-auto pr-1">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded-md text-sm">
                                                <span className="truncate pr-4">{file.name}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={() => removeFile(idx)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
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
                                {(files.length > 0 || newTemplate.content) && (
                                    <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative flex flex-col gap-1.5">
                                        {files.length > 0 && (
                                            <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                                {files[0].type.startsWith('image/') ? (
                                                    <img src={URL.createObjectURL(files[0])} alt="preview" className="w-full h-auto object-cover max-h-[250px] rounded-md" />
                                                ) : (
                                                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-secondary/40 rounded-md">
                                                        <FileText className="w-4 h-4" /> {files[0].name}
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
                                {!newTemplate.content && files.length === 0 && (
                                    <div className="bg-white dark:bg-[#005c4b] p-2.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                        <span className="text-muted-foreground italic text-sm px-1">Type a message...</span>
                                    </div>
                                )}

                                {/* Subsequent bubbles: Remaining files */}
                                {files.slice(1).map((f, i) => (
                                    <div key={i} className="bg-white dark:bg-[#005c4b] p-1.5 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative">
                                        <div className="relative rounded-md overflow-hidden bg-black/5 border border-border/10">
                                            {f.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-auto object-cover max-h-[250px] rounded-md" />
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
        </div>
    );
}
