import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle2, AlertCircle, Package, Truck } from "lucide-react";

const mockNotifications = [
    {
        id: 1,
        title: "Purchase Order Received",
        message: "PO-2024-001 has been fully received.",
        time: "2 hours ago",
        type: "success",
        icon: CheckCircle2,
    },
    {
        id: 2,
        title: "Low Stock Alert",
        message: "Item 'Wireless Mouse' is below reorder point.",
        time: "5 hours ago",
        type: "warning",
        icon: AlertCircle,
    },
    {
        id: 3,
        title: "New Shipment",
        message: "A new shipment from Vendor XYZ is scheduled for tomorrow.",
        time: "1 day ago",
        type: "info",
        icon: Truck,
    },
    {
        id: 4,
        title: "Putaway Task Assigned",
        message: "You have 5 new items to put away.",
        time: "1 day ago",
        type: "info",
        icon: Package,
    },
];

const Notifications = () => {
    return (
        <div className="p-4 md:p-8 space-y-6">
            <div>
                <h1 className="font-heading text-3xl font-bold">Notifications</h1>
                <p className="text-muted-foreground">
                    Stay updated with system alerts and activities
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Recent Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    {mockNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                            <div className={`mt-1 p-2 rounded-full ${notification.type === "success" ? "bg-green-100 text-green-600" :
                                    notification.type === "warning" ? "bg-yellow-100 text-yellow-600" :
                                        "bg-blue-100 text-blue-600"
                                }`}>
                                <notification.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="font-medium leading-none">{notification.title}</p>
                                <p className="text-sm text-muted-foreground">
                                    {notification.message}
                                </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {notification.time}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

export default Notifications;
