'use client';

import React, { useState } from 'react';
import type { Order } from '@/types/commerce';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, FileText, Receipt, CheckCircle, Truck, Phone, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PrintableInvoiceDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
}

// Simple deterministic SVG Barcode generator
function SvgBarcode({ text, width = 220, height = 45 }: { text: string; width?: number; height?: number }) {
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
      curX += (w * 1.5) + 1;
    });
    curX += 2;
  }

  const totalWidth = curX + 10;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="overflow-visible"
      >
        {bars.map((bar, i) => (
          <rect key={i} x={bar.x} y={2} width={bar.w} height={height - 6} fill="#111827" />
        ))}
      </svg>
      <span className="text-[10px] font-mono tracking-widest text-gray-600 mt-0.5">{text}</span>
    </div>
  );
}

export function PrintableInvoiceDialog({
  order,
  open,
  onOpenChange,
  storeName = 'PREMIUM WATCHES BD',
  storePhone = '+880 1800-000000',
  storeAddress = 'Dhaka, Bangladesh',
}: PrintableInvoiceDialogProps) {
  const [printMode, setPrintMode] = useState<'a4' | 'pos'>('a4');

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Invoice & Packing Slip — {invoiceNo}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 mr-6">
            <div className="flex rounded-md border p-0.5 bg-muted">
              <Button
                variant={printMode === 'a4' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setPrintMode('a4')}
              >
                <FileText className="w-3.5 h-3.5" />
                A4 Invoice
              </Button>
              <Button
                variant={printMode === 'pos' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setPrintMode('pos')}
              >
                <Receipt className="w-3.5 h-3.5" />
                POS Slip (80mm)
              </Button>
            </div>

            <Button size="sm" onClick={handlePrint} className="h-8 gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Print Now
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Container */}
        <div className="p-6 bg-white text-gray-900 printable-area">
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .printable-area,
              .printable-area * {
                visibility: visible;
              }
              .printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 15px !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {printMode === 'a4' ? (
            /* ========================================================
               A4 STANDARD INVOICE TEMPLATE
               ======================================================== */
            <div className="max-w-2xl mx-auto border border-gray-200 rounded-lg p-6 shadow-sm bg-white">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">
                    {storeName}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {storeAddress}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-gray-400" />
                    {storePhone}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-primary/10 text-primary font-bold text-xs uppercase px-2.5 py-1 rounded">
                    Invoice
                  </div>
                  <p className="text-sm font-bold font-mono text-gray-800 mt-1.5">{invoiceNo}</p>
                  <p className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    {orderDate}
                  </p>
                </div>
              </div>

              {/* Customer & Courier Delivery Details */}
              <div className="grid grid-cols-2 gap-6 my-5 py-4 px-4 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                <div>
                  <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-[11px] mb-2">
                    Customer / Recipient Info:
                  </h3>
                  <p className="font-bold text-sm text-gray-900">{order.customer_name}</p>
                  <p className="font-bold text-gray-800 text-xs mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    {order.customer_phone}
                  </p>
                  <p className="text-gray-600 mt-1 whitespace-pre-line leading-relaxed">
                    {order.customer_address}
                    {order.thana ? `, ${order.thana}` : ''}
                    {order.district ? `, ${order.district}` : ''}
                  </p>
                </div>

                <div className="border-l border-gray-200 pl-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-[11px] mb-2">
                      Courier & Dispatch:
                    </h3>
                    <p className="text-gray-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
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

                  <div className="pt-2">
                    <SvgBarcode text={order.courier_tracking_code || invoiceNo} width={180} height={38} />
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="my-5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-gray-700">
                      <th className="py-2.5 px-3 font-semibold">Item Description</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Variant</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Price</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {order.product_name}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {order.variant || 'Standard'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-800">
                        {quantity}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700 font-mono">
                        ৳{unitPrice.toLocaleString('en-BD')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900 font-mono">
                        ৳{subtotal.toLocaleString('en-BD')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Calculation & COD Alert */}
              <div className="border-t border-gray-200 pt-4 flex justify-between items-start">
                <div className="text-xs text-gray-500 max-w-xs space-y-1">
                  <p className="font-semibold text-gray-700">Terms & Policy:</p>
                  <p>ডেলিভারি ম্যানের সামনে পার্সেল চেক করে গ্রহণ করুন। কোনো সমস্যা হলে আমাদের অবিলম্বে জানান।</p>
                  {order.notes && (
                    <p className="mt-2 text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                      <strong>Note:</strong> {order.notes}
                    </p>
                  )}
                </div>

                <div className="w-56 space-y-1.5 text-xs text-right">
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
                      <span>Advance Paid ({order.advance_method || 'bKash'}):</span>
                      <span className="font-mono">-৳{advanceAmount.toLocaleString('en-BD')}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm text-gray-900">
                    <span>Total Amount:</span>
                    <span className="font-mono">৳{totalAmount.toLocaleString('en-BD')}</span>
                  </div>
                  <div className="mt-3 p-2 bg-gray-900 text-white rounded text-center">
                    <p className="text-[10px] uppercase font-semibold text-gray-300 tracking-wider">
                      Cash On Delivery (COD) To Collect:
                    </p>
                    <p className="text-lg font-black font-mono tracking-tight text-white mt-0.5">
                      ৳{codAmount.toLocaleString('en-BD')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
                <span>Authorized Signature: __________________</span>
                <span>Thank you for shopping with us!</span>
              </div>
            </div>
          ) : (
            /* ========================================================
               POS 80mm THERMAL SLIP TEMPLATE
               ======================================================== */
            <div className="w-[300px] mx-auto border border-dashed border-gray-400 p-4 rounded bg-white text-black font-mono text-xs">
              <div className="text-center pb-3 border-b border-dashed border-gray-400">
                <h2 className="text-base font-black uppercase tracking-wide">{storeName}</h2>
                <p className="text-[11px] text-gray-700">{storePhone}</p>
                <p className="text-[10px] text-gray-600">{storeAddress}</p>
              </div>

              <div className="my-2.5 text-[11px] leading-tight space-y-1">
                <div className="flex justify-between font-bold">
                  <span>INVOICE:</span>
                  <span>{invoiceNo}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>DATE:</span>
                  <span>{orderDate}</span>
                </div>
              </div>

              <div className="my-3 py-2 border-y border-dashed border-gray-400 text-[11px]">
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
                    <p>{quantity} × ৳{unitPrice}</p>
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

                <div className="mt-3 p-2 bg-black text-white text-center rounded">
                  <span className="text-[9px] uppercase font-bold tracking-wider">COD COLLECT (ক্যাশ অন ডেলিভারি):</span>
                  <p className="text-xl font-black mt-0.5">৳{codAmount}</p>
                </div>
              </div>

              {/* Barcode */}
              <div className="mt-4 pt-2 border-t border-dashed border-gray-400 text-center">
                <p className="text-[10px] font-bold uppercase mb-1">
                  Courier: {order.courier_provider || 'Steadfast'}
                </p>
                <SvgBarcode text={order.courier_tracking_code || invoiceNo} width={200} height={35} />
              </div>

              <div className="mt-3 text-center text-[10px] text-gray-500">
                <p>Thank you for your order!</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
