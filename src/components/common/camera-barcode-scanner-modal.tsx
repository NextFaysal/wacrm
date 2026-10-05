'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  X,
  Flashlight,
  SwitchCamera,
  Barcode,
  RefreshCw,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
}

// Synthesize pleasant checkout scan beep using Web Audio API
function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'ক্যামেরা বারকোড স্ক্যানার',
  description = 'বারকোড বা কিউআর কোডের উপর ক্যামেরা ধরুন',
}: CameraBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // Stop video stream & animation loop
  const stopStream = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Handle successful detection
  const handleSuccess = useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      playScanBeep();
      if (navigator.vibrate) {
        try {
          navigator.vibrate(100);
        } catch {}
      }
      setLastScanned(clean);
      toast.success(`স্ক্যান সফল: ${clean}`);
      stopStream();
      onScan(clean);
      onClose();
    },
    [onScan, onClose, stopStream]
  );

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopStream();
    setErrorMsg(null);
    setHasPermission(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('আপনার ব্রাউজারে ক্যামেরা অ্যাক্সেস সাপোর্ট নেই।');
        setHasPermission(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track && 'getCapabilities' in track) {
        const capabilities = (track as unknown as { getCapabilities: () => { torch?: boolean } }).getCapabilities();
        setHasTorch(Boolean(capabilities?.torch));
      }
    } catch (err: unknown) {
      console.warn('[camera-scanner] camera permission error:', err);
      const isDenied = (err as Error)?.name === 'NotAllowedError';
      setErrorMsg(
        isDenied
          ? 'ক্যামেরা পারমিশন দেওয়া হয়নি। ব্রাউজার সেটিংসে ক্যামেরা এলাও করুন।'
          : 'ক্যামেরা চালু করতে সমস্যা হয়েছে।'
      );
      setHasPermission(false);
    }
  }, [facingMode, stopStream]);

  // Barcode Detection Scanning Loop
  useEffect(() => {
    if (!isOpen || !hasPermission) return;

    let isScanning = true;

    // Check if BarcodeDetector API exists in browser
    const DetectorClass = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;

    let detector: any = null;
    if (DetectorClass) {
      try {
        detector = new DetectorClass({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!isScanning) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        if (detector) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              isScanning = false;
              handleSuccess(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, [isOpen, hasPermission, handleSuccess]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as unknown as { applyConstraints: (c: any) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch {
      toast.error('টর্চ চালু করা সম্ভব হয়নি');
    }
  };

  // Flip Camera
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (isOpen) {
      void startCamera();
      setManualCode('');
      setLastScanned(null);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleSuccess(manualCode.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-md bg-neutral-950 border-neutral-800 text-neutral-100 p-4 sm:p-5 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-neutral-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-neutral-100">
                  {title}
                </DialogTitle>
                <p className="text-[11px] text-neutral-400">{description}</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Video Viewport Container */}
        <div className="relative aspect-square w-full rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden flex items-center justify-center">
          {hasPermission === false ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-amber-400 mx-auto" />
              <p className="text-xs text-neutral-300 font-medium">
                {errorMsg || 'ক্যামেরা চালু করা সম্ভব হয়নি।'}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startCamera}
                className="h-8 text-xs border-neutral-700 text-neutral-200"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> পুনরায় চেষ্টা করুন
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Aiming Reticle & Animated Laser Line */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Crosshair Box */}
                <div className="relative w-64 h-48 border-2 border-amber-400/70 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-md" />

                  {/* Pulsing Red/Amber Laser Scanning Beam */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-bounce" />
                </div>
              </div>

              {/* Top Controls Overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur transition-all ${
                      torchOn
                        ? 'bg-amber-500 text-neutral-950 shadow-lg'
                        : 'bg-black/60 text-neutral-200 hover:bg-black/80'
                    }`}
                    title="ফ্ল্যাশলাইট"
                  >
                    <Flashlight className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="h-8 w-8 rounded-full bg-black/60 backdrop-blur text-neutral-200 hover:bg-black/80 flex items-center justify-center transition-all"
                  title="ক্যামেরা সুইচ"
                >
                  <SwitchCamera className="h-4 w-4" />
                </button>
              </div>

              {/* Bottom Instructions Badge */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center">
                <Badge
                  variant="outline"
                  className="bg-black/70 backdrop-blur border-neutral-700 text-neutral-300 text-[10px] py-1 px-3"
                >
                  বারকোডটি ফ্রেমের ভেতরে রাখুন
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* Manual Code Input Fallback */}
        <form onSubmit={handleManualSubmit} className="pt-2 space-y-2">
          <span className="text-[11px] text-neutral-400 font-medium block">
            অথবা কোড সরাসরি টাইপ করুন:
          </span>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <Input
                placeholder="যেমন: 8901234567890 বা SKU"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="pl-8 h-8 text-xs font-mono bg-neutral-900 border-neutral-800 text-neutral-100"
              />
            </div>
            <Button
              type="submit"
              disabled={!manualCode.trim()}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3"
            >
              সাবমিট
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
