// frontend-app/src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Interceptor untuk menambahkan token ke request REST ---
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt-token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- API Auth (Baru) ---
export const authApi = {
  // Rute publik, tidak perlu token
  register: (userData: any) => 
    apiClient.post('/api/auth/register', userData),
  
  login: (credentials: any) => 
    apiClient.post('/api/auth/login', credentials),
};

// --- User API (Lama, sekarang terproteksi) ---
export const userApi = {
  // Request ini sekarang akan otomatis mengirim token (via interceptor)
  getUsers: () => apiClient.get('/api/users'), 
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
};