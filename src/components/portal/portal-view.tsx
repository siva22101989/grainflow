'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, ArrowRight, Clock, CreditCard, Package, History, Download } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { RecordDetailDialog } from './record-detail-dialog';
import { generateConsolidatedPDF } from '@/lib/pdf-generator';
import { PrintButton } from '@/components/common/print-button';

// Types from queries
type PortfolioItem = {
    warehouseName: string;
    warehouseLocation: string;
    warehouseGst?: string;
    totalBags: number;
    totalPaid: number;
    totalBilled: number;
    records: any[];
};

interface PortalViewProps {
    portfolio: PortfolioItem[];
    currentDate?: Date; // Optional to prevent breaking if not passed immediately, but recommended
}

export function PortalView({ portfolio, currentDate = new Date() }: PortalViewProps) {

    // Calculate totals for the header based on ALL records initially? 
    // Usually header shows global "Current" state.
    const grandTotalBags = portfolio.reduce((acc, curr) => acc + curr.totalBags, 0);

    return (
        <div className="space-y-6">
            {/* Mobile-First Header Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 overflow-hidden relative">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Global Portfolio</p>
                            <h1 className="text-5xl font-black tracking-tighter tabular-nums">
                                {grandTotalBags}
                            </h1>
                            <p className="text-blue-100/90 text-sm font-medium mt-1">
                                Current Bags Stored
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                                <Package className="h-8 w-8 text-white" />
                            </div>
                            <button 
                                onClick={() => generateConsolidatedPDF(portfolio)}
                                className="py-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white flex items-center gap-2 active:scale-95"
                            >
                                <Download className="h-4 w-4" />
                                <span className="text-[10px] font-bold">Statement</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-100/80 bg-blue-900/20 w-fit px-3 py-1.5 rounded-full border border-white/5">
                        <MapPin className="h-3 w-3" />
                        Across {portfolio.length} Location{portfolio.length !== 1 ? 's' : ''}
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -top-12 -left-12 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl" />
            </div>

            <Tabs defaultValue="active" className="w-full">
                <div className="flex items-center justify-between px-1 mb-4">
                    <h2 className="text-xl font-black text-foreground tracking-tight">Your Locations</h2>
                    <TabsList className="bg-muted/50 border border-border shadow-sm rounded-full h-9 p-1">
                        <TabsTrigger value="active" className="rounded-full text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 transition-all">
                            Active
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-full text-xs font-bold data-[state=active]:bg-muted data-[state=active]:text-foreground px-4 transition-all">
                            History
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="active" className="space-y-6 mt-0 focus-visible:ring-0">
                    <WarehouseList portfolio={portfolio} type="active" currentDate={currentDate} />
                </TabsContent>

                <TabsContent value="history" className="space-y-6 mt-0 focus-visible:ring-0">
                    <WarehouseList portfolio={portfolio} type="history" currentDate={currentDate} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function WarehouseList({ portfolio, type, currentDate }: { portfolio: PortfolioItem[], type: 'active' | 'history', currentDate: Date }) {
    // Filter logic
    const filteredPortfolio = portfolio.map(wh => {
        const filteredRecords = wh.records.filter(r => 
            type === 'active' ? (r.bags_stored > 0) : (r.bags_stored === 0)
        );
        return {
            ...wh,
            records: filteredRecords,
            // Re-calc totals for display if needed, but usually warehouse details stay same?
            // "Total Bags" header on card should probably reflect the *Active* view always, 
            // OR change based on context. Let's keep card header as "Current Status" and just filter the list.
        };
    }).filter(wh => wh.records.length > 0); // Hide warehouse if no records match filter

    if (filteredPortfolio.length === 0) {
        return (
            <div className="bg-card rounded-[2rem] p-8 text-center border border-border shadow-sm">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                    {type === 'active' ? <Package className="h-6 w-6 text-muted-foreground" /> : <History className="h-6 w-6 text-muted-foreground" />}
                </div>
                <p className="text-foreground font-bold">No {type} records found</p>
                <p className="text-sm text-muted-foreground mt-1">
                    {type === 'active' 
                        ? "You don't have any items currently in storage." 
                        : "No past history found."}
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {filteredPortfolio.map((wh, idx) => (
                <div key={idx} className="bg-card rounded-[2rem] shadow-sm border border-border overflow-hidden">
                    {/* Warehouse Header */}
                    <div className="p-6 border-b border-border/50 bg-muted/30">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1.5">
                                <h3 className="text-lg font-black text-foreground leading-tight">
                                    {wh.warehouseName}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                    {wh.warehouseLocation}
                                </div>
                            </div>
                            {/* Only show 'Live Stats' in Active View */}
                            {type === 'active' && (
                                <div className="text-right">
                                    <p className="text-2xl font-black text-foreground">{wh.totalBags}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">In Stock</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {/* Payment badges mostly relevant for active, but can show for history too if unpaid */}
                            {/* Payment badges */}
                            {type === 'active' && (
                                <>
                                    {wh.totalBilled > wh.totalPaid && (
                                        <Badge variant="outline" className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20 text-[10px] font-bold px-3 py-1 rounded-full animate-pulse">
                                            Due ₹{wh.totalBilled - wh.totalPaid}
                                        </Badge>
                                    )}
                                    {wh.totalPaid > wh.totalBilled && (
                                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20 text-[10px] font-bold px-3 py-1 rounded-full">
                                            Credit ₹{wh.totalPaid - wh.totalBilled}
                                        </Badge>
                                    )}
                                </>
                            )}
                            <Badge variant="secondary" className="bg-background text-muted-foreground border border-border text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                <CreditCard className="h-3 w-3 text-muted-foreground/70" /> 
                                Paid ₹{wh.totalPaid}
                            </Badge>
                        </div>
                    </div>

                    {/* Records List */}
                    <div className="divide-y divide-border/50">
                        {wh.records.map((record) => {
                            // Use prop date to avoid hydration mismatch
                            const age = differenceInDays(currentDate, new Date(record.storage_start_date));
                            
                            return (
                                <div key={record.id} className="p-4 hover:bg-muted/50 transition-colors group">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${type === 'active' ? 'bg-yellow-500/10 border-yellow-500/20 text-2xl' : 'bg-muted border-border grayscale'}`}>
                                                <span className={type === 'history' ? 'opacity-50' : ''}>
                                                    {type === 'active' ? '🌾' : '🏁'}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-baseline gap-2 mb-1.5">
                                                    <p className="text-sm font-bold text-foreground leading-none">{record.crops?.name || 'Crop'}</p>
                                                    <span className="text-[10px] font-medium text-muted-foreground">#{record.record_number || record.id.slice(0, 5)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(record.storage_start_date), 'MMM d')}
                                                    </p>
                                                    {type === 'active' && (
                                                        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {age} Days
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {/* For history, maybe show 0 or 'Withdrawn' */}
                                            {type === 'active' ? (
                                                <>
                                                    <p className="text-sm font-black text-foreground">{record.bags_stored}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest italic">Bags</p>
                                                </>
                                            ) : (
                                                 <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground border-border">
                                                    Withdrawn
                                                 </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pl-[3.25rem]"> {/* Indent to align with text */}
                                        <div className="flex gap-2">
                                            {type === 'active' && (
                                                <div className="flex gap-2">
                                                    {(record.billed - record.paid) > 0 ? (
                                                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2.5 py-1 rounded-md animate-pulse">
                                                            Due ₹{record.billed - record.paid}
                                                        </span>
                                                    ) : (record.billed - record.paid) < 0 ? (
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2.5 py-1 rounded-md">
                                                            Credit ₹{Math.abs(record.billed - record.paid)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <PrintButton 
                                                data={{
                                                    ...record,
                                                    recordNumber: record.record_number, 
                                                    bagsIn: record.bags_stored,         
                                                    bagsStored: record.bags_stored,     
                                                    lotId: record.lot_name,             
                                                    totalRentBilled: record.total_rent_billed,
                                                    hamaliPayable: record.hamali_payable,
                                                    insurancePayable: record.insurance_payable,
                                                    // Warehouse Info from PortfolioItem
                                                    warehouseName: wh.warehouseName,
                                                    warehouseAddress: wh.warehouseLocation,
                                                    gstNo: wh.warehouseGst
                                                }}
                                                type={type === 'active' ? 'inflow' : 'bill'} 
                                                buttonText="Print"
                                                variant="ghost"
                                                size="sm"
                                                className="text-[10px] h-7 px-2"
                                            />
                                            <RecordDetailDialog 
                                                record={record} 
                                                trigger={
                                                    <button className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                                                        View Details <ArrowRight className="h-3 w-3" />
                                                    </button>
                                                } 
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
