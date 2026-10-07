
'use client';

import * as React from 'react';
import {
  CreditCard,
  Settings,
  User,
  Package,
  ArrowDownToDot,
  ArrowUpFromDot,
  IndianRupee,
  Search,
  LayoutDashboard
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

import { useDebounce } from '@/hooks/use-debounce';
import { searchGlobal, type SearchResult } from '@/lib/actions/search';
import { logError } from '@/lib/error-logger';

export function CommandSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  
  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [recents, setRecents] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch Recents on Open
  React.useEffect(() => {
    if (open && recents.length === 0) {
       const fetchRecents = async () => {
           const supabase = createClient();
           const [
             { data: customersData },
             { data: recordsData },
             { data: paymentsData }
           ] = await Promise.all([
              supabase.from('customers').select('id, name, phone, village').limit(5).order('name'),
              supabase.from('storage_records').select('id, record_number, commodity_description, storage_start_date').limit(5).order('created_at', { ascending: false }),
              supabase.from('payments').select('id, payment_number, amount, type, payment_date').limit(5).order('created_at', { ascending: false })
           ]);
           
           const newRecents: SearchResult[] = [];
           
           if (customersData) {
               customersData.forEach((c: any) => newRecents.push({
                   id: c.id, type: 'customer', title: c.name, 
                   subtitle: c.phone, url: `/customers/${c.id}`
               }));
           }
           if (recordsData) {
               recordsData.forEach((r: any) => newRecents.push({
                   id: r.id, type: 'record', title: `Record #${r.record_number}`, 
                   subtitle: r.commodity_description, url: `/storage?id=${r.id}`
               }));
           }
            if (paymentsData) {
               paymentsData.forEach((p: any) => newRecents.push({
                   id: p.id, type: 'payment', title: `Receipt #${p.payment_number}`, 
                   subtitle: `₹${p.amount}`, url: `/payments/history?id=${p.id}`
               }));
           }
           setRecents(newRecents);
       };
       fetchRecents();
    }
  }, [open]);

  // Search Effect
  React.useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
          if (debouncedQuery.length >= 2) {
              const data = await searchGlobal(debouncedQuery);
              setResults(data);
          } else {
              setResults([]);
          }
      } catch (error) {
          logError(error, { operation: 'commandSearch' });
      } finally {
          setLoading(false);
      }
    };

    if (open) {
        fetchResults();
    }
  }, [debouncedQuery, open]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const displayList = query.length >= 2 ? results : recents;
  const customers = displayList.filter(r => r.type === 'customer');
  const records = displayList.filter(r => r.type === 'record');
  const payments = displayList.filter(r => r.type === 'payment');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9 md:w-auto md:px-4 md:py-2 relative md:justify-start text-sm text-muted-foreground"
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex">Search website...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
            placeholder="Type to search customers, records, or invoices..." 
            value={query}
            onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {/* Navigation Suggestions (Always Visible if query is empty OR mixed in?) */}
          {query.length === 0 && (
             <CommandGroup heading="Suggestions">
                <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/inflow'))}>
                <ArrowDownToDot className="mr-2 h-4 w-4" />
                <span>New Inflow</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/outflow'))}>
                    <ArrowUpFromDot className="mr-2 h-4 w-4" />
                <span>New Outflow</span>
                </CommandItem>
                 <CommandItem onSelect={() => runCommand(() => router.push('/storage'))}>
                <Package className="mr-2 h-4 w-4" />
                <span>Storage</span>
                </CommandItem>
                 <CommandItem onSelect={() => runCommand(() => router.push('/payments/pending'))}>
                <IndianRupee className="mr-2 h-4 w-4" />
                <span>Pending Payments</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
                </CommandItem>
            </CommandGroup>
          )}

          {loading && <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>}
          
          {customers.length > 0 && (
            <CommandGroup heading="Customers">
                {customers.map(c => (
                    <CommandItem key={c.id} onSelect={() => runCommand(() => router.push(c.url))}>
                        <User className="mr-2 h-4 w-4" />
                        <span>{c.title}</span>
                        {c.subtitle && <span className="ml-2 text-xs text-muted-foreground">({c.subtitle})</span>}
                    </CommandItem>
                ))}
            </CommandGroup>
          )}

           {records.length > 0 && (
            <CommandGroup heading="Storage Records">
                {records.map(r => (
                    <CommandItem key={r.id} onSelect={() => runCommand(() => router.push(r.url))}>
                        <Package className="mr-2 h-4 w-4" />
                        <span>{r.title}</span>
                        {r.subtitle && <span className="ml-2 text-xs text-muted-foreground">({r.subtitle})</span>}
                    </CommandItem>
                ))}
            </CommandGroup>
          )}

           {payments.length > 0 && (
            <CommandGroup heading="Payments">
                {payments.map(p => (
                    <CommandItem key={p.id} onSelect={() => runCommand(() => router.push(p.url))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>{p.title}</span>
                        {p.subtitle && <span className="ml-2 text-xs text-muted-foreground">({p.subtitle})</span>}
                    </CommandItem>
                ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
