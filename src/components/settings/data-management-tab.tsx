'use client';

import { restoreFromBackup } from '@/lib/restore-actions';
import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Users, Wheat, Download, Upload, AlertTriangle, Lock, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useCustomers } from "@/contexts/customer-context";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useStaticData } from "@/hooks/use-static-data";
import { toast } from "@/hooks/use-toast";
import { exportFullBackupToExcel, exportSimpleLedgerToExcel, type FullBackupData } from "@/lib/export-utils";

interface DataManagementTabProps {
    userRole?: string;
}

export function DataManagementTab({ userRole }: DataManagementTabProps) {
  const { refreshCustomers } = useCustomers();
  const { refreshMembers } = useTeamMembers();
  const { refresh: refreshStatic } = useStaticData();
  
  const [loading, setLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRefreshCustomers = async () => {
    setLoading('customers');
    await refreshCustomers(true);
    toast({ title: "Customers Synced", description: "Latest customer list fetched from server." });
    setLoading(null);
  };

  const handleRefreshTeam = async () => {
    setLoading('team');
    await refreshMembers();
    toast({ title: "Team Synced", description: "Latest team members fetched from server." });
    setLoading(null);
  };

  const handleRefreshStatic = async () => {
    setLoading('static');
    await refreshStatic();
    setLoading(null);
  };
    
  const handleRefreshAll = async () => {
      setLoading('all');
      await Promise.all([
          refreshCustomers(true),
          refreshMembers(),
          refreshStatic()
      ]);
       toast({ title: "Full Sync Complete", description: "All application data has been refreshed." });
      setLoading(null);
  }

  /** Pull every table for the current warehouse into a single backup object. */
  const fetchBackupData = async (): Promise<FullBackupData> => {
      const supabase = createClient();
      const [
         { data: warehouse },
         { data: customers },
         { data: storage_records },
         { data: withdrawal_transactions },
         { data: unloading_records },
         { data: stock_movements },
         { data: payments },
         { data: expenses },
         { data: crops },
         { data: lots },
         { data: sequences },
         { data: notifications }
      ] = await Promise.all([
         supabase.from('warehouses').select('*').single(),
         supabase.from('customers').select('*'),
         supabase.from('storage_records').select('*'),
         supabase.from('withdrawal_transactions').select('*'),
         supabase.from('unloading_records').select('*'),
         supabase.from('stock_movements').select('*'),
         supabase.from('payments').select('*'),
         supabase.from('expenses').select('*'),
         supabase.from('crops').select('*'),
         supabase.from('warehouse_lots').select('*'),
         supabase.from('sequences').select('*'),
         supabase.from('notifications').select('*').limit(1000)
      ]);

      return {
          timestamp: new Date().toISOString(),
          version: '1.2',
          warehouse: warehouse || {},
          sequences: sequences || [],
          customers: customers || [],
          storage_records: storage_records || [],
          withdrawal_transactions: withdrawal_transactions || [],
          unloading_records: unloading_records || [],
          stock_movements: stock_movements || [],
          payments: payments || [],
          expenses: expenses || [],
          crops: crops || [],
          lots: lots || [],
          notifications: notifications || []
      };
  };

  const handleExport = async (format: 'json' | 'excel' | 'statement' = 'json') => {
      const loadingKey =
          format === 'excel' ? 'export-excel' :
          format === 'statement' ? 'export-statement' :
          'export';
      setLoading(loadingKey);
      try {
          const backupData = await fetchBackupData();

          if (format === 'excel') {
              await exportFullBackupToExcel(backupData);
              toast({ title: "Excel Export Successful", description: "Multi-sheet workbook downloaded. Note: this file is view-only — use JSON to restore." });
          } else if (format === 'statement') {
              await exportSimpleLedgerToExcel(backupData);
              toast({ title: "Statement Exported", description: "Simple Inflow/Outflow statement downloaded." });
          } else {
              const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `grainflow-backup-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast({ title: "Export Successful", description: "Your full data backup has been downloaded." });
          }
      } catch (error) {
          console.error("Export failed:", error);
          toast({ title: "Export Failed", description: "Could not fetch data for export.", variant: "destructive" });
      } finally {
          setLoading(null);
      }
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!window.confirm("WARNING: Importing data will attempt to merge records. If IDs match, existing data might be updated. Are you sure you want to proceed?")) {
          e.target.value = ''; // Reset
          return;
      }

      setLoading('import');
      try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          const result = await restoreFromBackup(data);

          if (result.success) {
               toast({ 
                   title: "Restore Complete", 
                   description: `Restored: ${result.details?.customers || 0} Customers, ${result.details?.storage_records || 0} Storage Records.` 
               });
               // Refresh local cache
               handleRefreshAll();
          } else {
               toast({ title: "Restore Failed", description: result.message, variant: "destructive" });
          }

      } catch (error) {
          console.error("Import error:", error);
          toast({ title: "Import Failed", description: "Invalid file format or server error.", variant: "destructive" });
      } finally {
          setLoading(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  return (
    <div className="grid gap-6">
        <Card>
        <CardHeader>
            <CardTitle>Data Synchronization</CardTitle>
            <CardDescription>
            Manually refresh locally cached data. Use this if you suspect data is out of sync.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium">Customer Database</p>
                        <p className="text-sm text-muted-foreground">Cached for 24 hours</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshCustomers} disabled={!!loading} className="w-full sm:w-auto">
                    {loading === 'customers' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                    Sync
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium">Team Members</p>
                        <p className="text-sm text-muted-foreground">Cached for 24 hours</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshTeam} disabled={!!loading} className="w-full sm:w-auto">
                    {loading === 'team' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                    Sync
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Wheat className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium">Crops & Lots</p>
                        <p className="text-sm text-muted-foreground">Cached for 24 hours</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshStatic} disabled={!!loading} className="w-full sm:w-auto">
                    {loading === 'static' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                    Sync
                </Button>
            </div>
            
            <div className="pt-4 flex justify-end">
                <Button onClick={handleRefreshAll} disabled={!!loading} className="w-full sm:w-auto">
                    {loading === 'all' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Database className="w-4 h-4 mr-2"/>}
                    Sync All Data
                </Button>
            </div>

        </CardContent>
        </Card>

        {/* Backup & Export Card */}
        {userRole === 'owner' || userRole === 'super_admin' ? (
            <Card>
                <CardHeader>
                    <CardTitle>Data Backup</CardTitle>
                    <CardDescription>
                        Download a copy of your warehouse data for your records.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border rounded-lg gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Download className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium">Export / Import Data</p>
                                <p className="text-sm text-muted-foreground">JSON (full, restorable), Excel (full, view-only), or Statement (simple Inflow/Outflow only).</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
                            <Button variant="outline" size="sm" onClick={() => handleExport('json')} disabled={!!loading} className="flex-1">
                                {loading === 'export' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2"/>}
                                Export JSON
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={!!loading} className="flex-1">
                                {loading === 'export-excel' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <FileSpreadsheet className="w-4 h-4 mr-2"/>}
                                Export Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport('statement')} disabled={!!loading} className="flex-1">
                                {loading === 'export-statement' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <FileSpreadsheet className="w-4 h-4 mr-2"/>}
                                Export Statement
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleImportClick} disabled={!!loading} className="flex-1">
                                {loading === 'import' ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2"/>}
                                Import
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".json"
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                            <strong>Caution:</strong> Importing data will attempt to merge records. If you are restoring data, ensure you are importing into the correct account to avoid conflicts. <strong>Excel exports are view-only and cannot be re-imported</strong> — use the JSON file for restore.
                        </span>
                    </div>
                </CardContent>
            </Card>
        ) : (
             <Card className="opacity-80">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-muted-foreground flex items-center gap-2">
                            <Lock className="w-5 h-5" />
                            Data Backup
                        </CardTitle>
                    </div>
                    <CardDescription>
                        Restricted to Owner and Super Admin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="p-4 border border-dashed rounded-lg bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
                         Contact your warehouse owner to access data exports.
                     </div>
                </CardContent>
            </Card>
        )}

        <Card className="border-red-200 shadow-sm">
            <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>
                    Irreversible and destructive actions. Please be careful.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border border-red-100 bg-red-50 rounded-lg gap-4">
                    <div>
                        <p className="font-medium text-red-900">Leave Warehouse</p>
                        <p className="text-sm text-red-700">Remove yourself from this warehouse. You will lose access.</p>
                    </div>
                    <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                        Leave Warehouse
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
