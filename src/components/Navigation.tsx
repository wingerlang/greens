import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import logo from '../assets/logo_icon.png';
import './Navigation.css';
import { Logo } from './Logo.tsx';

interface NavigationProps {
    onOpenOmnibox?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onOpenOmnibox }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useSettings();
    const { cycleProgress, currentGoal, dailyCaloriesConsumed, targetCalories, activeCycle } = useHealth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isAdminRoute = ['/admin', '/database', '/api', '/documentation'].some(path => location.pathname.startsWith(path));
    const isFoodRoute = ['/planera', '/pantry', '/recipes'].some(path => location.pathname.startsWith(path));
    const isHealthRoute = ['/health', '/halsa', '/traning', '/calories'].some(path => location.pathname.startsWith(path));

    const linkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
        }`;

    // Parent button style for dropdowns
    const groupClasses = (isActive: boolean) =>
        `flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
        }`;

    const mobileLinkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-200 ${isActive
            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-500/10'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        }`;

    return (
        <nav className="sticky top-0 z-[100] w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand */}
                    <div className="flex-shrink-0">
                        <NavLink to="/" className="flex items-center gap-2 group">
                            <Logo size="sm" showText={true} />
                        </NavLink>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-1">
                        {/* Cycle Status Widget */}
                        {(activeCycle && cycleProgress) && (
                            <div className="mr-4 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-medium">
                                <span className={{
                                    'deff': 'text-rose-400',
                                    'bulk': 'text-emerald-400',
                                    'neutral': 'text-blue-400'
                                }[currentGoal]}>
                                    ●
                                </span>
                                <span className="text-slate-300">{activeCycle.name}</span>
                                {cycleProgress.daysLeft !== undefined && (
                                    <span className="text-slate-500 border-l border-white/10 pl-2 ml-1">
                                        {cycleProgress.daysLeft} dagar kvar
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Energy Meter (Desktop Mini) */}
                        {targetCalories > 0 && (
                            <div className="hidden xl:flex flex-col justify-center mr-4 w-24 gap-1" title={`${Math.round(dailyCaloriesConsumed)} / ${targetCalories} kcal`}>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 leading-none">
                                    <span>KCAL</span>
                                    <span className={dailyCaloriesConsumed > targetCalories ? 'text-amber-500' : 'text-slate-500'}>
                                        {Math.round((dailyCaloriesConsumed / targetCalories) * 100)}%
                                    </span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${dailyCaloriesConsumed > targetCalories ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, (dailyCaloriesConsumed / targetCalories) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Veckan (Home) */}
                        <NavLink to="/" end className={linkClasses}>
                            <span>📅</span>
                            <span className="hidden xl:inline">Veckan</span>
                        </NavLink>

                        {/* Mat Dropdown */}
                        <div className="relative group">
                            <button className={groupClasses(isFoodRoute)}>
                                <span>🍽️</span>
                                <span className="hidden xl:inline">Mat</span>
                                <span className="text-[10px] opacity-50 ml-1 group-hover:rotate-180 transition-transform">▼</span>
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <div className="grid gap-1">
                                    <NavLink to="/planera" className={linkClasses}>
                                        <span className="w-5 text-center">✨</span>
                                        <span>Planera</span>
                                    </NavLink>
                                    <NavLink to="/pantry" className={linkClasses}>
                                        <span className="w-5 text-center">🏠</span>
                                        <span>Skafferi</span>
                                    </NavLink>
                                    <NavLink to="/recipes" className={linkClasses}>
                                        <span className="w-5 text-center">📖</span>
                                        <span>Recept</span>
                                    </NavLink>
                                </div>
                            </div>
                        </div>

                        {/* Hälsa Dropdown */}
                        <div className="relative group">
                            <button className={groupClasses(isHealthRoute)}>
                                <span>💪</span>
                                <span className="hidden xl:inline">Hälsa</span>
                                <span className="text-[10px] opacity-50 ml-1 group-hover:rotate-180 transition-transform">▼</span>
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <div className="grid gap-1">
                                    <NavLink to="/health" className={linkClasses}>
                                        <span className="w-5 text-center">📊</span>
                                        <span>Översikt</span>
                                    </NavLink>
                                    <NavLink to="/training" className={linkClasses}>
                                        <span className="w-5 text-center">🏋️</span>
                                        <span>Träning</span>
                                    </NavLink>
                                    <NavLink to="/logg" className={linkClasses}>
                                        <span className="w-5 text-center">📜</span>
                                        <span>Aktivitetslogg</span>
                                    </NavLink>
                                    <NavLink to="/styrka" className={linkClasses}>
                                        <span className="w-5 text-center">💪</span>
                                        <span>Styrketräning</span>
                                    </NavLink>
                                    <NavLink to="/coach" className={linkClasses}>
                                        <span className="w-5 text-center">🧠</span>
                                        <span>Smart Coach</span>
                                    </NavLink>
                                    <NavLink to="/calories" className={linkClasses}>
                                        <span className="w-5 text-center">🔥</span>
                                        <span>Kalorier</span>
                                    </NavLink>
                                </div>
                            </div>
                        </div>

                        {/* Community */}
                        <NavLink to="/community" className={linkClasses}>
                            <span>👥</span>
                            <span className="hidden xl:inline">Community</span>
                        </NavLink>

                        {/* Tävling */}
                        <NavLink to="/tävling" className={linkClasses}>
                            <span>🏆</span>
                            <span className="hidden xl:inline">Tävling</span>
                        </NavLink>

                        <div className="h-6 w-px bg-white/10 mx-2" />

                        {/* Admin Dropdown */}
                        <div className="relative group">
                            <button className={`${linkClasses({ isActive: isAdminRoute })} flex items-center gap-1`}>
                                <span>🛠️</span>
                                <span className="hidden xl:inline">System</span>
                                <span className="text-[10px] opacity-50 ml-1 group-hover:rotate-180 transition-transform">▼</span>
                            </button>

                            <div className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <div className="grid gap-1">
                                    <NavLink to="/admin?tab=audit" className={linkClasses}>
                                        <span className="w-5 text-center">⚙️</span>
                                        <span>Dashboard</span>
                                    </NavLink>
                                    <NavLink to="/admin?tab=database" className={linkClasses}>
                                        <span className="w-5 text-center">📦</span>
                                        <span>Databas</span>
                                    </NavLink>
                                    <NavLink to="/admin?tab=api" className={linkClasses}>
                                        <span className="w-5 text-center">⚡</span>
                                        <span>API</span>
                                    </NavLink>
                                    <NavLink to="/admin?tab=docs" className={linkClasses}>
                                        <span className="w-5 text-center">📚</span>
                                        <span>Regler</span>
                                    </NavLink>
                                    <div className="border-t border-white/5 my-1" />
                                    <NavLink to="/admin?tab=users" className={linkClasses}>
                                        <span className="w-5 text-center">👥</span>
                                        <span>Användare</span>
                                    </NavLink>
                                    <NavLink to="/admin?tab=roadmap" className={linkClasses}>
                                        <span className="w-5 text-center">🚀</span>
                                        <span>Roadmap</span>
                                    </NavLink>
                                </div>
                            </div>
                        </div>

                        {/* User Profile & Logout */}
                        <div className="h-6 w-px bg-white/10 mx-2" />

                        <div className="relative group">
                            <Link
                                to="/profile"
                                className={`${linkClasses({ isActive: location.pathname === '/profile' })} flex items-center gap-2 !px-3 !py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-white/5`}
                            >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">
                                    {user?.username?.substring(0, 1).toUpperCase() || 'U'}
                                </div>
                                <span className="hidden xl:inline text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                                    {user?.username || 'Gäst'}
                                </span>
                            </Link>

                            <div className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <NavLink
                                    to="/settings"
                                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-5 text-center">⚙️</span>
                                    <span>Inställningar</span>
                                </NavLink>
                                <NavLink
                                    to="/sync"
                                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-5 text-center">🔄</span>
                                    <span>Synkningar</span>
                                </NavLink>
                                <div className="h-px bg-white/5 my-1" />
                                <button
                                    onClick={logout}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 font-bold text-xs hover:text-rose-400 hover:bg-rose-500/10 transition-all w-full text-left"
                                >
                                    <span className="w-5 text-center">🚪</span>
                                    <span>Logga ut</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onOpenOmnibox}
                            className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all font-medium group"
                            title="Öppna sök / Cmd+K"
                        >
                            <span className="text-sm group-hover:scale-110 transition-transform">🔍</span>
                        </button>

                        {/* Mobile Menu Button */}
                        <button
                            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            ☰
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {
                isMenuOpen && (
                    <div className="lg:hidden border-t border-white/5 bg-slate-950 px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
                        <NavLink to="/" end className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">📅</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Veckan</span>
                                <span className="text-[10px] text-slate-500 font-medium">Översikt</span>
                            </div>
                        </NavLink>

                        {/* Mobile Mat */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">Mat</div>
                            <NavLink to="/planera" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">✨</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Planera</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Måltider & Pass</span>
                                </div>
                            </NavLink>
                            {user && (
                                <div className="px-4 py-2">
                                    <div className="text-[10px] text-slate-500 font-bold mb-1 flex justify-between">
                                        <span>ENERGIBALANS</span>
                                        <span>{Math.round(dailyCaloriesConsumed)} / {targetCalories} kcal</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${dailyCaloriesConsumed > targetCalories ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(100, (dailyCaloriesConsumed / targetCalories) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <NavLink to="/pantry" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">🏠</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Skafferi</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Hantera ingredienser</span>
                                </div>
                            </NavLink>
                            <NavLink to="/recipes" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">📖</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Recept</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Hitta & skapa</span>
                                </div>
                            </NavLink>
                        </div>

                        {/* Mobile Hälsa */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">Hälsa & Träning</div>
                            <NavLink to="/health" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">📊</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Översikt</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Trender & Insikter</span>
                                </div>
                            </NavLink>
                            <NavLink to="/training" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">🏋️</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Träning</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Logga pass</span>
                                </div>
                            </NavLink>
                            <NavLink to="/coach" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">🧠</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Smart Coach</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Planera & Analysera</span>
                                </div>
                            </NavLink>
                            <NavLink to="/calories" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">🔥</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Kalorier</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Logga mat</span>
                                </div>
                            </NavLink>
                        </div>

                        {/* Mobile Community */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">Gemenskap</div>
                            <NavLink to="/community" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">👥</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Community</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Hitta vänner</span>
                                </div>
                            </NavLink>
                        </div>

                        {/* Mobile Tävling */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">Utmaningar</div>
                            <NavLink to="/tävling" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <span className="text-xl">🏆</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">Tävling</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Utmana & Vinn</span>
                                </div>
                            </NavLink>
                        </div>

                        <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">System & Verktyg</div>
                            <NavLink to="/admin?tab=audit" className={linkClasses({ isActive: false })} onClick={() => setIsMenuOpen(false)}>
                                <span className="w-5 text-center">⚙️</span>
                                <span>Dashboard</span>
                            </NavLink>
                            <NavLink to="/admin?tab=database" className={linkClasses({ isActive: false })} onClick={() => setIsMenuOpen(false)}>
                                <span className="w-5 text-center">📦</span>
                                <span>Databas</span>
                            </NavLink>
                        </div>
                    </div >
                )
            }
        </nav >
    );
}
