'use client';

import React, { useEffect, useState } from 'react';
import { getQuickReplies, addQuickReply, deleteQuickReply, toggleQuickReply } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function QuickReplies() {
    const [replies, setReplies] = useState<any[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newReply, setNewReply] = useState({ triggerKey: '', label: '', response: '' });

    useEffect(() => {
        fetchReplies();
    }, []);

    const fetchReplies = () => {
        getQuickReplies().then(setReplies).catch(console.error);
    };

    const handleAdd = async () => {
        if (!newReply.triggerKey || !newReply.label || !newReply.response) {
            return toast.error('Trigger, label, and response are required');
        }
        try {
            await addQuickReply({ triggerKey: newReply.triggerKey, label: newReply.label, response: newReply.response });
            toast.success('Quick reply saved');
            setIsAddOpen(false);
            setNewReply({ triggerKey: '', label: '', response: '' });
            fetchReplies();
        } catch (error) {
            toast.error('Failed to save quick reply');
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
            setReplies(prev => prev.map(r => r.id === id ? { ...r, is_enabled: enabled } : r));
        } catch (error) {
            toast.error('Failed to toggle status');
        }
    };

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quick Replies</h1>
                    <p className="text-muted-foreground">Automated responses to specific keywords</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Quick Reply
                </Button>
            </div>

            {replies.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                    <Zap className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold">No quick replies found</h3>
                    <p className="text-muted-foreground mb-6">Create triggers that automatically respond when contacts send a specific keyword.</p>
                    <Button onClick={() => setIsAddOpen(true)}>Create Quick Reply</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {replies.map(r => (
                        <Card key={r.id} className={`flex flex-col ${!r.enabled ? 'opacity-70' : ''}`}>
                            <CardHeader className="bg-secondary/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-mono tracking-tight text-primary">
                                            "{r.trigger_key}"
                                        </CardTitle>
                                        <CardDescription className="mt-1">{r.button_label}</CardDescription>
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
                            <CardFooter className="border-t p-4 flex justify-end bg-secondary/10">
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
                        <DialogTitle>Add Quick Reply</DialogTitle>
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
                        <Button className="w-full" onClick={handleAdd}>Save Quick Reply</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
