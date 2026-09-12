import React, { useState } from 'react';
import {
  Database,
  Bell,
  User,
  LogOut,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, SystemHealth } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  health: SystemHealth | null;
  unreadCount: number;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenDbStatus: () => void;
  onOpenNotifications: () => void;
  onOpenAlertSettings?: () => void;
  refreshHealth: () => void;
  onTestConnect?: () => void;
  isTestingDb?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  health,
  unreadCount,
  onOpenAuth,
  onLogout,
  onOpenDbStatus,
  onOpenNotifications,
  onOpenAlertSettings,
  refreshHealth,
  onTestConnect,
  isTestingDb = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMongo = health?.database?.connectedToMongoDB;

  return (
    <>
      <header className="border-b border-sky-900/40 bg-[#060d19]/90 backdrop-blur-md sticky top-0 z-40 shadow-sm shadow-sky-950/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand & Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-950 via-[#0a1529] to-cyan-950 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm shadow-sky-500/20">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-cinzel font-bold text-slate-100 tracking-wide text-base sm:text-lg">
                  Dobby
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  The AI Elf Assistant
                </span>
              </div>
              <p className="text-[10px] text-sky-200/60 hidden sm:block">
                Your faithful AI Elf task &amp; reminder assistant
              </p>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* WhatsApp Alerts */}
            {user && onOpenAlertSettings && (
              <button
                id="btn-whatsapp-alerts"
                onClick={onOpenAlertSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 transition-all"
                title="Configure WhatsApp Alerts"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            )}

            {/* Database Status */}
            <button
              id="btn-db-status"
              onClick={onOpenDbStatus}
              title="Database status and diagnostics"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isMongo
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-[#0a1529] border-sky-900/40 text-sky-200 hover:bg-[#0e1d38] hover:border-sky-700/50'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>{isMongo ? 'MongoDB Atlas' : 'Local Basin'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isMongo ? 'bg-emerald-400' : 'bg-sky-400'
                }`}
              />
            </button>

            {/* Notifications */}
            {user && (
              <button
                id="btn-notifications"
                onClick={onOpenNotifications}
                className="relative p-2 rounded-xl text-sky-300/70 hover:text-sky-100 hover:bg-[#0a1529] transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* User Account */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-sky-900/40">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-sky-200/60 truncate max-w-[120px]">{user.email}</div>
                </div>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  className="p-2 rounded-xl text-sky-300/70 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="btn-signin-header"
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-200 hover:text-white hover:bg-sky-900/30 border border-sky-800/40 transition-all"
                >
                  Sign In
                </button>
                <button
                  id="btn-signup-header"
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Actions Bar */}
          <div className="flex items-center gap-1.5 md:hidden">
            {!user && (
              <button
                onClick={() => onOpenAuth('login')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 shadow-sm"
              >
                Sign In
              </button>
            )}
            {/* WhatsApp Quick Icon */}
            {user && onOpenAlertSettings && (
              <button
                onClick={onOpenAlertSettings}
                className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 relative"
                title="WhatsApp Alerts"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            )}

            {/* Notification Bell */}
            {user && (
              <button
                onClick={onOpenNotifications}
                className="p-2 rounded-xl text-slate-300 hover:bg-slate-900 relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile Hamburger / Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Open Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed top-0 right-0 bottom-0 w-4/5 max-w-xs bg-[#070e1c] border-l border-sky-900/40 p-5 flex flex-col justify-between shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-sky-900/40">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-cinzel font-bold text-slate-100 text-sm">Dobby Menu</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-sky-300/70 hover:text-white hover:bg-[#0c182f]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Info */}
              {user ? (
                <div className="p-3 rounded-xl bg-[#0b1528] border border-sky-900/40">
                  <div className="text-xs font-bold text-slate-200">{user.name}</div>
                  <div className="text-[11px] text-sky-200/60 truncate">{user.email}</div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="mt-2 text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('login');
                    }}
                    className="py-2.5 rounded-xl bg-[#0e1d38] border border-sky-800/50 text-sky-200 hover:text-white font-bold text-xs flex items-center justify-center transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('register');
                    }}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sign Up</span>
                  </button>
                </div>
              )}

              {/* Menu Items */}
              <div className="space-y-2 pt-2">
                {onOpenAlertSettings && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAlertSettings();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs font-bold text-left"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp Alerts</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-normal">Active</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDbStatus();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0b1528] border border-sky-900/40 text-sky-200 text-xs font-semibold text-left"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span>Database Status</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                </button>
              </div>
            </div>

            <div className="text-[10px] text-sky-300/50 text-center pt-4 border-t border-sky-900/30">
              Dobby — The AI Elf Assistant
            </div>
          </div>
        </div>
      )}
    </>
  );
};
