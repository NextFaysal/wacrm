'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

interface ParsedRow {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  regular_price?: number;
  cost_price?: number;
  stock_quantity: number;
  category?: string;
  unit?: string;
  description?: string;
}

export function CsvImportModal({
  open,
  onOpenChange,
  onImportSuccess,
}: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSample = () => {
    const headers = [
      'name',
      'sku',
      'barcode',
      'price',
      'regular_price',
      'cost_price',
      'stock_quantity',
      'category',
      'unit',
      'description',
    ];
    const sampleRow1 = [
      '"Premium Cotton Panjabi"',
      '"PANJ-01"',
      '"890123456789"',
      '1850',
      '2400',
      '1100',
      '25',
      '"Fashion & Apparel"',
      '"pcs"',
      '"100% fine cotton traditional embroidery panjabi"',
    ];
    const sampleRow2 = [
      '"Wireless Bluetooth Earbuds Pro"',
      '"EAR-PRO-02"',
      '"890987654321"',
      '1450',
      '2200',
      '850',
      '40',
      '"Electronics & Gadgets"',
      '"pcs"',
      '"Active noise cancelling with 24h battery life"',
    ];

    const csvContent = [headers.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'products-import-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample template downloaded');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a valid .csv file');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          toast.error('File appears to be empty');
          setIsParsing(false);
          return;
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toast.error('CSV file has no data rows');
          setIsParsing(false);
          return;
        }

        // Basic CSV line tokenizer that respects quotes
        const parseLine = (line: string) => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result.map((col) => col.replace(/^"(.*)"$/, '$1').trim());
        };

        const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
        const nameIdx = headers.indexOf('name');
        const skuIdx = headers.indexOf('sku');
        const barcodeIdx = headers.indexOf('barcode');
        const priceIdx = headers.indexOf('price');
        const regPriceIdx = headers.indexOf('regular_price');
        const costPriceIdx = headers.indexOf('cost_price');
        const stockIdx = headers.indexOf('stock_quantity');
        const catIdx = headers.indexOf('category');
        const unitIdx = headers.indexOf('unit');
        const descIdx = headers.indexOf('description');

        if (nameIdx === -1 || priceIdx === -1) {
          toast.error('CSV must contain at least "name" and "price" columns');
          setIsParsing(false);
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (!cols[nameIdx] || !cols[priceIdx]) continue;

          rows.push({
            name: cols[nameIdx],
            sku: skuIdx !== -1 ? cols[skuIdx] : undefined,
            barcode: barcodeIdx !== -1 ? cols[barcodeIdx] : undefined,
            price: parseFloat(cols[priceIdx]) || 0,
            regular_price: regPriceIdx !== -1 && cols[regPriceIdx] ? parseFloat(cols[regPriceIdx]) : undefined,
            cost_price: costPriceIdx !== -1 && cols[costPriceIdx] ? parseFloat(cols[costPriceIdx]) : undefined,
            stock_quantity: stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : 10,
            category: catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'General',
            unit: unitIdx !== -1 && cols[unitIdx] ? cols[unitIdx] : 'pcs',
            description: descIdx !== -1 ? cols[descIdx] : undefined,
          });
        }

        setParsedRows(rows);
        toast.success(`Successfully parsed ${rows.length} product(s)`);
      } catch (err) {
        console.error('CSV Parse error:', err);
        toast.error('Failed to parse CSV file');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleBulkImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('No valid products to import');
      return;
    }

    try {
      setIsImporting(true);
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedRows }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully imported ${data.imported_count || parsedRows.length} products!`);
        onImportSuccess();
        onOpenChange(false);
        setFile(null);
        setParsedRows([]);
      } else {
        toast.error(data.error || 'Failed to import products');
      }
    } catch {
      toast.error('Network error during bulk import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88vh] flex flex-col p-4 sm:p-6 rounded-2xl border shadow-2xl bg-card">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">বাল্ক প্রোডাক্ট ইমপোর্ট (CSV / Excel)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                এক ক্লিকে শত শত পণ্য, মূল্য, ভ্যারিয়েন্ট, খরচ ও স্টক ডাটা যুক্ত করুন
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
          {/* Top Actions: Template Download */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border bg-muted/30">
            <div className="text-xs">
              <span className="font-semibold text-foreground">Need a starting template?</span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Download our pre-formatted spreadsheet with all columns ready.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="text-xs gap-1.5 h-8 border-emerald-600/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Template (.csv)</span>
            </Button>
          </div>

          {/* Upload Dropzone */}
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-card hover:bg-muted/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground">Click to select CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">Supports standard CSV exports from Excel or Google Sheets</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} products ready
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Preview ({parsedRows.length} items)</span>
                <span className="text-[11px] text-muted-foreground">Ready to insert</span>
              </div>
              <div className="rounded-lg border border-border/60 overflow-hidden max-h-56 overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">Cost</th>
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-2 font-medium truncate max-w-[150px]">{r.name}</td>
                        <td className="p-2 text-muted-foreground">{r.category || 'General'}</td>
                        <td className="p-2 text-right font-semibold">৳{r.price}</td>
                        <td className="p-2 text-right text-muted-foreground">৳{r.cost_price || 0}</td>
                        <td className="p-2 text-right font-mono">{r.stock_quantity}</td>
                        <td className="p-2 font-mono text-[10px] text-muted-foreground">{r.sku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleBulkImport}
            disabled={parsedRows.length === 0 || isImporting}
            className="gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isImporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Import {parsedRows.length} Product(s)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
