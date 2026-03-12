import { useState } from "react";
import {
    CheckCircle2,
    MapPin,
    Package,
    ScanBarcode,
    ArrowRight,
    Clock,
    AlertCircle,
    RotateCcw,
    ShoppingCart,
    Users
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import BarcodeScanner from "@/components/BarcodeScanner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// Mock Data for Picking Tasks
const MOCK_PICKING_TASKS = [
    {
        id: "PICK-201",
        orderId: "SO-5001",
        productName: "Wireless Mouse",
        skuCode: "WM-001",
        itemBarcode: "8901234567890",
        location: "BIN-A-01-02",
        quantity: 5,
        status: "pending", // pending, in-progress, completed
        priority: "high",
        assignedAt: "09:00 AM",
        assignedTo: "Picker 1"
    },
    {
        id: "PICK-202",
        orderId: "SO-5002",
        productName: "Mechanical Keyboard",
        skuCode: "MK-002",
        itemBarcode: "8901234567891",
        location: "BIN-B-05-01",
        quantity: 2,
        status: "pending",
        priority: "medium",
        assignedAt: "09:30 AM",
        assignedTo: "Picker 2"
    },
    {
        id: "PICK-203",
        orderId: "SO-5003",
        productName: "USB-C Cable (2m)",
        skuCode: "UC-003",
        itemBarcode: "8901234567892",
        location: "BIN-A-02-04",
        quantity: 10,
        status: "pending",
        priority: "low",
        assignedAt: "10:15 AM",
        assignedTo: "Picker 1"
    }
];

type Task = typeof MOCK_PICKING_TASKS[0];

const PickingTasks = () => {
    const [tasks, setTasks] = useState<Task[]>(MOCK_PICKING_TASKS);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { user } = useAuth();
    const isReadOnly = user?.role === "admin" || user?.role === "manager";

    // Scanner State
    const [scannedItemBarcode, setScannedItemBarcode] = useState("");
    const [scannedLocationBarcode, setScannedLocationBarcode] = useState("");
    const [step, setStep] = useState<1 | 2>(1); // 1: Scan Location, 2: Scan Item (Reversed from Putaway)
    const [error, setError] = useState<string | null>(null);

    // Camera Scanner State
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

    const handleCameraScanSuccess = (decodedText: string) => {
        setIsCameraScannerOpen(false);
        if (step === 1) {
            setScannedLocationBarcode(decodedText);
            // Optional: Auto-verify
        } else {
            setScannedItemBarcode(decodedText);
            // Optional: Auto-verify
        }
        toast.success(`Scanned: ${decodedText}`);
    };

    const handleStartTask = (task: Task) => {
        setActiveTask(task);
        setStep(1);
        setScannedItemBarcode("");
        setScannedLocationBarcode("");
        setError(null);
        setIsDialogOpen(true);
    };

    const verifyLocationBarcode = () => {
        if (!activeTask) return;

        if (scannedLocationBarcode === activeTask.location) {
            setStep(2);
            setError(null);
            toast.success("Location verified! Now scan the item.");
        } else {
            setError("Incorrect Location Barcode. You are at the wrong bin.");
            toast.error("Incorrect Location Barcode");
        }
    };

    const verifyItemBarcode = () => {
        if (!activeTask) return;

        if (scannedItemBarcode === activeTask.itemBarcode) {
            // Success! Complete the task
            completeTask(activeTask.id);
        } else {
            setError("Incorrect Item Barcode. Please scan the correct item.");
            toast.error("Incorrect Item Barcode");
        }
    };

    const completeTask = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: "completed" } : t
        ));
        setIsDialogOpen(false);
        setActiveTask(null);
        toast.success("Item picked successfully! Ready for packaging.");
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high": return "destructive";
            case "medium": return "default";
            case "low": return "secondary";
            default: return "secondary";
        }
    };

    const pendingTasks = tasks.filter(t => t.status === "pending");
    const completedTasks = tasks.filter(t => t.status === "completed");

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Picking Tasks</h1>
                    <p className="text-muted-foreground">
                        Process pending sales orders for picking
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="text-sm py-1">
                        Pending: {pendingTasks.length}
                    </Badge>
                    <Badge variant="secondary" className="text-sm py-1 bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                        Picked: {completedTasks.length}
                    </Badge>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Task ID</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.map((task) => (
                            <TableRow key={task.id}>
                                <TableCell className="font-medium">{task.id}</TableCell>
                                <TableCell>{task.orderId}</TableCell>
                                <TableCell>{task.productName}</TableCell>
                                <TableCell>{task.skuCode}</TableCell>
                                <TableCell>{task.location}</TableCell>
                                <TableCell>{task.quantity}</TableCell>
                                <TableCell>
                                    <Badge variant={getPriorityColor(task.priority) as any} className="uppercase text-[10px]">
                                        {task.priority}
                                    </Badge>
                                </TableCell>
                                <TableCell>{task.assignedTo}</TableCell>
                                <TableCell>
                                    <Badge variant={task.status === 'completed' ? 'secondary' : 'outline'}>
                                        {task.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant={isReadOnly ? "ghost" : "default"} size="sm" onClick={() => handleStartTask(task)}>
                                        {isReadOnly ? "View Details" : "Start"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Task Execution Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Picking Execution</DialogTitle>
                        <DialogDescription>
                            Follow the steps to pick the correct item.
                        </DialogDescription>
                    </DialogHeader>

                    {activeTask && (
                        <div className="space-y-6 py-4">
                            {/* Progress Indicator */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className={step >= 1 ? "text-primary font-bold" : ""}>1. Verify Location</span>
                                    <span className={step >= 2 ? "text-primary font-bold" : ""}>2. Verify Item</span>
                                </div>
                                <Progress value={step === 1 ? 50 : 100} className="h-2" />
                            </div>

                            {/* Task Summary */}
                            <div className="bg-slate-50 p-3 rounded-md space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Item:</span>
                                    <span className="font-medium">{activeTask.productName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Qty to Pick:</span>
                                    <span className="font-bold text-lg text-primary">{activeTask.quantity}</span>
                                </div>
                                <div className="flex justify-between bg-blue-50 p-1 rounded border border-blue-100">
                                    <span className="text-blue-700">Target Bin:</span>
                                    <span className="font-bold text-blue-700">{activeTask.location}</span>
                                </div>
                            </div>

                            {/* Verification Input Area */}
                            <div className="space-y-4">
                                {step === 1 ? (
                                    <div className="space-y-3">
                                        <Label>Scan Bin Location</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Scan bin location..."
                                                    className="pl-9"
                                                    value={scannedLocationBarcode}
                                                    onChange={(e) => setScannedLocationBarcode(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && verifyLocationBarcode()}
                                                    autoFocus
                                                />
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => setIsCameraScannerOpen(true)}>
                                                <ScanBarcode className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Expected: <code className="bg-slate-100 px-1 py-0.5 rounded">{activeTask.location}</code>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Label>Scan Item Barcode</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <ScanBarcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Scan item barcode..."
                                                    className="pl-9"
                                                    value={scannedItemBarcode}
                                                    onChange={(e) => setScannedItemBarcode(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && verifyItemBarcode()}
                                                    autoFocus
                                                />
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => setIsCameraScannerOpen(true)}>
                                                <ScanBarcode className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Expected: <code className="bg-slate-100 px-1 py-0.5 rounded">{activeTask.itemBarcode}</code>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="sm:justify-between gap-2">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={step === 1 ? verifyLocationBarcode : verifyItemBarcode}
                            disabled={!activeTask}
                        >
                            {step === 1 ? "Verify Location" : "Confirm Pick"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Camera Scanner Dialog */}
            <Dialog open={isCameraScannerOpen} onOpenChange={setIsCameraScannerOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Scan Barcode</DialogTitle>
                        <DialogDescription>
                            Point your camera at the barcode to scan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4">
                        {isCameraScannerOpen && (
                            <BarcodeScanner
                                onScanSuccess={handleCameraScanSuccess}
                                onScanFailure={(err) => console.log(err)}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PickingTasks;
