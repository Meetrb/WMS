import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api/axios";

export type UserRole = "admin" | "manager" | "grn_manager" | "putaway_worker" | "picker" | "packer";

export interface User {
    id: string;
    username: string;
    full_name?: string;
    email?: string;
    role: string; // Backend returns string, likely matching UserRole but let's keep it string to be safe or cast it
}

type UserApiResponse = User & {
    user_role?: string;
    userRole?: string;
    role_name?: string;
};

const normalizeRole = (role: string | undefined): string => {
    if (!role) return "";

    const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_");

    if (normalized === "worker" || normalized === "putawayworker") {
        return "putaway_worker";
    }

    return normalized;
};

const normalizeUser = (rawUser: UserApiResponse): User => {
    const resolvedRole = normalizeRole(
        rawUser.role || rawUser.user_role || rawUser.userRole || rawUser.role_name,
    );

    return {
        id: String(rawUser.id ?? ""),
        username: String(rawUser.username ?? ""),
        full_name: rawUser.full_name,
        email: rawUser.email,
        role: resolvedRole,
    };
};

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get('/users/me');
                    const currentUser = normalizeUser(response.data as UserApiResponse);
                    setUser(currentUser);
                    const userRole = currentUser.role || 'unknown';
                    if (userRole && userRole !== 'unknown') {
                        localStorage.setItem('role', userRole);
                    }
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error("Failed to fetch user", error);
                    logout();
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { access_token, refresh_token } = response.data;

            localStorage.setItem('token', access_token);
            localStorage.setItem('refreshToken', refresh_token);

            // Fetch user details
            const userResponse = await api.get('/users/me');
            const currentUser = normalizeUser(userResponse.data as UserApiResponse);
            setUser(currentUser);
            const userRole = currentUser.role || 'unknown';
            if (userRole && userRole !== 'unknown') {
                localStorage.setItem('role', userRole);
            }
            setIsAuthenticated(true);
            return true;
        } catch (error) {
            console.error("Login failed", error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('role');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
