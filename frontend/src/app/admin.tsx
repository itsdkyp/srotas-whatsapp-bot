'use client';

import React, { useEffect, useState } from 'react';
import { generateAdminKey, getAdminHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Shield, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function Admin() {
    const [history, setHistory] = useState<any[]>([]);
    const [customDays, setCustomDays] = useState('');
    const [generatedKey, setGeneratedKey] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchHistory = () => {
        getAdminHistory().then(setHistory).catch(console.error);
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleGenerate = async (days: number) => {
        try {
            setLoading(true);
            const res = await generateAdminKey(days);
            setGeneratedKey(res);
            toast.success('Key generated successfully');
            fetchHistory();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate key');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 w-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-purple-500 flex items-center gap-2">
                    <Shield className="w-8 h-8" /> License Manager
                </h1>
                <p className="text-muted-foreground mt-1">Admin Panel · Easter Egg Access Only</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 border-purple-500/30 bg-purple-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-purple-500" /> Generate Key
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label>Quick Duration</Label>
                            <div className="flex flex-wrap gap-2">
                                {[30, 60, 90, 180, 365, 3650].map(days => (
                                    <Button key={days} variant="outline" size="sm" onClick={() => handleGenerate(days)} disabled={loading}>
                                        {days === 3650 ? '10 Years' : `${days} Days`}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label>Custom Days</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="e.g. 45"
                                    value={customDays}
                                    onChange={e => setCustomDays(e.target.value)}
                                    className="max-w-[120px]"
                                />
                                <Button onClick={() => handleGenerate(parseInt(customDays))} disabled={!customDays || loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                                    Generate
                                </Button>
                            </div>
                        </div>

                        {generatedKey && (
                            <div className="mt-6 p-4 bg-background rounded-lg border border-purple-500/30 space-y-3">
                                <div className="text-xs text-purple-500 font-bold uppercase tracking-wider">Generated Key</div>
                                <div className="flex gap-2">
                                    <Input readOnly value={generatedKey.key} className="font-mono text-xs" />
                                    <Button size="icon" variant="secondary" onClick={() => copyToClipboard(generatedKey.key)}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Valid for {generatedKey.days} days. Expires {generatedKey.expiryDate}.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Issued Keys History</CardTitle>
                            <CardDescription>Recently generated license keys</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchHistory}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Key</TableHead>
                                    <TableHead>Days</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead>Generated</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">No keys generated yet</TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((h, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs flex items-center justify-between group">
                                                {h.key.substring(0, 8)}...{h.key.substring(h.key.length - 8)}
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(h.key)}>
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </TableCell>
                                            <TableCell>{h.days}</TableCell>
                                            <TableCell>{h.expiryDate}</TableCell>
                                            <TableCell className="text-muted-foreground">{new Date(h.generatedAt).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
