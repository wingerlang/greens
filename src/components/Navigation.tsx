import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.tsx';
import { Logo } from './Logo.tsx';

export function Navigation() {
    const { theme, toggleTheme } = useSettings();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();

    const isAdminRoute = ['/admin', '/database', '/api', '/documentation'].some(path => location.pathname === path);

    const linkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
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
                        {/* Daily Drivers */}
                        <div className="flex items-center gap-1 border-r border-white/5 pr-2 mr-2">
                            <NavLink to="/" end className={linkClasses}>
                                <span>📅</span>
                                <span className="hidden xl:inline">Veckan</span>
                            </NavLink>
                            <NavLink to="/planera" className={linkClasses}>
                                <span>✨</span>
                                <span className="hidden xl:inline">Planera</span>
                            </NavLink>
                            <NavLink to="/calories" className={linkClasses}>
                                <span>🔥</span>
                                <span className="hidden xl:inline">Kalorier</span>
                            </NavLink>
                            <NavLink to="/training" className={linkClasses}>
                                <span>🏋️</span>
                                <span className="hidden xl:inline">Träning</span>
                            </NavLink>
                            <NavLink to="/health" className={linkClasses}>
                                <span>📊</span>
                                <span className="hidden xl:inline">Hälsa</span>
                            </NavLink>
                            <NavLink to="/pantry" className={linkClasses}>
                                <span>🏠</span>
                                <span className="hidden xl:inline">Skafferi</span>
                            </NavLink>
                            <NavLink to="/recipes" className={linkClasses}>
                                <span>📖</span>
                                <span className="hidden xl:inline">Recept</span>
                            </NavLink>
                        </div>

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
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all font-medium"
                            title={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        <NavLink
                            to="/profile"
                            className={({ isActive }) =>
                                `w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${isActive
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30'
                                }`
                            }
                        >
                            <span>👤</span>
                        </NavLink>

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
            {isMenuOpen && (
                <div className="lg:hidden border-t border-white/5 bg-slate-950 px-4 py-4 space-y-4">
                    <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">Daily Drivers</div>
                        <NavLink to="/" end className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">📅</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Veckan</span>
                                <span className="text-[10px] text-slate-500 font-medium">Översikt</span>
                            </div>
                        </NavLink>
                        <NavLink to="/planera" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">✨</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Planera</span>
                                <span className="text-[10px] text-slate-500 font-medium">Måltider & Pass</span>
                            </div>
                        </NavLink>
                        <NavLink to="/calories" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">🔥</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Kalorier</span>
                                <span className="text-[10px] text-slate-500 font-medium">Logga mat</span>
                            </div>
                        </NavLink>
                        <NavLink to="/training" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">🏋️</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Träning</span>
                                <span className="text-[10px] text-slate-500 font-medium">Logga pass</span>
                            </div>
                        </NavLink>
                        <NavLink to="/health" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="text-xl">📊</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100">Hälsa</span>
                                <span className="text-[10px] text-slate-500 font-medium">Trender & Insikter</span>
                            </div>
                        </NavLink>
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
                    <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-3">System & Verktyg</div>
                        <NavLink to="/admin?tab=audit" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">⚙️</span>
                            <span>Dashboard</span>
                        </NavLink>
                        <NavLink to="/admin?tab=database" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">📦</span>
                            <span>Databas</span>
                        </NavLink>
                        <NavLink to="/admin?tab=api" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">⚡</span>
                            <span>API</span>
                        </NavLink>
                        <NavLink to="/admin?tab=docs" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">📚</span>
                            <span>Regler</span>
                        </NavLink>
                        <NavLink to="/admin?tab=users" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">👥</span>
                            <span>Användare</span>
                        </NavLink>
                        <NavLink to="/admin?tab=roadmap" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                            <span className="w-5 text-center">🚀</span>
                            <span>Roadmap</span>
                        </NavLink>
                    </div>
                </div>
            )}
        </nav>
    );
}
