const fs = require('fs');

const content = `'use client';

import React, { useEffect, useState } from 'react';
import { getQuickReplies, addQuickReply, updateQuickReply, deleteQuickReply, toggleQuickReply } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Edit2, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function QuickReplies() {
    const [replies, setReplies] = useState<any[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newReply, setNewReply] = useState({ triggerKey: '', label: '', response: '' });

    useEffect(() => {
        fetchReplies();
    }, []);

    const fetchReplies = () => {
        getQuickReplies().then(setReplies).catch(console.error);
    };

    const handleAddOrEdit = async () => {
        if (!newReply.triggerKey || !newReply.label || !newReply.response) {
            return toast.error('Trigger, label, and response are required');
        }
        try {
            if (editingId) {
                await updateQuickReply(editingId, { triggerKey: newReply.triggerKey, label: newReply.label, response: newReply.response });
                toast.success('Quick reply updated');
            } else {
                await addQuickReply({ triggerKey: newReply.triggerKey, label: newReply.label, response: newReply.response });
                toast.success('Quick reply saved');
            }
            setIsAddOpen(false);
            setEditingId(null);
            setNewReply({ triggerKey: '', label: '', response: '' });
            fetchReplies();
        } catch (error) {
            toast.error(editingId ? 'Failed to update quick reply' : 'Failed to save quick reply');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this quick reply?')) return;
        try {
            await deleteQuickReply(id);
            toast.success('Quick reply deleted');
            fetchReplies();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            await toggleQuickReply(id, enabled);
            setReplies(prev => prev.map(r => r.id === id ? { ...r,                 toast.succes      } catch (error) {
            toast.error('Failed to toggle status');
        }
    };

    const openEditModal = (r: any) => {
        setEditingId(r.id);
        setNewReply({ triggerKey: r.trigger_key, label: r.button_label || r.label || '', response: r.response });
        setIsAddOpen(true);
    };

    return (
        <div className="p-6         }
    };

    const handleDelete = asyn">
            <div className="flex justify-between items-center">
                <div>
                    <h1 classNa        try {
            awaig-tight">Quick Replies</h1>
                    <p className="text-muted-foreground">Automated responses to specific keywords</p>
                </div>
                <Button onClick={() => {
                    setEditingId(null);
                    setNewReply({ triggerKey: '', label: '', response: '' });
                    setIsAddOpen(true);
                }} classNam            toast.err          <Plus className="w-4 h-4" /> Add Quick Reply
                </Button>
            </div>

            {replies.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center borde        setIsA                 <Zap className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold">No quick replies found</h3>
                    <p className="text-muted-foreground mb-6">Create triggers that automatically respond when contacts send a specific keyword.</p>
                    <Button onClick={() => {
                        setEditingId(null);
                        setNewReply({ triggerKey: '', label: '', response: '' });
                        setIsAddOpen(true);
                    }}>Create Quick Reply</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {replies.map(r => (
                        <Card key={r.id} className={\`flex flex-col \${!r.enabled ? 'opacity-70' : ''}\`}>
                            <CardHeader className="bg-secondary/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-mono tracking-tight text-primary">
                                            "{r.trigger_key}"
                                        </CardTitle>
                                        <CardDescription className="mt-1">{r.button_label || r.label}</CardDescription>
                                    </div>
                                    <Switch
                                        checked={r.enabled === 1 || r.enabled === true}
                                        onCheckedChange={(c) => handleToggle(r.id, c)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1">
                                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                    {r.response.length > 150 ? r.response.substring(0, 150) + '...' : r.response}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t p-4 flex justify-end gap-2 bg-secondary/10">
                                <Button variant="outline" size="sm" onClick={() => openEditModal(r)}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Quick Reply' : 'Add Quick Reply'}</DialogTitle>
                        <DialogDescription>Define keyword triggers that automatically send canned responses.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Trigger Keyword</Label>
                            <Input
                                placeholder="e.g. pricing, menu, help"
                                value={newReply.triggerKey}
                                onChange={(e) => setNewReply({ ...newReply, triggerKey: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Button Label (shown in UI)</Label>
                            <Input
                                placeholder="e.g. 📋 View Pricing"
                                value={newReply.label}
                                onChange={(e) => setNewReply({ ...newReply, label: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Response Message</Label>
                            <Textarea
                                rows={4}
                                placeholder="The message to send when the trigger is matched..."
                                value={newReply.response}
                                onChange={(e) => setNewReply({ ...newReply, response: e.target.value })}
                            />
                        </div>
                        <Button className="w-full" onClick={handleAddOrEdit}>{editingId ? 'Update Quick Reply' : 'Save Quick Reply'}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
`;
fs.writeFileSync('frontend/src/app/quickreplies.tsx', content);
