import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const authApi = {
  register: (userData: any) => 
    apiClient.post('/api/auth/register', userData),
  
  login: (credentials: any) => 
    apiClient.post('/api/auth/login', credentials),
};

export const userApi = {
  getUsers: () => apiClient.get('/api/users'), 
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
};

export const teamApi = {
  getMyTeams: () => apiClient.get('/api/teams'),
  getTeamById: (id: string) => apiClient.get(`/api/teams/${id}`),
};