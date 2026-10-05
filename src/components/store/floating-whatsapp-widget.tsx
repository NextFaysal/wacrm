'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

interface FloatingWhatsAppWidgetProps {
  storeName?: string;
  whatsappNumber?: string | null;
  productName?: string;
  productPrice?: number;
  logoUrl?: string | null;
}

export function FloatingWhatsAppWidget({
  storeName = 'আমাদের শপ',
  whatsappNumber,
  productName,
  productPrice,
  logoUrl,
}: FloatingWhatsAppWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [showNotificationBadge, setShowNotificationBadge] = useState(false);

  // Clean WhatsApp number
  const cleanNumber = whatsappNumber
    ? whatsappNumber.replace(/[^\d+]/g, '').replace(/^0/, '880').replace(/^\+/, '')
    : null;

  // Delayed notification badge to grab attention naturally
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNotificationBadge(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setHasInteracted(true);
    setShowNotificationBadge(false);
  };

  const handleSendMessage = (textToSend?: string) => {
    const msg = (textToSend || customMsg).trim() || (productName ? `আসসালামু আলাইকুম, আমি ${productName} সম্পর্কে জানতে ও অর্ডার করতে চাই।` : 'আসসালামু আলাইকুম, আপনাদের প্রোডাক্ট ও অফার সম্পর্কে জানতে চাই।');
    
    if (cleanNumber) {
      const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback if number not set
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const suggestions = productName
    ? [
        `🛍️ ${productName} অর্ডার করতে চাই`,
        '🚚 ডেলিভারি চার্জ ও সময় কত?',
        '📸 রিয়েল ছবি বা ভিডিও দেখতে চাই',
        '🎁 কোনো ডিসকাউন্ট বা অফার আছে কি?',
      ]
    : [
        '🛍️ আপনাদের সেরা অফারগুলো দেখতে চাই',
        '🚚 ডেলিভারি চার্জ ও ক্যাশ অন ডেলিভারি নিয়ম কি?',
        '📦 নতুন কোনো কালেকশন এসেছে কি?',
        '💬 এজেন্টের সাথে সরাসরি কথা বলতে চাই',
      ];

  return (
    <aside aria-label="WhatsApp Support Chat" className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="mb-3 w-[330px] sm:w-[360px] rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="h-10 w-10 rounded-full object-cover border-2 border-white/30"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                    {storeName.charAt(0)}
                  </div>
                )}
                {/* Active Pulse Status */}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-emerald-700 animate-pulse" />
              </div>

              <div>
                <h4 className="text-sm font-bold leading-tight">{storeName}</h4>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  অনলাইনে আছেন • দ্রুত রিপ্লাই
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="p-4 space-y-3 bg-neutral-950/60 max-h-[380px] overflow-y-auto">
            {/* Auto-welcome message bubble */}
            <div className="flex gap-2.5 items-start">
              <div className="h-7 w-7 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="bg-neutral-800 text-neutral-200 text-xs p-3 rounded-2xl rounded-tl-sm border border-neutral-700/60 leading-relaxed shadow-sm">
                আসসালামু আলাইকুম! 👋<br />
                {productName ? (
                  <>
                    আপনি <strong>{productName}</strong> দেখছেন{productPrice ? ` (৳${productPrice.toLocaleString('en-BD')})` : ''}।
                    যেকোনো প্রশ্ন বা সরাসরি অর্ডারের জন্য মেসেজ দিন।
                  </>
                ) : (
                  'আমাদের অনলাইন শপে স্বাগতম! যেকোনো পণ্য সম্পর্কে জানতে বা অর্ডার করতে নিচে ক্লিক করুন বা লিখে পাঠান।'
                )}
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider pl-1">
                সরাসরি প্রশ্ন সিলেক্ট করুন:
              </p>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    className="text-left text-xs bg-neutral-900/90 hover:bg-emerald-950/40 text-neutral-300 hover:text-emerald-300 border border-neutral-800 hover:border-emerald-600/40 rounded-xl px-3 py-2 transition-all duration-200 group flex items-center justify-between"
                  >
                    <span className="truncate">{s}</span>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400 font-mono">
                      ➔
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Input */}
          <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="আপনার মেসেজ লিখুন..."
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              className="h-8 w-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20 transition-all hover:scale-105"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="relative group">
        {/* Floating Attention Bubble (before interaction) */}
        {!isOpen && !hasInteracted && showNotificationBadge && (
          <div
            onClick={handleOpen}
            className="absolute right-0 bottom-16 mb-2 cursor-pointer bg-neutral-900 border border-emerald-500/40 text-white text-xs px-3.5 py-2 rounded-2xl shadow-xl shadow-black/60 flex items-center gap-2 whitespace-nowrap animate-bounce"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-neutral-200 font-medium">
              সরাসরি হোয়াটসঅ্যাপে কথা বলুন! 👋
            </span>
          </div>
        )}

        <button
          onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
          className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none"
          aria-label="WhatsApp Support"
        >
          {isOpen ? (
            <X className="h-6 w-6 transition-transform duration-300 rotate-90" />
          ) : (
            <div className="relative flex items-center justify-center">
              <MessageCircle className="h-7 w-7" />
              {showNotificationBadge && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-emerald-600">
                  1
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
