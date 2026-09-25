'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Send,
  FileEdit,
  Building2,
  ExternalLink,
  Smartphone,
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
}

const STORAGE_KEY_PREFIX = 'wacrm:payment_method:';

export function PaymentRequestDialog({
  open,
  onOpenChange,
  onSend,
  onInsertToComposer,
}: PaymentRequestDialogProps) {
  const { defaultCurrency } = useAuth();

  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency || 'BDT');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<BkashType>('personal');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

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

  const generateMessageText = (): string => {
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

  const savePreferences = () => {
    if (accountNumber.trim()) {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${method}`, accountNumber.trim());
      } catch {
        // ignore
      }
    }
  };

  const handleSend = () => {
    if (!amount.trim()) {
      toast.error('Please enter the payment amount');
      return;
    }
    if (!accountNumber.trim()) {
      toast.error('Please provide an account number or payment link');
      return;
    }

    savePreferences();
    const msg = generateMessageText();
    onSend(msg);
    onOpenChange(false);
    toast.success('Payment request sent to customer');
  };

  const handleInsert = () => {
    savePreferences();
    const msg = generateMessageText();
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
            Send Payment Request
          </DialogTitle>
          <DialogDescription>
            Generate and send a structured payment link or mobile wallet request (bKash, Nagad, Stripe, Bank).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2 md:grid-cols-2">
          {/* Form Side */}
          <div className="space-y-4">
            {/* Method Picker */}
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

            {/* Amount & Currency */}
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

            {/* Account Type for Mobile Wallets */}
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

            {/* Account Number / Link / Details */}
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

            {/* Reference ID */}
            <div className="space-y-1.5">
              <Label htmlFor="reference">Reference / Order ID (Optional)</Label>
              <Input
                id="reference"
                placeholder="e.g. ORD-1024"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Note / Instruction */}
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

          {/* Live Preview Side */}
          <div className="flex flex-col">
            <Label className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              WhatsApp Message Preview
            </Label>
            <div className="flex-1 rounded-xl border border-border bg-[#0b141a] p-4 text-xs font-mono text-emerald-100 shadow-inner overflow-y-auto whitespace-pre-wrap select-text">
              {generateMessageText()}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleInsert} className="gap-1.5">
            <FileEdit className="size-4" />
            Insert into Composer
          </Button>
          <Button onClick={handleSend} className="gap-1.5">
            <Send className="size-4" />
            Send to Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
