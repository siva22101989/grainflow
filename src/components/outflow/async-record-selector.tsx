"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { findRecordsAction } from '@/lib/actions/storage/records';
import { logError } from '@/lib/error-logger';

interface AsyncRecordSelectorProps {
    onSelect: (recordId: string) => void;
}

export function AsyncRecordSelector({ onSelect }: AsyncRecordSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [records, setRecords] = React.useState<any[]>([])
  const [selectedRecord, setSelectedRecord] = React.useState<any | null>(null) // Track the most recent query to prevent race conditions
  // Initialize to null so the first run (query="") detects a change and fetches defaults
  const lastQueryRef = React.useRef<string | null>(null);

  React.useEffect(() => {
      const timer = setTimeout(() => {
          if (query !== lastQueryRef.current) {
               fetchRecords(query);
          }
      }, 300);
      return () => clearTimeout(timer);
  }, [query]);

  const fetchRecords = async (search: string) => {
      lastQueryRef.current = search;
      setLoading(true);
      try {
          const results = await findRecordsAction(search);
          if (search === lastQueryRef.current) {
             setRecords(results);
          }
      } catch (e) {
          logError(e, { operation: 'asyncRecordSelector.search' });
      } finally {
          if (search === lastQueryRef.current) {
             setLoading(false);
          }
      }
  };

  const handleSelect = (record: any) => {
      setValue(String(record.id))
      setSelectedRecord(record)
      onSelect(String(record.id))
      setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="record-selector-trigger"
        >
          {selectedRecord
            ? selectedRecord.customerName 
            : "Search customer or record..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input 
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                data-testid="record-search-input"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
            {loading && <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-4 w-4"/></div>}
            
            {!loading && records.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No records found.</div>
            )}

            {!loading && records.length > 0 && (
                <div className="flex flex-col gap-1">
                    {records.map((record) => (
                        <div
                            key={record.id}
                            /* Use onMouseDown to prevent focus loss */
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(record);
                            }}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                value === String(record.id) && "bg-accent text-accent-foreground"
                            )}
                            data-testid="record-option"
                        >
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                value === String(record.id) ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <div className="flex flex-col">
                                <span className="font-semibold">{record.customerName}</span>
                                <span className="text-xs text-muted-foreground">#{record.recordNumber} • {record.location || 'No Location'} • {record.bags} bags</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
      </PopoverContent>
    </Popover>
  )
}
