'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Send, CheckCircle2, Award, Calendar, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Contact } from '@/types';
import type { Product, Warranty } from '@/types/watch';

interface WarrantyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSendMessage: (text: string) => void;
}

export function WarrantyDialog({
  open,
  onOpenChange,
  contact,
  onSendMessage,
}: WarrantyDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productName, setProductName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [coverageDetails, setCoverageDetails] = useState(
    '1 Year Machine Movement Warranty & 6 Months Free Battery Replacement'
  );
  const [loading, setLoading] = useState(false);
  const [issuedWarranty, setIssuedWarranty] = useState<Warranty | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerName(contact?.name || '');
      setCustomerPhone(contact?.phone || '');
      setSerialNumber(`SN-${Date.now().toString().slice(-6)}`);
      setIssuedWarranty(null);

      // Fetch products for easy dropdown
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          setProducts(data.products || []);
          if (data.products?.length > 0 && !productName) {
            setProductName(data.products[0].name);
          }
        })
        .catch(() => {});
    }
  }, [open, contact]);

  const handleIssueWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !customerName.trim() || !customerPhone.trim()) {
      toast.error('Product name, customer name, and phone are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact?.id,
          product_name: productName.trim(),
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          serial_number: serialNumber.trim(),
          duration_months: Number(durationMonths) || 12,
          coverage_details: coverageDetails.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to issue warranty');
        return;
      }

      setIssuedWarranty(data.warranty);
      toast.success('Digital warranty certificate generated successfully!');
    } catch {
      toast.error('Network error issuing warranty');
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppWarrantyText = (w: Warranty): string => {
    const startDate = new Date(w.starts_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const endDate = new Date(w.expires_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const lines = [
      `🛡️ *ডিজিটাল ওয়ারেন্টি সার্টিফিকেট (Official Warranty Card)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📄 *ওয়ারেন্টি কোড:* \`${w.warranty_code}\``,
      `👤 *গ্রাহকের নাম:* ${w.customer_name}`,
      `📱 *মোবাইল নম্বর:* ${w.customer_phone}`,
      `\n⌚ *ঘড়ির মডেল:* ${w.product_name}`,
      w.serial_number ? `🔢 *সিরিয়াল নম্বর:* \`${w.serial_number}\`` : '',
      `📅 *ইস্যু তারিখ:* ${startDate}`,
      `⏳ *মেয়াদ উত্তীর্ণ:* ${endDate} (${w.duration_months} মাস)`,
      `\n📋 *কভারেজ পলিসি:*`,
      `• ${w.coverage_details}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `যেকোনো টেকনিক্যাল সাপোর্ট, ব্যাটারি পরিবর্তন বা সার্ভিসিংয়ের জন্য এই ওয়ারেন্টি মেসেজ বা কোডটি সংরক্ষণ করুন।`,
      `আমাদের এক্সক্লুসিভ ঘড়ি কালেকশনের সাথে থাকার জন্য আপনাকে আন্তরিক ধন্যবাদ!`,
    ];

    return lines.filter(Boolean).join('\n');
  };

  const handleSendToWhatsApp = () => {
    if (!issuedWarranty) return;
    const text = generateWhatsAppWarrantyText(issuedWarranty);
    onSendMessage(text);
    onOpenChange(false);
    toast.success('Warranty certificate sent to chat!');
  };

  const handleCopyCode = async () => {
    if (!issuedWarranty) return;
    await navigator.clipboard.writeText(issuedWarranty.warranty_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Award className="size-5 text-emerald-500" />
            Digital Watch Warranty Generator (ডিজিটাল ওয়ারেন্টি কার্ড)
          </DialogTitle>
          <DialogDescription>
            Generate an official digital warranty certificate for this customer and send it directly to their WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {issuedWarranty ? (
          // Success Certificate Preview State
          <div className="space-y-4 py-3">
            <div className="rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/10 p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Active Certificate
              </div>
              <ShieldCheck className="mx-auto size-12 text-emerald-500 mb-2" />
              <h3 className="text-base font-bold text-foreground">
                Warranty Certificate Issued!
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Model: <span className="font-semibold text-foreground">{issuedWarranty.product_name}</span>
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 border border-border">
                <span className="text-xs font-mono font-bold text-primary">
                  {issuedWarranty.warranty_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{issuedWarranty.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serial No:</span>
                <span className="font-mono text-foreground">{issuedWarranty.serial_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium text-foreground">{issuedWarranty.duration_months} Months (1 Year)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage:</span>
                <span className="text-foreground text-right max-w-[240px] truncate">{issuedWarranty.coverage_details}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Button onClick={handleSendToWhatsApp} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Send className="size-4" />
                Send Certificate on WhatsApp
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Form State
          <form onSubmit={handleIssueWarranty} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label>Watch Model / Product *</Label>
              {products.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} (৳{p.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <Input
                  placeholder="e.g. Naviforce NF9117 Luxury Chronograph"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Recipient Name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Customer Phone *</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Watch Serial No. (Case Back)</Label>
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty Duration *</Label>
                <Select value={durationMonths} onValueChange={(val) => val && setDurationMonths(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 Months Warranty</SelectItem>
                    <SelectItem value="12">12 Months (1 Year) Warranty</SelectItem>
                    <SelectItem value="24">24 Months (2 Years) Warranty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Coverage Terms & Details</Label>
              <Textarea
                rows={2}
                value={coverageDetails}
                onChange={(e) => setCoverageDetails(e.target.value)}
                placeholder="Details of warranty coverage"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Award className="size-4" />
                {loading ? 'Issuing...' : 'Generate Warranty Certificate'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
