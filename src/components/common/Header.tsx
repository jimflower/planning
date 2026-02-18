import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSettingsStore } from '@/store/settingsStore';
import {
  ClipboardList,
  LayoutDashboard,
  History,
  Mail,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  Wifi,
  WifiOff,
  LogOut,
  User,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'New Plan', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'History', icon: History },
  { to: '/email-history', label: 'Emails', icon: Mail },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const location = useLocation();
  const online = useOnlineStatus();
  const { darkMode, toggleDarkMode } = useSettingsStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { instance, accounts } = useMsal();

  const activeAccount = accounts[0];
  const displayName = activeAccount?.name ?? activeAccount?.username ?? '';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    instance.logoutPopup({ account: activeAccount });
  };

  return (
    <header className="sticky top-0 z-50 bg-primary-600 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo / title */}
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <ClipboardList className="h-6 w-6" />
          <span className="hidden sm:inline">Daily Planning Hub</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                location.pathname === to
                  ? 'bg-white/20'
                  : 'hover:bg-white/10',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <span
            title={online ? 'Online' : 'Offline'}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              online ? 'bg-success-500/20 text-success-100' : 'bg-danger-500/20 text-danger-100',
            )}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
          </span>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="rounded-md p-1.5 hover:bg-white/10"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* User avatar + sign out */}
          {activeAccount && (
            <div className="hidden items-center gap-2 md:flex">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold"
                title={displayName}
              >
                {initials || <User className="h-3.5 w-3.5" />}
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 hover:bg-white/10 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-white/10 md:hidden">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                location.pathname === to ? 'bg-white/20' : 'hover:bg-white/10',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {activeAccount && (
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out ({displayName.split(' ')[0]})
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
