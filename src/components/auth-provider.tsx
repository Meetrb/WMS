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
                    setUser(response.data);
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
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            // Backend expects OAuth2 password request form data usually, or JSON?
            // In auth.py: async def login(data: UserLogin...
            // UserLogin is Pydantic model. So it expects JSON.
            // Wait, standard OAuth2PasswordRequestForm expects form data.
            // Let's check auth.py again.
            // @router.post("/login", response_model=Token)
            // async def login(data: UserLogin, ...):
            // UserLogin is a Pydantic model (JSON body).
            // So we send JSON.

            const response = await api.post('/auth/login', { username, password });
            const { access_token, refresh_token } = response.data;

            localStorage.setItem('token', access_token);
            localStorage.setItem('refreshToken', refresh_token);

            // Fetch user details
            const userResponse = await api.get('/users/me');
            setUser(userResponse.data);
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
