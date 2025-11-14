// frontend-app/src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { authApi } from '@/lib/api'; // Ganti userApi dengan authApi

// --- GraphQL queries and mutations (Baru) ---
const GET_TASKS = gql`
  query GetTasks {
    tasks {
      id
      title
      description
      status
      authorId
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!, $description: String!) {
    createTask(title: $title, description: $description) {
      id
      title
      description
      status
    }
  }
`;

const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($id: ID!, $status: TaskStatus!) {
    updateTaskStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

// --- Komponen Utama ---
export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  
  // State untuk Form Login/Register
  const [email, setEmail] = useState('john@example.com');
  const [password, setPassword] = useState('password123');
  
  // State untuk Form Task Baru
  const [newTask, setNewTask] = useState({ title: '', description: '' });

  // GraphQL hooks
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useQuery(GET_TASKS, {
    skip: !token, // Jangan jalankan query jika tidak ada token
  });
  const [createTask] = useMutation(CREATE_TASK);
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS);

  // Cek token di local storage saat komponen dimuat
  useEffect(() => {
    const storedToken = localStorage.getItem('jwt-token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Handler untuk Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await authApi.login({ email, password });
      const { token } = response.data;
      localStorage.setItem('jwt-token', token);
      setToken(token);
      refetchTasks(); // Ambil data task setelah login
    } catch (error) {
      console.error('Error logging in:', error);
      alert('Login Gagal!');
    }
  };

  // Handler untuk Logout
  const handleLogout = () => {
    localStorage.removeItem('jwt-token');
    setToken(null);
  };

  // Handler untuk Buat Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTask({
        variables: newTask,
      });
      setNewTask({ title: '', description: '' });
      refetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Handler untuk Update Status Task
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateTaskStatus({
        variables: { id, status: newStatus }
      });
      refetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };
  
  // --- Tampilan (View) ---
  
  // Jika tidak ada token, tampilkan form Login
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">
            Login
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full"
            >
              Login
            </button>
            <p className="text-sm text-gray-600 text-center">
              (Use john@example.com / password123)
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Jika ada token, tampilkan aplikasi Task Management
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">
            Task Management
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kolom 1: Buat Task Baru */}
          <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <input
                type="text"
                placeholder="Title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="border rounded-md px-3 py-2 w-full h-24"
                required
              />
              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 w-full"
              >
                Add Task
              </button>
            </form>
          </div>

          {/* Kolom 2: Daftar Task */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Tasks</h2>
            {tasksLoading ? (
              <p>Loading tasks...</p>
            ) : (
              <div className="space-y-4">
                {tasksData?.tasks.map((task: any) => (
                  <div key={task.id} className="p-4 border rounded shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{task.title}</h3>
                        <p className="text-gray-600 mt-1">{task.description}</p>
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="border rounded-md px-2 py-1"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Author ID: {task.authorId}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}