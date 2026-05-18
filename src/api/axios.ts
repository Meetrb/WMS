import axios from 'axios';

const resolveApiBaseUrl = (): string | undefined => {
    const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
    if (!raw) return undefined;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withProtocol.replace(/\/+$/, '');
};

const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
// import axios from 'axios';

// const resolveApiBaseUrl = (): string | undefined => {
//     const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
//     if (!raw) return undefined;

//     const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
//     return withProtocol.replace(/\/+$/, '');
// };

// const api = axios.create({
//     baseURL: resolveApiBaseUrl(),
//     headers: {
//         'Content-Type': 'application/json',
//     },
//     withCredentials: true, // 🔥 IMPORTANT: send cookies with requests
// });

// // ❌ REMOVE token interceptor completely
// // No Authorization header needed

// api.interceptors.request.use(
//     (config) => {
//         // You can keep this if you want logging or future headers
//         return config;
//     },
//     (error) => {
//         return Promise.reject(error);
//     }
// );

// export default api;