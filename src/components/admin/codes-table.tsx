'use client';

import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useUnifiedToast } from "@/components/shared/toast-provider";

interface Code {
    id: string;
    code: string;
    status: 'available' | 'used';
    duration_days: number;
    created_at: string;
    used_at?: string;
    notes?: string;
    plans: {
        name: string;
        tier: string;
    };
    warehouses?: {
        name: string;
        location: string;
    } | null;
}

interface CodesTableProps {
    codes: Code[];
}

export function CodesTable({ codes }: CodesTableProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { success } = useUnifiedToast();

    const handleCopy = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        success("Copied", "Code copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {codes.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            No codes generated yet.
                        </CardContent>
                    </Card>
                ) : (
                    codes.map((code) => (
                        <Card key={code.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono font-semibold text-sm tracking-wide break-all">
                                            {code.code}
                                        </div>
                                        {code.notes && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                {code.notes}
                                            </p>
                                        )}
                                    </div>
                                    {code.status === 'available' ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                                            Available
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 shrink-0">
                                            Redeemed
                                        </Badge>
                                    )}
                                </div>
                                
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Plan:</span>
                                        <span className="font-medium">{code.plans.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tier:</span>
                                        <span className="capitalize">{code.plans.tier}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span>{code.duration_days} Days</span>
                                    </div>
                                    {code.status === 'used' && code.warehouses && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Redeemed By:</span>
                                                <span className="font-medium">{code.warehouses.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Redeemed On:</span>
                                                <span>{code.used_at ? format(new Date(code.used_at), 'dd MMM yyyy') : '-'}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Created:</span>
                                        <span>{format(new Date(code.created_at), 'dd MMM yyyy')}</span>
                                    </div>
                                </div>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleCopy(code.code, code.id)}
                                    className="w-full"
                                >
                                    {copiedId === code.id ? (
                                        <>
                                            <Check className="h-4 w-4 mr-2 text-emerald-600" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy Code
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Redeemed By</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {codes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    No codes generated yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            codes.map((code) => (
                                <TableRow key={code.id}>
                                    <TableCell className="font-mono font-medium tracking-wide">
                                        {code.code}
                                        {code.notes && (
                                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]" title={code.notes}>
                                                {code.notes}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{code.plans.name}</span>
                                            <span className="text-xs text-muted-foreground capitalize">{code.plans.tier} • {code.duration_days} Days</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {code.status === 'available' ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                Available
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                                Redeemed
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {code.status === 'used' && code.warehouses ? (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{code.warehouses.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                     {code.used_at ? format(new Date(code.used_at), 'dd MMM yyyy') : '-'}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(code.created_at), 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleCopy(code.code, code.id)}
                                            className="h-8 w-8 hover:bg-slate-100"
                                        >
                                            {copiedId === code.id ? (
                                                <Check className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-slate-500" />
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
