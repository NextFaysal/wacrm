'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Send,
  FileEdit,
  Building2,
  ExternalLink,
  Smartphone,
  Zap,
  Loader2,
  Sparkles,
} from 'lucide-react';
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
import { useAuth } from '@/hooks/use-auth';

export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'stripe' | 'bank' | 'custom';
export type BkashType = 'personal' | 'merchant' | 'agent';

interface PaymentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (messageText: string) => void;
  onInsertToComposer: (messageText: string) => void;
  conversationId?: string;
}

const STORAGE_KEY_PREFIX = 'wacrm:payment_method:';

export function PaymentRequestDialog({
  open,
  onOpenChange,
  onSend,
  onInsertToComposer,
  conversationId,
}: PaymentRequestDialogProps) {
  const { defaultCurrency } = useAuth();

  const [mode, setMode] = useState<'dynamic' | 'manual'>('dynamic');
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [amount, setAmount] = useState('150');
  const [currency, setCurrency] = useState(defaultCurrency || 'BDT');
  const [purpose, setPurpose] = useState<'advance_payment' | 'full_payment' | 'custom'>('advance_payment');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<BkashType>('personal');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  // Restore saved account number or payment link for the selected method
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${method}`);
      if (saved) {
        setAccountNumber(saved);
      } else {
        setAccountNumber('');
      }
    } catch {
      // ignore localStorage restrictions
    }
  }, [method]);

  // Adjust default currency when method changes
  useEffect(() => {
    if (method === 'bkash' || method === 'nagad' || method === 'rocket') {
      setCurrency('BDT');
    } else if (method === 'stripe') {
      setCurrency(defaultCurrency && defaultCurrency !== 'BDT' ? defaultCurrency : 'USD');
    }
  }, [method, defaultCurrency]);

  const generateManualMessageText = (): string => {
    const formattedAmount = amount ? `${currency} ${amount}` : '';

    if (method === 'bkash' || method === 'nagad' || method === 'rocket') {
      const methodName =
        method === 'bkash' ? 'bKash' : method === 'nagad' ? 'Nagad' : 'Rocket';
      const typeLabel =
        accountType === 'merchant'
          ? 'Merchant (Payment)'
          : accountType === 'agent'
            ? 'Agent (Cash In)'
            : 'Personal (Send Money)';

      const actionText =
        accountType === 'merchant'
          ? 'Make Payment'
          : accountType === 'agent'
            ? 'Cash In'
            : 'Send Money';

      const lines = [
        `💳 *PAYMENT REQUEST*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `*Amount:* ${formattedAmount || 'N/A'}`,
        `*Method:* ${methodName} (${typeLabel})`,
        accountNumber ? `*Account Number:* \`${accountNumber.trim()}\`` : '',
        reference ? `*Reference:* \`${reference.trim()}\`` : '',
        notes ? `*Note:* ${notes.trim()}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `✅ *Instructions:*`,
        `1. Open your *${methodName}* App or Dial USSD`,
        `2. Select *${actionText}* to \`${accountNumber.trim() || 'our number'}\``,
        formattedAmount ? `3. Enter amount: *${formattedAmount}*` : '',
        reference ? `4. Enter reference: \`${reference.trim()}\`` : '',
        `5. After completing, please reply here with your *Transaction ID (TrxID)*.`,
      ];
      return lines.filter(Boolean).join('\n');
    }

    if (method === 'stripe') {
      const lines = [
        `💳 *PAYMENT REQUEST*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `*Amount:* ${formattedAmount || 'N/A'}`,
        `*Method:* Credit / Debit Card (Stripe)`,
        reference ? `*Reference:* \`${reference.trim()}\`` : '',
        notes ? `*Note:* ${notes.trim()}` : '',
        ``,
        `👉 *Pay securely online:*`,
        accountNumber ? accountNumber.trim() : 'https://buy.stripe.com/...',
        `━━━━━━━━━━━━━━━━━━━━`,
        `Once your payment is complete, confirmation will be updated automatically.`,
      ];
      return lines.filter(Boolean).join('\n');
    }

    if (method === 'bank') {
      const lines = [
        `🏦 *BANK TRANSFER PAYMENT REQUEST*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `*Amount:* ${formattedAmount || 'N/A'}`,
        accountNumber ? `*Bank & Account Details:*\n${accountNumber.trim()}` : '',
        reference ? `*Reference / Narration:* \`${reference.trim()}\`` : '',
        notes ? `*Note:* ${notes.trim()}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `Please share a screenshot or deposit slip receipt once the transfer is done.`,
      ];
      return lines.filter(Boolean).join('\n');
    }

    // Custom
    const lines = [
      `💳 *PAYMENT REQUEST*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Amount:* ${formattedAmount || 'N/A'}`,
      accountNumber ? `*Payment Details / Link:*\n${accountNumber.trim()}` : '',
      reference ? `*Reference:* \`${reference.trim()}\`` : '',
      notes ? `*Note:* ${notes.trim()}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `Please reply with confirmation once payment is complete.`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  const handleGenerateDynamicLink = async (action: 'send' | 'insert') => {
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/payment/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          currency,
          purpose,
          conversationId: conversationId || null,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || '01XXXXXXXXX',
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.formattedText) {
        throw new Error(resData.error || 'পেমেন্ট লিঙ্ক তৈরি করা যায়নি');
      }

      if (action === 'send') {
        onSend(resData.formattedText);
        toast.success('ডাইনামিক পেমেন্ট লিঙ্ক পাঠানো হয়েছে!');
      } else {
        onInsertToComposer(resData.formattedText);
        toast.info('পেমেন্ট লিঙ্ক মেসেজ কম্পোজারে যুক্ত হয়েছে');
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generating payment link');
    } finally {
      setGenerating(false);
    }
  };

  const savePreferences = () => {
    if (accountNumber.trim()) {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${method}`, accountNumber.trim());
      } catch {
        // ignore
      }
    }
  };

  const handleSendManual = () => {
    if (!amount.trim()) {
      toast.error('Please enter the payment amount');
      return;
    }
    if (!accountNumber.trim()) {
      toast.error('Please provide an account number or payment link');
      return;
    }

    savePreferences();
    const msg = generateManualMessageText();
    onSend(msg);
    onOpenChange(false);
    toast.success('Payment request sent to customer');
  };

  const handleInsertManual = () => {
    savePreferences();
    const msg = generateManualMessageText();
    onInsertToComposer(msg);
    onOpenChange(false);
    toast.info('Payment request inserted into message composer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" />
            Send Payment Request (bKash / Nagad / Online)
          </DialogTitle>
          <DialogDescription>
            ইনস্ট্যান্ট ভেরিফাইড পেমেন্ট লিঙ্ক তৈরি করুন অথবা ম্যানুয়াল একাউন্ট নম্বর পাঠান।
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-lg bg-slate-900 p-1 border border-border">
          <button
            type="button"
            onClick={() => setMode('dynamic')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              mode === 'dynamic'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap className="size-3.5" />
            ⚡ 1-Click Dynamic Payment Link (Auto-Verify)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              mode === 'manual'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="size-3.5" />
            Manual Send Money Request
          </button>
        </div>

        {mode === 'dynamic' ? (
          /* Dynamic 1-Click Link Generator */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-300">
              <span className="font-bold flex items-center gap-1.5 mb-1">
                <Sparkles className="size-4 text-emerald-400" />
                স্বয়ংক্রিয় পেমেন্ট ভেরিফিকেশন ও অর্ডার নিশ্চিতকরণ
              </span>
              গ্রাহক লিঙ্কে ক্লিক করে bKash PGW বা TrxID সাবমিট করলেই সিস্টেম স্বয়ংক্রিয়ভাবে অর্ডার
              Advance Paid মার্ক করবে, কনফার্মেশন মেসেজ পাঠাবে এবং Meta CAPI Purchase ইভেন্ট রেকর্ড করবে।
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dyn-amount">টাকার পরিমাণ (Amount) *</Label>
                <div className="flex gap-2">
                  <Input
                    id="dyn-amount"
                    type="number"
                    placeholder="150"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className="flex items-center px-3 rounded-md bg-muted text-xs font-bold text-muted-foreground">
                    BDT
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>পেমেন্টের উদ্দেশ্য (Purpose)</Label>
                <Select
                  value={purpose}
                  onValueChange={(val) =>
                    setPurpose(val as 'advance_payment' | 'full_payment' | 'custom')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance_payment">অগ্রিম ডেলিভারি চার্জ (Advance)</SelectItem>
                    <SelectItem value="full_payment">সম্পূর্ণ মূল্য (Full Payment)</SelectItem>
                    <SelectItem value="custom">কাস্টম পেমেন্ট (Custom)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dyn-phone">গ্রাহক মোবাইল নম্বর *</Label>
                <Input
                  id="dyn-phone"
                  placeholder="01XXXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dyn-name">গ্রাহকের নাম (ঐচ্ছিক)</Label>
                <Input
                  id="dyn-name"
                  placeholder="গ্রাহকের নাম"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Amount presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">দ্রুত সিলেক্ট:</span>
              {['100', '150', '200', '500', '1000'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    amount === preset
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  ৳{preset}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Manual Mode */
          <div className="grid gap-5 py-2 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={method} onValueChange={(val) => setMethod(val as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bkash">bKash (বিকাশ)</SelectItem>
                    <SelectItem value="nagad">Nagad (নগদ)</SelectItem>
                    <SelectItem value="rocket">Rocket (রকেট)</SelectItem>
                    <SelectItem value="stripe">Credit / Debit Card (Stripe Link)</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="custom">Custom Payment Method</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="e.g. 1500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    placeholder="BDT"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {(method === 'bkash' || method === 'nagad' || method === 'rocket') && (
                <div className="space-y-1.5">
                  <Label>Account Type</Label>
                  <Select
                    value={accountType}
                    onValueChange={(val) => setAccountType(val as BkashType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal (Send Money)</SelectItem>
                      <SelectItem value="merchant">Merchant (Make Payment)</SelectItem>
                      <SelectItem value="agent">Agent (Cash In)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="accountNumber">
                  {method === 'stripe'
                    ? 'Stripe Payment Link *'
                    : method === 'bank'
                      ? 'Bank Details (Bank, Branch, A/C #) *'
                      : `${method.toUpperCase()} Number *`}
                </Label>
                {method === 'bank' ? (
                  <Textarea
                    id="accountNumber"
                    rows={2}
                    placeholder="Bank: City Bank&#10;A/C: 1234567890&#10;Branch: Gulshan"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                ) : (
                  <Input
                    id="accountNumber"
                    placeholder={
                      method === 'stripe'
                        ? 'https://buy.stripe.com/...'
                        : '01XXXXXXXXX'
                    }
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference / Order ID (Optional)</Label>
                <Input
                  id="reference"
                  placeholder="e.g. ORD-1024"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes / Special Instructions (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g. Include ৳20 cash out fee"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <Label className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Message Preview
              </Label>
              <div className="flex-1 rounded-xl border border-border bg-[#0b141a] p-4 text-xs font-mono text-emerald-100 shadow-inner overflow-y-auto whitespace-pre-wrap select-text">
                {generateManualMessageText()}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === 'dynamic' ? (
            <>
              <Button
                variant="outline"
                disabled={generating}
                onClick={() => handleGenerateDynamicLink('insert')}
                className="gap-1.5"
              >
                <FileEdit className="size-4" />
                Insert Link to Composer
              </Button>
              <Button
                disabled={generating}
                onClick={() => handleGenerateDynamicLink('send')}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    ⚡ Generate & Send Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleInsertManual} className="gap-1.5">
                <FileEdit className="size-4" />
                Insert into Composer
              </Button>
              <Button onClick={handleSendManual} className="gap-1.5">
                <Send className="size-4" />
                Send to Customer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
