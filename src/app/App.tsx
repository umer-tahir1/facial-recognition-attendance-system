import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { TeacherPortal } from './components/TeacherPortal';
import { Toaster } from 'sonner';

function AppContent() {
  const { user, loading } = useAuth();
  const normalizePath = (path: string) => {
    const normalized = path.replace(/\/+$/, '');
    return normalized || '/';
  };

  const [pathname, setPathname] = useState(normalizePath(window.location.pathname || '/login'));

  const navigate = (path: string) => {
    const targetPath = normalizePath(path);
    const currentPath = normalizePath(window.location.pathname || '/login');

    if (currentPath !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
    setPathname(targetPath);
  };

  useEffect(() => {
    const onPop = () => setPathname(normalizePath(window.location.pathname || '/login'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role === 'admin') {
      navigate('/admin-dashboard');
      return;
    }

    navigate('/teacher-dashboard');
  }, [loading, user]);

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || pathname === '/login') {
    return <Login />;
  }

  if (pathname === '/admin-dashboard' && user.role === 'admin') {
    return <AdminDashboard />;
  }

  if (pathname === '/teacher-dashboard' && user.role === 'teacher') {
    return <TeacherPortal />;
  }

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}