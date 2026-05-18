import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const Scanner = ({ onScan, onClose }: ScannerProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const hasScannedRef = useRef(false);
    const [scannerError, setScannerError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;

        const stopScanner = () => {
            const controls = controlsRef.current;
            controlsRef.current = null;

            if (controls) {
                try {
                    controls.stop();
                } catch {
                    // Ignore cleanup failures during unmount/close.
                }
            }
        };

        const startScanner = async () => {
            if (!videoRef.current) {
                setScannerError("Scanner preview could not be initialized.");
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                setScannerError("This browser does not support camera scanning.");
                return;
            }

            const reader = new BrowserMultiFormatReader(undefined, {
                delayBetweenScanAttempts: 150,
                delayBetweenScanSuccess: 1200,
            });

            readerRef.current = reader;
            setScannerError(null);

            try {
                const controls = await reader.decodeFromConstraints(
                    {
                        audio: false,
                        video: {
                            facingMode: { ideal: "environment" },
                        },
                    },
                    videoRef.current,
                    (result) => {
                        if (!result || hasScannedRef.current || disposed) {
                            return;
                        }

                        hasScannedRef.current = true;
                        stopScanner();

                        const audio = new Audio(
                            "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
                        );
                        audio.play().catch(() => {
                            // Ignore autoplay/audio device failures.
                        });

                        onScan(result.getText());
                    }
                );

                if (disposed) {
                    controls.stop();
                    return;
                }

                controlsRef.current = controls;
            } catch (error) {
                if (disposed) {
                    return;
                }

                const message = error instanceof Error ? error.message : "Unable to start camera scanner.";
                setScannerError(message);
            }
        };

        void startScanner();

        return () => {
            disposed = true;
            stopScanner();
            readerRef.current = null;
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg p-6 w-full max-w-md relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
                <h2 className="font-heading text-lg font-bold mb-4">Scan Barcode</h2>
                <div className="overflow-hidden rounded-md border border-border bg-black/90">
                    <video
                        ref={videoRef}
                        className="aspect-square w-full object-cover"
                        autoPlay
                        muted
                        playsInline
                    />
                </div>
                {scannerError ? (
                    <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {scannerError}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                        Point your camera at a barcode to scan.
                    </p>
                )}
            </div>
        </div>
    );
};
