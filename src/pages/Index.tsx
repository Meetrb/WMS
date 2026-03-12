import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { Eye, EyeOff, Warehouse } from "lucide-react";
import warehouseBg from "../assets/warehouse-bg.jpg";

const Index = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/dashboard");
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const success = await login(username, password);
            if (success) {
                navigate("/dashboard");
            } else {
                toast.error("Invalid credentials");
            }
        } catch {
            toast.error("An error occurred during login.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-background">
            {/* Left Side - Brand / Hero */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0A0F1C] text-white flex-col justify-between p-16">

                {/* Background Image - Full Visibility */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={warehouseBg}
                        alt="Warehouse Operations"
                        className="h-full w-full object-cover"
                    />
                    {/* Very subtle gradient just for text readability on the left edge */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
                </div>

                {/* Bottom Gradient for Footer Readability */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent z-0"></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                            <Warehouse className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-2xl tracking-tight text-white drop-shadow-md">WareHouse</h1>
                            <p className="text-white/80 text-xs font-medium tracking-wider uppercase drop-shadow-sm">Enterprise Edition</p>
                        </div>
                    </div>

                    {/* Main Text */}
                    <div className="max-w-xl">
                        <h2 className="font-heading text-5xl font-bold leading-[1.1] mb-6 tracking-tight drop-shadow-lg text-white">
                            Precision logistics for the <span className="text-blue-400">modern era.</span>
                        </h2>
                        <p className="text-lg text-white/90 leading-relaxed mb-8 drop-shadow-md font-medium">
                            Experience the next generation of warehouse management.
                            Seamless integration, real-time analytics, and total operational control.
                        </p>

                        <div className="flex items-center gap-8 text-sm font-medium text-white">
                            <div className="flex items-center gap-2 drop-shadow-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                99.9% Uptime
                            </div>
                            <div className="flex items-center gap-2 drop-shadow-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                Real-time Sync
                            </div>
                            <div className="flex items-center gap-2 drop-shadow-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                Secure Access
                            </div>
                        </div>
                    </div>

                    {/* Testimonial / Footer */}
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-black/30 border border-white/10 backdrop-blur-md max-w-md shadow-xl">
                            <p className="text-sm text-white/90 italic">"The most reliable WMS platform we've ever deployed."</p>
                        </div>
                        <p className="text-xs text-white/70 drop-shadow-sm">© 2026 WareHouse Systems. All rights reserved.</p>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background dark:bg-[#1a1f2e] relative">
                {/* Mobile Background Elements */}
                <div className="absolute inset-0 lg:hidden z-[-1]">
                    <img
                        src={warehouseBg}
                        alt="Background"
                        className="h-full w-full object-cover opacity-10"
                    />
                    <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px]"></div>
                </div>

                <div className="w-full max-w-[420px] bg-card lg:bg-transparent p-8 lg:p-0 rounded-2xl shadow-2xl lg:shadow-none animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="mb-10">
                        <h3 className="font-heading text-3xl font-bold text-foreground mb-2">Sign in</h3>
                        <p className="text-muted-foreground">Access your dashboard using your credentials.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground" htmlFor="username">
                                    Username
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="your_username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="flex h-12 w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground" htmlFor="password">
                                        Password
                                    </label>
                                    <a href="#" className="text-sm text-primary hover:text-primary/90 font-medium">Reset?</a>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="flex h-12 w-full rounded-lg border border-input bg-transparent px-4 py-2 pr-12 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full shadow-lg shadow-primary/20 hover:shadow-primary/30"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Authenticate"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Index;
