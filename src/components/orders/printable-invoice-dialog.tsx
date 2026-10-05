'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Order } from '@/types/commerce';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Receipt, Truck, Phone, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { printInvoiceElement } from '@/lib/orders/print-invoice';

interface PrintableInvoiceDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
}

// Crisp & Responsive SVG Barcode generator
function SvgBarcode({
  text,
  width = 200,
  height = 40,
}: {
  text: string;
  width?: number;
  height?: number;
}) {
  const bars: { x: number; w: number }[] = [];
  let curX = 10;
  const clean = (text || '000000').toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pattern = [(code % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 4) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      if (idx % 2 === 0) {
        bars.push({ x: curX, w: w * 1.5 });
      }
      curX += w * 1.5 + 1;
    });
    curX += 2;
  }

  const totalWidth = curX + 10;

  return (
    <div className="flex flex-col items-center max-w-full">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ maxWidth: `${width}px`, width: '100%', height: `${height}px` }}
        className="overflow-visible"
        shapeRendering="crispEdges"
      >
        {bars.map((bar, i) => (
          <rect key={i} x={bar.x} y={2} width={bar.w} height={height - 6} fill="#111827" />
        ))}
      </svg>
      <span className="text-[10px] font-mono tracking-widest text-gray-700 mt-0.5">{text}</span>
    </div>
  );
}

