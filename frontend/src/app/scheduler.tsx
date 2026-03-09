'use client';

import React, { useEffect, useState } from 'react';
import { getSchedules, addSchedule, deleteSchedule, toggleSchedule, getSessions, getGroups, getTemplates } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Plus, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

export function Scheduler() {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [allSessions, setAllSessions] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        name: '',
        sessionId: '',
        groupName: '',
        template: '',
        frequency: 'once',
        dayOfWeek: 1,
        dayOfMonth: 1,
        sendTime: '09:00'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sch, sess, grp, tpl] = await Promise.all([
                getSchedules(), getSessions(), getGroups(), getTemplates()
            ]);
            setSchedules(sch);
            const readySessions = sess.filter((s: any) => s.status === 'ready');
            setSessions(readySessions);
            setAllSessions(sess);
            if (readySessions.length > 0 && !newSchedule.sessionId) {
                setNewSchedule(prev => ({ ...prev, sessionId: readySessions[0].id.toString() }));
            }
            setGroups(grp);
            setTemplates(tpl);
        } catch (error) {
            toast.error('Failed to load scheduler data');
        }
    };

    const handleAdd = async () => {
        if (!newSchedule.name || !newSchedule.sessionId || !newSchedule.groupName || !newSchedule.template) {
            return toast.error('Please fill in all required fields');
        }

        try {
            await addSchedule(newSchedule);
            toast.success('Schedule created');
            setIsAddOpen(false);
            setNewSchedule({
                name: '', sessionId: '', groupName: '', template: '', frequency: 'once', dayOfWeek: 1, dayOfMonth: 1, sendTime: '09:00'
            });
            fetchData();
        } catch (error) {
            toast.error('Failed to create schedule');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this schedule?')) return;
        try {
            await deleteSchedule(id);
            toast.success('Schedule deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete schedule');
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            await toggleSchedule(id, enabled);
            setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_enabled: enabled } : s));
        } catch (error) {
            toast.error('Failed to toggle status');
        }
    };

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Scheduled Campaigns</h1>
                    <p className="text-muted-foreground">Automate your messages to send at specific times</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> New Schedule
                </Button>
            </div>

            {schedules.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                    <CalendarClock className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-bold">No schedules found</h3>
                    <p className="text-muted-foreground mb-6">Create a schedule to automate your messaging campaigns.</p>
                    <Button onClick={() => setIsAddOpen(true)}>Create Schedule</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schedules.map(s => (
                        <Card key={s.id} className={`flex flex-col ${!s.is_enabled ? 'opacity-70' : ''}`}>
                            <CardHeader className="bg-secondary/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{s.name}</CardTitle>
                                        <CardDescription className="mt-1 capitalize text-primary font-medium">
                                            {s.frequency} at {s.send_time}
                                        </CardDescription>
                                    </div>
                                    <Switch
                                        checked={s.is_enabled === 1 || s.is_enabled === true}
                                        onCheckedChange={(c) => handleToggle(s.id, c)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Group:</span>
                                    <span className="font-medium">{s.group_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Session:</span>
                                    <span className="font-medium truncate max-w-[120px]">{allSessions.find(ses => ses.id === s.session_id)?.name || s.session_id || 'Unknown Device'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Last Run:</span>
                                    <span>{s.last_run ? new Date(s.last_run).toLocaleString() : 'Never'}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t p-4 flex justify-end bg-secondary/10">
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Schedule</DialogTitle>
                        <DialogDescription>Set up an automated messaging campaign.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Schedule Name</Label>
                            <Input placeholder="e.g. Weekly Newsletter" value={newSchedule.name} onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>From Device</Label>
                                <Select value={newSchedule.sessionId} onValueChange={v => setNewSchedule({ ...newSchedule, sessionId: v || '' })}>
                                    <SelectTrigger>
                                        <span className="truncate">
                                            {newSchedule.sessionId ? (sessions.find(s => s.id.toString() === newSchedule.sessionId)?.name || newSchedule.sessionId) : "Select device"}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sessions.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>To Group</Label>
                                <Select value={newSchedule.groupName} onValueChange={v => setNewSchedule({ ...newSchedule, groupName: v || '' })}>
                                    <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Message Template</Label>
                            <Select value={newSchedule.template} onValueChange={v => setNewSchedule({ ...newSchedule, template: v || '' })}>
                                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                                <SelectContent>
                                    {templates.map(t => <SelectItem key={t.id} value={t.content}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select value={newSchedule.frequency} onValueChange={v => setNewSchedule({ ...newSchedule, frequency: v || 'once' })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="once">Once</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Time</Label>
                                <Input type="time" value={newSchedule.sendTime} onChange={e => setNewSchedule({ ...newSchedule, sendTime: e.target.value })} />
                            </div>
                        </div>

                        {newSchedule.frequency === 'weekly' && (
                            <div className="space-y-2">
                                <Label>Day of Week</Label>
                                <Select value={newSchedule.dayOfWeek.toString()} onValueChange={v => setNewSchedule({ ...newSchedule, dayOfWeek: parseInt(v || '1') || 1 })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Sunday</SelectItem>
                                        <SelectItem value="1">Monday</SelectItem>
                                        <SelectItem value="2">Tuesday</SelectItem>
                                        <SelectItem value="3">Wednesday</SelectItem>
                                        <SelectItem value="4">Thursday</SelectItem>
                                        <SelectItem value="5">Friday</SelectItem>
                                        <SelectItem value="6">Saturday</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {newSchedule.frequency === 'monthly' && (
                            <div className="space-y-2">
                                <Label>Day of Month (1-28)</Label>
                                <Input type="number" min="1" max="28" value={newSchedule.dayOfMonth} onChange={e => setNewSchedule({ ...newSchedule, dayOfMonth: parseInt(e.target.value) || 1 })} />
                            </div>
                        )}

                        <Button className="w-full mt-4" onClick={handleAdd}>Save Schedule</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
