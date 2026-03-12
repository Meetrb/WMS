import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const Scanner = ({ onScan, onClose }: ScannerProps) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        // Initialize scanner
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            },
            false
        );

        scannerRef.current = scanner;

        scanner.render(
            (decodedText) => {
                onScan(decodedText);
                // creating a sound effect for success
                const audio = new Audio(
                    "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
                );
                audio.play().catch(() => { }); // Ignore play errors
            },
            () => { }
        );

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
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
                <div id="reader" className="w-full overflow-hidden rounded-md"></div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    Point your camera at a barcode to scan.
                </p>
            </div>
        </div>
    );
};
