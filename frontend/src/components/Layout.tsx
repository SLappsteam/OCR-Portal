import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Store,
  Settings,
  User,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/documents', label: 'Documents', icon: <FileText size={20} /> },
  { path: '/batches', label: 'Batches', icon: <FolderOpen size={20} /> },
  { path: '/stores', label: 'Stores', icon: <Store size={20} />, adminOnly: true },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} />, adminOnly: true },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Slumberland"
            className="h-12 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <p className="text-xs text-gray-400 mt-1">Document Portal</p>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
              <User size={14} className="text-gray-500" />
            </div>
            <div className="text-xs">
              <div className="font-medium text-gray-700">Admin User</div>
              <div className="text-gray-400">admin@slumberland.com</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-white">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
