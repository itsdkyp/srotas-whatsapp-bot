'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
    getContacts, getGroups, addGroup, deleteGroup, renameGroup,
    addContact, deleteContact, importContacts, uploadContactsCsv,
    syncWhatsAppContacts, getWhatsAppGroups, grabGroupContacts, moveToGroup, getSessions
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, Plus, Upload, Download, RefreshCw, Trash2, FolderPlus, FolderOpen, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export function Contacts() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 50;

    const [search, setSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [newContact, setNewContact] = useState({ phone: '', name: '', company: '', group: 'default' });

    const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
    const [isRenameGroupOpen, setIsRenameGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importTargetGroup, setImportTargetGroup] = useState('default');

    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [syncTab, setSyncTab] = useState<'personal' | 'groups'>('personal');
    const [syncSession, setSyncSession] = useState('');
    const [syncTargetGroup, setSyncTargetGroup] = useState('default');
    const [waGroups, setWaGroups] = useState<any[]>([]);
    const [selectedWaGroup, setSelectedWaGroup] = useState('');
    const [loadingWaGroups, setLoadingWaGroups] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData(page, search);
    }, [selectedGroup, page]);

    const fetchData = async (currentPage = page, currentSearch = search) => {
        setLoading(true);
        try {
            const [g, cData, s] = await Promise.all([
                getGroups(),
                getContacts(selectedGroup === 'all' ? undefined : selectedGroup, currentSearch, currentPage, limit),
                getSessions()
            ]);
            setGroups(g);

            // Handle both paginated response and fallback unpaginated response
            const contactsList = cData.contacts || (Array.isArray(cData) ? cData : []);
            const totalCount = cData.total !== undefined ? cData.total : contactsList.length;

            setContacts(contactsList);
            setTotal(totalCount);
            setSessions(s);

            if (!g.some((gr: any) => gr.name === newContact.group)) {
                setNewContact(prev => ({ ...prev, group: g[0]?.name || 'default' }));
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        setPage(1);
        fetchData(1, search);
    };

    const handleAddContact = async () => {
        if (!newContact.phone.trim()) return toast.error('Phone is required');
        try {
            await addContact(newContact);
            toast.success('Contact added');
            setIsAddContactOpen(false);
            setNewContact({ phone: '', name: '', company: '', group: groups[0]?.name || 'default' });
            fetchData();
        } catch (error) {
            toast.error('Failed to add contact');
        }
    };

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return toast.error('Group name required');
        try {
            await addGroup(newGroupName);
            toast.success('Group created');

            // If contacts were selected, move them to the new group
            if (selectedContacts.length > 0) {
                await moveToGroup(selectedContacts, newGroupName, false);
                toast.success(`Moved ${selectedContacts.length} contacts to ${newGroupName}`);
                setSelectedContacts([]);
            }

            setIsAddGroupOpen(false);
            setNewGroupName('');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create group');
        }
    };

    const handleRenameGroup = async () => {
        if (!newGroupName.trim()) return toast.error('New name required');
        const g = groups.find(g => g.name === selectedGroup);
        if (!g) return;

        try {
            await renameGroup(g.id.toString(), newGroupName);
            toast.success('Group renamed');
            setSelectedGroup(newGroupName);
            setIsRenameGroupOpen(false);
            setNewGroupName('');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to rename group');
        }
    };

    const handleDeleteGroup = async () => {
        if (selectedGroup === 'all') return;
        const g = groups.find(g => g.name === selectedGroup);
        if (!g) return;

        if (!confirm(`Delete group "${selectedGroup}" and all its contacts?`)) return;
        try {
            await deleteGroup(g.id);
            toast.success('Group deleted');
            setSelectedGroup('all');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete group');
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!confirm('Delete this contact?')) return;
        try {
            await deleteContact(id);
            toast.success('Contact deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete contact');
        }
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedContacts(contacts.map(c => c.id));
        } else {
            setSelectedContacts([]);
        }
    };

    const toggleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedContacts(prev => [...prev, id]);
        } else {
            setSelectedContacts(prev => prev.filter(c => c !== id));
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImportFile(e.target.files[0]);
            setIsImportOpen(true);
        }
    };

    const confirmImport = async () => {
        if (!importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const res = await uploadContactsCsv(formData);
            const contactsList = res.contacts || res.validContacts;
            if (contactsList && contactsList.length > 0) {
                await importContacts(contactsList, importTargetGroup);
                toast.success(`Imported ${contactsList.length} contacts successfully`);
            } else {
                toast.error('No valid contacts found in CSV');
            }
            setIsImportOpen(false);
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchData();
        } catch (error) {
            toast.error('Import failed');
        }
    };

    const handleSyncWhatsApp = async () => {
        if (!syncSession) return toast.error('Select a session');
        try {
            if (syncTab === 'personal') {
                const waContacts = await syncWhatsAppContacts(syncSession);
                const formatted = waContacts.map((c: any) => ({
                    phone: c.phone || (c.id && c.id._serialized ? c.id._serialized.split('@')[0] : ''),
                    name: c.name || c.pushname || 'Unknown',
                    company: c.company || '',
                    custom_fields: {}
                }));
                await importContacts(formatted, syncTargetGroup);
                toast.success(`Synced ${formatted.length} contacts`);
            } else {
                if (!selectedWaGroup) return toast.error('Select a WhatsApp group to grab from');
                const groupContacts = await grabGroupContacts(syncSession, selectedWaGroup);
                await importContacts(groupContacts, syncTargetGroup);
                toast.success(`Grabbed ${groupContacts.length} members`);
            }
            setIsSyncOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Sync failed');
        }
    };

    const loadWaGroups = async () => {
        if (!syncSession) return toast.error('Select a session first');
        setLoadingWaGroups(true);
        try {
            const grps = await getWhatsAppGroups(syncSession);
            setWaGroups(grps);
            if (grps.length > 0) setSelectedWaGroup(grps[0].id);
        } catch (error: any) {
            toast.error('Failed to load WhatsApp groups');
        } finally {
            setLoadingWaGroups(false);
        }
    };

    const exportCsv = () => {
        if (total === 0) return toast.error('No contacts to export');
        const qs = selectedGroup === 'all' ? '' : `?group=${encodeURIComponent(selectedGroup)}`;
        window.open(`/api/contacts/export-csv${qs}`, '_blank');
    };

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 flex flex-col h-full w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
                    <p className="text-muted-foreground">Manage your audience and lists</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            className="pl-9 w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button onClick={() => setIsAddContactOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Add
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="gap-2">
                        <Upload className="w-4 h-4" /> Import CSV
                    </Button>
                    <input type="file" accept=".csv,.xlsx" ref={fileInputRef} className="hidden" onChange={handleImportFile} />

                    <Button onClick={() => setIsSyncOpen(true)} variant="secondary" className="gap-2">
                        <Smartphone className="w-4 h-4" /> Sync WA
                    </Button>
                </div>
            </div>

            <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border bg-secondary/10 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <Select value={selectedGroup} onValueChange={(v) => setSelectedGroup(v || 'all')}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Groups" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Groups</SelectItem>
                                {groups.map(g => (
                                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => setIsAddGroupOpen(true)} title="New Group">
                            <FolderPlus className="w-4 h-4 text-primary" />
                        </Button>
                        {selectedGroup !== 'all' && (
                            <>
                                <Button size="icon" variant="ghost" onClick={() => { setNewGroupName(selectedGroup); setIsRenameGroupOpen(true); }} title="Rename Group">
                                    <span className="text-xs font-semibold px-2">✏️</span>
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleDeleteGroup} title="Delete Group">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{contacts.length} contacts</span>
                        {selectedContacts.length > 0 && (
                            <>
                                <span className="text-primary font-medium">{selectedContacts.length} selected</span>
                                <Button size="sm" variant="outline" onClick={() => setIsAddGroupOpen(true)} className="gap-2" title="Move to new group">
                                    <FolderOpen className="w-4 h-4" /> Group Selected
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
                            <Download className="w-4 h-4" /> Export
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="bg-secondary/30 sticky top-0 z-10 backdrop-blur-sm">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">
                                    <Checkbox
                                        checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                                        onCheckedChange={(c) => toggleSelectAll(!!c)}
                                    />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No contacts found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={selectedContacts.includes(c.id)}
                                                onCheckedChange={(checked) => toggleSelect(c.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{c.name || '—'}</TableCell>
                                        <TableCell>+{c.phone}</TableCell>
                                        <TableCell>{c.company || '—'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                {c.group_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(c.id)} className="text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>

                {/* Pagination Controls */}
                {total > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-border bg-secondary/10">
                        <div className="text-sm text-muted-foreground">
                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} contacts
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Add Contact Modal */}
            <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Contact</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Phone (with country code)</Label>
                            <Input placeholder="919876543210" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value.replace(/\D/g, '') })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="John Doe" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Company</Label>
                            <Input placeholder="Acme Inc" value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Group</Label>
                            <Select value={newContact.group} onValueChange={(v) => setNewContact({ ...newContact, group: v || '' })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full" onClick={handleAddContact}>Save Contact</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Group Modal */}
            <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Group Name</Label>
                            <Input placeholder="e.g. leads, partners" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()} />
                        </div>
                        <Button className="w-full" onClick={handleAddGroup}>Create Group</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rename Group Modal */}
            <Dialog open={isRenameGroupOpen} onOpenChange={setIsRenameGroupOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>New Group Name</Label>
                            <Input placeholder="e.g. active-leads" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup()} />
                        </div>
                        <Button className="w-full" onClick={handleRenameGroup}>Rename Group</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Import CSV Modal */}
            <Dialog open={isImportOpen} onOpenChange={(open) => {
                setIsImportOpen(open);
                if (!open && fileInputRef.current) fileInputRef.current.value = '';
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Contacts</DialogTitle>
                        <DialogDescription>Select a target group for the imported contacts.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 border rounded-lg bg-secondary/20 flex items-center gap-3">
                            <div className="p-2 bg-primary/20 text-primary rounded-md"><FileTextIcon className="w-5 h-5" /></div>
                            <div className="overflow-hidden">
                                <p className="font-medium truncate">{importFile?.name}</p>
                                <p className="text-xs text-muted-foreground">{(importFile?.size || 0) / 1024 > 1024 ? `${((importFile?.size || 0) / 1048576).toFixed(2)} MB` : `${((importFile?.size || 0) / 1024).toFixed(1)} KB`}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Import to Group</Label>
                            <Select value={importTargetGroup} onValueChange={(v) => setImportTargetGroup(v || '')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full" onClick={confirmImport}>Confirm Import</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sync WhatsApp Modal */}
            <Dialog open={isSyncOpen} onOpenChange={setIsSyncOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sync WhatsApp Contacts</DialogTitle>
                        <DialogDescription>Fetch your contacts from WhatsApp.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 border-b border-border pb-2">
                        <Button variant={syncTab === 'personal' ? 'default' : 'ghost'} size="sm" onClick={() => setSyncTab('personal')}>
                            Personal Contacts
                        </Button>
                        <Button variant={syncTab === 'groups' ? 'default' : 'ghost'} size="sm" onClick={() => setSyncTab('groups')}>
                            Group Members
                        </Button>
                    </div>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>From Device</Label>
                            <Select value={syncSession} onValueChange={(v) => setSyncSession(v || '')}>
                                <SelectTrigger>
                                    <span className="truncate">
                                        {syncSession ? (sessions.find(s => s.id.toString() === syncSession)?.name || syncSession) : "Select active device"}
                                    </span>
                                </SelectTrigger>
                                <SelectContent>
                                    {sessions.filter(s => s.status === 'ready').map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.phone})</SelectItem>)}
                                    {sessions.filter(s => s.status === 'ready').length === 0 && <SelectItem value="none" disabled>No connected devices</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Import to Group</Label>
                            <Select value={syncTargetGroup} onValueChange={(v) => setSyncTargetGroup(v || '')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {syncTab === 'groups' && (
                            <div className="space-y-2">
                                <Label>WhatsApp Group</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedWaGroup} onValueChange={(v) => setSelectedWaGroup(v || '')}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Click Load Groups &rarr;" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {waGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} ({g.participantCount})</SelectItem>)}
                                            {waGroups.length === 0 && <SelectItem value="none" disabled>No groups loaded</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="secondary" onClick={loadWaGroups} disabled={loadingWaGroups || !syncSession || syncSession === 'none'}>
                                        {loadingWaGroups ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Load Groups'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Button className="w-full" onClick={handleSyncWhatsApp} disabled={!syncSession || syncSession === 'none'}>
                            {syncTab === 'personal' ? '📲 Fetch Contacts' : '👥 Grab Members'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FileTextIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
    );
}
