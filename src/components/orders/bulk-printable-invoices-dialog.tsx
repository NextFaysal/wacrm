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

interface BulkPrintableInvoicesDialogProps {
  orders: Order[];
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

export function BulkPrintableInvoicesDialog({
  orders,
  open,
  onOpenChange,
  storeName = 'ONLINE STORE',
  storePhone = '+880 1800-000000',
  storeAddress = 'Dhaka, Bangladesh',
}: BulkPrintableInvoicesDialogProps) {
  const [printMode, setPrintMode] = useState<'a4' | 'pos'>('pos');
  const bulkPrintableRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!orders || orders.length === 0) return;
    printInvoiceElement({
      element: bulkPrintableRef.current,
      title: `Bulk-Invoices-${orders.length}-Orders`,
      isPos: printMode === 'pos',
    });
  }, [orders, printMode]);

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

  if (!orders || orders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-xl">
        {/* Responsive Dialog Header */}
        <DialogHeader className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print sticky top-0 bg-background z-20">
          <div className="min-w-0">
            <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary shrink-0" />
              <span>Bulk Print ({orders.length}) Orders</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Print all invoices or POS shipping slips at once with page breaks.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <div className="flex rounded-lg border p-0.5 bg-muted">
              <Button
                variant={printMode === 'pos' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setPrintMode('pos')}
              >
                <Receipt className="w-3.5 h-3.5" />
                POS Slips (80mm)
              </Button>
              <Button
                variant={printMode === 'a4' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setPrintMode('a4')}
              >
                <FileText className="w-3.5 h-3.5" />
                A4 Invoices
              </Button>
            </div>

            <Button size="sm" onClick={handlePrint} className="h-7 sm:h-8 text-xs gap-1.5 font-semibold shadow-xs">
              <Printer className="w-3.5 h-3.5" />
              Print All ({orders.length})
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Area */}
        <div ref={bulkPrintableRef} className="p-3 sm:p-6 bg-slate-50 dark:bg-slate-950 bulk-printable-area">
          {printMode === 'a4' ? (
            /* ========================================================
               A4 BULK INVOICES TEMPLATE (FULLY RESPONSIVE)
               ======================================================== */
            <div className="space-y-6 sm:space-y-8">
              {orders.map((order, idx) => {
                const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
                const orderDate = order.created_at
                  ? format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')
                  : 'N/A';
                const advanceAmount = Number(order.advance_paid) || 0;
                const totalAmount = Number(order.total_amount) || 0;
                const codAmount = Math.max(0, totalAmount - advanceAmount);
                const deliveryCharge = Number(order.delivery_charge) || 0;
                const unitPrice = Number(order.unit_price) || 0;
                const quantity = Number(order.quantity) || 1;
                const subtotal = unitPrice * quantity;

                return (
                  <div
                    key={order.id}
                    className={`bulk-a4-container max-w-2xl mx-auto border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs bg-white text-gray-900 invoice-page-break ${
                      idx !== orders.length - 1 ? 'pb-8 mb-6 sm:mb-8' : ''
                    }`}
                  >
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

                    {/* Customer & Courier Details */}
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

                    {/* Items Table */}
                    <div className="my-4 overflow-x-auto print:overflow-visible">
                      <table className="w-full text-left text-xs border-collapse min-w-[340px]">
                        <thead>
                          <tr className="border-b-2 border-gray-200 text-gray-600 uppercase text-[11px] bg-gray-100">
                            <th className="py-2 px-2.5 font-semibold">Item Description</th>
                            <th className="py-2 px-2.5 font-semibold text-center">Variant</th>
                            <th className="py-2 px-2.5 font-semibold text-center">Qty</th>
                            <th className="py-2 px-2.5 font-semibold text-right">Price</th>
                            <th className="py-2 px-2.5 font-semibold text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="py-2.5 px-2.5 font-semibold text-gray-900">{order.product_name}</td>
                            <td className="py-2.5 px-2.5 text-center text-gray-600">{order.variant || 'Standard'}</td>
                            <td className="py-2.5 px-2.5 text-center font-bold text-gray-800">{quantity}</td>
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

                    {/* Summary Totals */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-3 border-t border-gray-200 text-xs print:flex-row">
                      <div className="w-full sm:w-1/2">
                        {order.notes && (
                          <div className="bg-yellow-50/70 border border-yellow-200 rounded p-2 text-yellow-800 text-[11px]">
                            <span className="font-bold">Order Note:</span> {order.notes}
                          </div>
                        )}
                      </div>
                      <div className="w-full sm:w-56 space-y-1 text-right print:w-56">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal:</span>
                          <span className="font-mono">৳{subtotal.toLocaleString('en-BD')}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Delivery Fee:</span>
                          <span className="font-mono">৳{deliveryCharge.toLocaleString('en-BD')}</span>
                        </div>
                        {advanceAmount > 0 && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>Advance Paid ({order.advance_method || 'Online'}):</span>
                            <span className="font-mono">-৳{advanceAmount.toLocaleString('en-BD')}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t-2 border-gray-300 pt-2 font-bold text-sm text-gray-900">
                          <span>COD Cash to Collect:</span>
                          <span className="text-primary font-mono text-base font-black">
                            ৳{codAmount.toLocaleString('en-BD')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================
               POS / COURIER SHIPPING SLIPS (80mm) (RESPONSIVE)
               ======================================================== */
            <div className="space-y-6">
              {orders.map((order) => {
                const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
                const orderDate = order.created_at
                  ? format(new Date(order.created_at), 'dd/MM/yyyy hh:mm a')
                  : '';
                const advanceAmount = Number(order.advance_paid) || 0;
                const totalAmount = Number(order.total_amount) || 0;
                const codAmount = Math.max(0, totalAmount - advanceAmount);
                const quantity = Number(order.quantity) || 1;

                return (
                  <div
                    key={order.id}
                    className="bulk-pos-container w-full max-w-[340px] mx-auto border-2 border-dashed border-gray-300 p-3 sm:p-4 font-mono text-xs bg-white text-gray-900 rounded-lg invoice-page-break shadow-xs"
                  >
                    {/* Header */}
                    <div className="text-center pb-2 border-b border-gray-200">
                      <h2 className="text-sm sm:text-base font-black tracking-tight uppercase">{storeName}</h2>
                      <p className="text-[10px] text-gray-500">{storePhone}</p>
                      <p className="text-[11px] font-bold text-gray-800 mt-1">
                        COURIER PACKING SLIP
                      </p>
                      <p className="text-[9px] text-gray-400">{orderDate}</p>
                    </div>

                    {/* Barcode */}
                    <div className="py-2.5 my-1 bg-gray-50 flex flex-col items-center border-y border-gray-200">
                      <SvgBarcode text={order.courier_tracking_code || invoiceNo} width={220} height={38} />
                      {order.courier_provider && (
                        <span className="text-[9px] font-bold uppercase mt-0.5 text-blue-700">
                          {order.courier_provider} EXPRESS
                        </span>
                      )}
                    </div>

                    {/* Recipient Box */}
                    <div className="my-2 border border-gray-300 rounded p-2 bg-gray-50/50">
                      <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">RECIPIENT / গ্রাহক:</p>
                      <p className="text-sm font-bold text-gray-900">{order.customer_name}</p>
                      <p className="text-sm font-black text-gray-900 tracking-wider flex items-center gap-1 mt-0.5">
                        📞 {order.customer_phone}
                      </p>
                      <p className="text-[11px] text-gray-700 leading-tight mt-1 whitespace-pre-line font-sans">
                        {order.customer_address}
                        {order.thana ? `, ${order.thana}` : ''}
                        {order.district ? `, ${order.district}` : ''}
                      </p>
                    </div>

                    {/* Item */}
                    <div className="py-2 border-t border-b border-gray-200 text-[11px]">
                      <div className="flex justify-between font-bold">
                        <span>{order.product_name}</span>
                        <span>x{quantity}</span>
                      </div>
                      <div className="text-[10px] text-gray-600 flex justify-between mt-0.5">
                        <span>Variant: {order.variant || 'Standard'}</span>
                        <span>৳{order.unit_price}</span>
                      </div>
                    </div>

                    {/* COD Amount Banner */}
                    <div className="my-2.5 p-2.5 bg-gray-900 text-white rounded text-center">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-300">
                        CASH ON DELIVERY (ক্যাশ কালেকশন)
                      </p>
                      <p className="text-xl sm:text-2xl font-black tracking-tight text-amber-400 mt-0.5">
                        ৳{codAmount.toLocaleString('en-BD')}
                      </p>
                      {advanceAmount > 0 && (
                        <p className="text-[9px] text-emerald-300 mt-0.5">
                          Advance Paid: ৳{advanceAmount} ({order.advance_method || 'Online'})
                        </p>
                      )}
                    </div>

                    {order.notes && (
                      <p className="text-[9px] text-gray-600 italic border-t border-gray-200 pt-1">
                        Note: {order.notes}
                      </p>
                    )}

                    <div className="text-center text-[9px] text-gray-400 pt-1">
                      Invoice: {invoiceNo}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
