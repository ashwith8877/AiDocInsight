import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AppLayout() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="font-semibold text-teal-700">
              AiDocInsight
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link to="/dashboard" className="hover:text-teal-700">
                Dashboard
              </Link>
              <Link to="/upload" className="hover:text-teal-700">
                Upload
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{user?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
