import { useEffect, useState } from "react";
import api from "../api/axios";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

interface User {
    id: string;
    username: string;
    full_name?: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at?: string;
}

const Users = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newUser, setNewUser] = useState({
        username: "",
        email: "",
        password: "",
        full_name: "",
        role: "picker",
    });

    const fetchUsers = async () => {
        try {
            const response = await api.get("/users/");
            setUsers(response.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post("/auth/signup", newUser);
            toast.success("User created successfully");
            setIsDialogOpen(false);
            setNewUser({ username: "", email: "", password: "", full_name: "", role: "picker" }); // Reset form
            fetchUsers(); // Refresh list
        } catch (error: any) {
            console.error("Failed to create user", error);
            toast.error(error.response?.data?.detail || "Failed to create user");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (userId: string, currentStatus: boolean) => {
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));

        try {
            await api.patch(`/users/${userId}`, { is_active: !currentStatus });
            toast.success("User status updated");
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error("Failed to update status");
            // Revert on failure
            setUsers(users.map(u => u.id === userId ? { ...u, is_active: currentStatus } : u));
        }
    };

    if (loading) {
        return <div className="p-8">Loading users...</div>;
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-heading font-bold tracking-tight">User Management</h2>
                    <p className="text-muted-foreground">Manage user access and roles.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create New User</DialogTitle>
                            <DialogDescription>
                                Add a new user to the system. Click save when you're done.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="username" className="text-right">
                                        Username
                                    </Label>
                                    <Input
                                        id="username"
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="password" className="text-right">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="full_name" className="text-right">
                                        Full Name
                                    </Label>
                                    <Input
                                        id="full_name"
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="role" className="text-right">
                                        Role
                                    </Label>
                                    <Select
                                        value={newUser.role}
                                        onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                                    >
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="manager">Manager</SelectItem>
                                            <SelectItem value="picker">Picker</SelectItem>
                                            <SelectItem value="packer">Packer</SelectItem>
                                            <SelectItem value="putaway_worker">Putaway Worker</SelectItem>
                                            <SelectItem value="grn_manager">GRN Manager</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Creating..." : "Create User"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableCaption>A list of all registered users.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={user.is_active}
                                                onCheckedChange={() => handleStatusChange(user.id, user.is_active)}
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {user.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Users;
