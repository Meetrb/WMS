import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

const resolveApiBaseUrl = (): string | undefined => {
    const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
    if (!raw) return undefined;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withProtocol.replace(/\/+$/, '');
};

// 1. Create Base API Configuration
const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Request Interceptor: Attach token for future token-based authentication
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token');
        if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. Response Interceptor: Global response error interceptor and logging
api.interceptors.response.use(
    (response: AxiosResponse) => {
        return response;
    },
    (error: AxiosError) => {
        // Centralized error logging
        console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            message: error.response?.data || error.message
        });

        if (error.response?.status === 401) {
            // Handle unauthorized access (e.g., redirect to login or clear auth state)
            console.warn('Unauthorized access. Please login again.');
            // localStorage.removeItem('token');
            // window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default api;