export function PrintableInvoiceDialog({
  order,
  open,
  onOpenChange,
  storeName = 'ONLINE STORE',
  storePhone = '+880 1800-000000',
  storeAddress = 'Dhaka, Bangladesh',
}: PrintableInvoiceDialogProps) {
  const [printMode, setPrintMode] = useState<'a4' | 'pos'>('a4');
  const printableRef = useRef<HTMLDivElement>(null);

  const invoiceNo = order ? order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}` : '';

  const handlePrint = useCallback(() => {
    if (!order) return;
    printInvoiceElement({
      element: printableRef.current,
      title: `Invoice-${invoiceNo}`,
      isPos: printMode === 'pos',
    });
  }, [order, invoiceNo, printMode]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handlePrint]);

  if (!order) return null;
  const orderDate = order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a') : 'N/A';
  const advanceAmount = Number(order.advance_paid) || 0;
  const totalAmount = Number(order.total_amount) || 0;
  const codAmount = Math.max(0, totalAmount - advanceAmount);
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const unitPrice = Number(order.unit_price) || 0;
  const quantity = Number(order.quantity) || 1;
  const subtotal = unitPrice * quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-xl">
        {/* Responsive Dialog Header */}
        <DialogHeader className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print bg-background sticky top-0 z-20">
          <div className="flex items-center justify-between min-w-0">
            <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 truncate">
              <Printer className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">Invoice #{invoiceNo}</span>
            </DialogTitle>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <div className="flex rounded-lg border p-0.5 bg-muted">
              <Button
                variant={printMode === 'a4' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setPrintMode('a4')}
              >
                <FileText className="w-3.5 h-3.5" />
                A4 Invoice
              </Button>
              <Button
                variant={printMode === 'pos' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setPrintMode('pos')}
              >
                <Receipt className="w-3.5 h-3.5" />
                POS 80mm
              </Button>
            </div>

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-7 sm:h-8 text-xs gap-1.5 font-semibold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Container */}
        <div ref={printableRef} className="p-3 sm:p-6 bg-slate-50 dark:bg-slate-950 printable-area">
          {printMode === 'a4' ? (
            /* ========================================================
               A4 STANDARD INVOICE TEMPLATE (FULLY RESPONSIVE)
               ======================================================== */
            <div className="a4-invoice-container max-w-2xl mx-auto border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs bg-white text-gray-900">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-gray-200 pb-4 print:flex-row">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 uppercase">
                    {storeName}
                  </h1>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {storeAddress}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {storePhone}
                  </p>
                </div>
                <div className="sm:text-right print:text-right w-full sm:w-auto flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                  <div className="inline-block bg-primary/10 text-primary font-bold text-xs uppercase px-2.5 py-0.5 rounded">
                    Invoice
                  </div>
                  <p className="text-sm font-bold font-mono text-gray-800 mt-1">{invoiceNo}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                    {orderDate}
                  </p>
                </div>
              </div>

              {/* Customer & Courier Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 py-3 px-3 sm:px-4 bg-gray-50 rounded-lg border border-gray-200 text-xs print:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-[11px] mb-1.5">
                    Customer / Recipient:
                  </h3>
                  <p className="font-bold text-sm text-gray-900">{order.customer_name}</p>
                  <p className="font-bold text-gray-800 text-xs mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    {order.customer_phone}
                  </p>
                  <p className="text-gray-600 mt-1 leading-relaxed">
                    {order.customer_address}
                    {order.thana ? `, ${order.thana}` : ''}
                    {order.district ? `, ${order.district}` : ''}
                  </p>
                </div>

                <div className="sm:border-l sm:border-gray-200 sm:pl-4 flex flex-col justify-between print:border-l print:pl-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-[11px] mb-1.5">
                      Courier & Dispatch:
                    </h3>
                    <p className="text-gray-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium">Courier:</span>{' '}
                      <span className="uppercase font-bold text-gray-900">
                        {order.courier_provider || 'Pending Booking'}
                      </span>
                    </p>
                    {order.courier_tracking_code && (
                      <p className="text-gray-700 mt-1">
                        <span className="font-medium">Tracking Code:</span>{' '}
                        <span className="font-mono font-bold text-gray-900 bg-gray-200 px-1 py-0.5 rounded">
                          {order.courier_tracking_code}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex justify-start sm:justify-end print:justify-end">
                    <SvgBarcode text={order.courier_tracking_code || invoiceNo} width={180} height={36} />
                  </div>
                </div>
              </div>

              {/* Order Items Table (Responsive Horizontal Scroll) */}
              <div className="my-4 overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-xs border-collapse min-w-[340px]">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-gray-700">
                      <th className="py-2 px-2.5 font-semibold">Item Description</th>
                      <th className="py-2 px-2.5 font-semibold text-center">Variant</th>
                      <th className="py-2 px-2.5 font-semibold text-center">Qty</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Price</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-2.5 px-2.5 font-medium text-gray-900">
                        {order.product_name}
                      </td>
                      <td className="py-2.5 px-2.5 text-center text-gray-600">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                          {order.variant || 'Standard'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-gray-800">
                        {quantity}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-gray-700 font-mono">
                        ৳{unitPrice.toLocaleString('en-BD')}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-gray-900 font-mono">
                        ৳{subtotal.toLocaleString('en-BD')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Calculation & Policy */}
              <div className="border-t border-gray-200 pt-3 flex flex-col sm:flex-row justify-between items-start gap-4 print:flex-row">
                <div className="text-xs text-gray-500 max-w-xs space-y-1">
                  <p className="font-semibold text-gray-700">Terms & Policy:</p>
                  <p className="text-[11px] leading-relaxed">
                    ডেলিভারি ম্যানের সামনে পার্সেল চেক করে গ্রহণ করুন। কোনো সমস্যা হলে আমাদের অবিলম্বে জানান।
                  </p>
                  {order.notes && (
                    <p className="mt-1.5 text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px]">
                      <strong>Note:</strong> {order.notes}
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-56 space-y-1.5 text-xs text-right print:w-56">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">৳{subtotal.toLocaleString('en-BD')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Charge:</span>
                    <span className="font-mono">
                      {deliveryCharge === 0 ? 'FREE' : `৳${deliveryCharge.toLocaleString('en-BD')}`}
                    </span>
                  </div>
                  {advanceAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Advance ({order.advance_method || 'bKash'}):</span>
                      <span className="font-mono">-৳{advanceAmount.toLocaleString('en-BD')}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-sm text-gray-900">
                    <span>Total Amount:</span>
                    <span className="font-mono">৳{totalAmount.toLocaleString('en-BD')}</span>
                  </div>
                  <div className="mt-2.5 p-2 bg-gray-900 text-white rounded text-center">
                    <p className="text-[10px] uppercase font-semibold text-gray-300 tracking-wider">
                      Cash On Delivery (COD) To Collect:
                    </p>
                    <p className="text-base sm:text-lg font-black font-mono tracking-tight text-white mt-0.5">
                      ৳{codAmount.toLocaleString('en-BD')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-gray-400 print:flex-row">
                <span>Authorized Signature: __________________</span>
                <span>Thank you for shopping with us!</span>
              </div>
            </div>
          ) : (
            /* ========================================================
               POS 80mm THERMAL SLIP TEMPLATE (RESPONSIVE)
               ======================================================== */
            <div className="pos-slip-container w-full max-w-[320px] mx-auto border border-dashed border-gray-400 p-3 sm:p-4 rounded-lg bg-white text-black font-mono text-xs shadow-xs">
              <div className="text-center pb-2.5 border-b border-dashed border-gray-400">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide">{storeName}</h2>
                <p className="text-[11px] text-gray-700">{storePhone}</p>
                <p className="text-[10px] text-gray-600">{storeAddress}</p>
              </div>

              <div className="my-2 text-[11px] leading-tight space-y-1">
                <div className="flex justify-between font-bold">
                  <span>INVOICE:</span>
                  <span>{invoiceNo}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>DATE:</span>
                  <span>{orderDate}</span>
                </div>
              </div>

              <div className="my-2.5 py-2 border-y border-dashed border-gray-400 text-[11px]">
                <p className="font-bold uppercase text-[10px] text-gray-500 mb-0.5">Deliver To:</p>
                <p className="font-black text-sm">{order.customer_name}</p>
                <p className="font-bold text-xs mt-0.5">{order.customer_phone}</p>
                <p className="text-xs text-gray-800 mt-1 whitespace-pre-line leading-snug">
                  {order.customer_address}
                  {order.thana ? `, ${order.thana}` : ''}
                  {order.district ? `, ${order.district}` : ''}
                </p>
              </div>

              {/* Items */}
              <div className="my-2 text-[11px]">
                <div className="flex justify-between border-b border-gray-300 pb-1 font-bold">
                  <span>Item / Variant</span>
                  <span>Qty × Price</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <div>
                    <p className="font-bold">{order.product_name}</p>
                    <p className="text-[10px] text-gray-600">[{order.variant || 'Standard'}]</p>
                  </div>
                  <div className="text-right">
                    <p>
                      {quantity} × ৳{unitPrice}
                    </p>
                    <p className="font-bold">৳{subtotal}</p>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-gray-400 pt-2 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>{deliveryCharge === 0 ? 'FREE' : `৳${deliveryCharge}`}</span>
                </div>
                {advanceAmount > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Advance Paid:</span>
                    <span>-৳{advanceAmount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-gray-300 pt-1">
                  <span>Grand Total:</span>
                  <span>৳{totalAmount}</span>
                </div>

                <div className="mt-2.5 p-2 bg-black text-white text-center rounded">
                  <span className="text-[9px] uppercase font-bold tracking-wider">
                    COD COLLECT (ক্যাশ অন ডেলিভারি):
                  </span>
                  <p className="text-lg font-black mt-0.5">৳{codAmount}</p>
                </div>
              </div>

              {/* Barcode */}
              <div className="mt-3.5 pt-2 border-t border-dashed border-gray-400 text-center">
                <p className="text-[10px] font-bold uppercase mb-1">
                  Courier: {order.courier_provider || 'Steadfast'}
                </p>
                <SvgBarcode text={order.courier_tracking_code || invoiceNo} width={190} height={35} />
              </div>

              <div className="mt-2.5 text-center text-[10px] text-gray-500">
                <p>Thank you for your order!</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
