import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.tsx';
import { Logo } from './Logo.tsx';

export function Navigation() {
    const { theme, toggleTheme } = useSettings();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const linkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
        }`;

    return (
        <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand */}
                    <div className="flex-shrink-0">
                        <NavLink to="/" className="flex items-center gap-2 group">
                            <Logo size="sm" showText={true} />
                        </NavLink>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-2">
                        <NavLink to="/" end className={linkClasses}>
                            <span>📅</span>
                            <span>Veckan</span>
                        </NavLink>
                        <NavLink to="/planera" className={linkClasses}>
                            <span>✨</span>
                            <span>Planera</span>
                        </NavLink>
                        <NavLink to="/database" className={linkClasses}>
                            <span>📦</span>
                            <span>Databas</span>
                        </NavLink>
                        <NavLink to="/pantry" className={linkClasses}>
                            <span>🏠</span>
                            <span>Skafferi</span>
                        </NavLink>
                        <NavLink to="/recipes" className={linkClasses}>
                            <span>📖</span>
                            <span>Recept</span>
                        </NavLink>
                        <NavLink to="/calories" className={linkClasses}>
                            <span>🔥</span>
                            <span>Kalorier</span>
                        </NavLink>
                        <NavLink to="/documentation" className={linkClasses}>
                            <span>📚</span>
                            <span>Regler</span>
                        </NavLink>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
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
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            ☰
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-white/5 bg-slate-950 px-4 py-4 space-y-2">
                    <NavLink to="/" end className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>📅</span>
                        <span>Veckan</span>
                    </NavLink>
                    <NavLink to="/planera" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>✨</span>
                        <span>Planera</span>
                    </NavLink>
                    <NavLink to="/database" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>📦</span>
                        <span>Databas</span>
                    </NavLink>
                    <NavLink to="/pantry" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>🏠</span>
                        <span>Skafferi</span>
                    </NavLink>
                    <NavLink to="/recipes" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>📖</span>
                        <span>Recept</span>
                    </NavLink>
                    <NavLink to="/calories" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>🔥</span>
                        <span>Kalorier</span>
                    </NavLink>
                    <NavLink to="/documentation" className={linkClasses} onClick={() => setIsMenuOpen(false)}>
                        <span>📚</span>
                        <span>Regler</span>
                    </NavLink>
                </div>
            )}
        </nav>
    );
}
