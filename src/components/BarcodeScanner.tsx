import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string, decodedResult: any) => void;
    onScanFailure?: (error: any) => void;
    fps?: number;
    qrbox?: number | { width: number; height: number };
    aspectRatio?: number;
    disableFlip?: boolean;
    verbose?: boolean;
}

const BarcodeScanner = (props: BarcodeScannerProps) => {
    const scannerRegionId = "html5qr-code-full-region";
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        // Clear any existing scanner instance if it exists (though it shouldn't for a fresh mount)
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }

        // Initialize Scanner
        const config = {
            fps: props.fps || 10,
            qrbox: props.qrbox || { width: 250, height: 250 },
            aspectRatio: props.aspectRatio,
            disableFlip: props.disableFlip,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            rememberLastUsedCamera: true
        };

        const scanner = new Html5QrcodeScanner(scannerRegionId, config, props.verbose || false);
        scannerRef.current = scanner;

        scanner.render(
            (decodedText, decodedResult) => {
                props.onScanSuccess(decodedText, decodedResult);
                // We don't automatically clear here to allow continuous scanning if needed, 
                // but usually the parent will unmount this component or we can add a prop for it.
            },
            (errorMessage) => {
                // This callback is triggered very frequently (on every frame it doesn't find a code)
                // behave carefully here.
                if (props.onScanFailure) {
                    props.onScanFailure(errorMessage);
                }
            }
        );

        // Cleanup function
        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(error => {
                        console.error("Failed to clear html5-qrcode scanner during cleanup", error);
                    });
                } catch (e) {
                    console.error("Error clearing scanner", e);
                }
            }
        };
    }, []);

    return (
        <div className="w-full max-w-md mx-auto relative space-y-4">
            <div id={scannerRegionId} className="overflow-hidden rounded-lg border bg-slate-100 shadow-inner" />

            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="w-3 h-3" />
                <span>Camera permission is required to scan.</span>
            </div>

            <style>
                {`
                #html5qr-code-full-region img {
                    display: none; /* Hide the info icon if present */
                }
                #html5qr-code-full-region__scan_region {
                    background: transparent;
                }
                `}
            </style>
        </div>
    );
};

export default BarcodeScanner;
