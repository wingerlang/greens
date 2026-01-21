import React, { useState, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import './Navigation.css';
import { Logo } from './Logo.tsx';
import { Star, MoreHorizontal, Edit2, X, ChevronDown, ChevronRight, Pin } from 'lucide-react';

interface NavigationProps {
    onOpenOmnibox?: () => void;
}

type NavSection = 'health' | 'food' | 'training' | 'community' | 'tools' | 'admin';

interface NavItem {
    path: string;
    label: string;
    icon: string;
    section: NavSection;
    description?: string;
    adminOnly?: boolean;
    devOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    // Health
    { path: '/health', label: 'Översikt', icon: '📊', section: 'health', description: 'Trender & Insikter' },
    { path: '/health/body', label: 'Kropp', icon: '🧬', section: 'health', description: 'Mått & Vikt' },
    { path: '/health/recovery', label: 'Recovery', icon: '🩹', section: 'health', description: 'Återhämtning' },

    // Food
    { path: '/veckan', label: 'Veckan', icon: '📅', section: 'food', description: 'Veckoöversikt' },
    { path: '/planera', label: 'Planera', icon: '✨', section: 'food', description: 'Måltider & Pass' },
    { path: '/pantry', label: 'Skafferi', icon: '🏠', section: 'food', description: 'Hantera ingredienser' },
    { path: '/recipes', label: 'Recept', icon: '📖', section: 'food', description: 'Hitta & skapa' },
    { path: '/database', label: 'Databas', icon: '🗄️', section: 'food', description: 'Matdatabas' },
    { path: '/calories', label: 'Kalorier', icon: '🔥', section: 'food', description: 'Logga mat' },

    // Training
    { path: '/training', label: 'Översikt', icon: '📈', section: 'training', description: 'Träningsöversikt' },
    { path: '/planera/traning', label: 'Planera', icon: '🗓️', section: 'training', description: 'Planera pass' },
    { path: '/pass', label: 'Passbank', icon: '📚', section: 'training', description: 'Sparade pass' },
    { path: '/logg', label: 'Logg', icon: '📜', section: 'training', description: 'Aktivitetslogg' },
    { path: '/styrka', label: 'Styrka', icon: '💪', section: 'training', description: 'Styrketräning' },
    { path: '/training/load', label: 'Belastning', icon: '🏋️', section: 'training', description: 'Training Load' },
    { path: '/exercises', label: 'Övningar', icon: '📚', section: 'training', description: 'Övningsbibliotek' },
    { path: '/coach', label: 'Coach', icon: '🧠', section: 'training', description: 'Smart Coach' },
    { path: '/review', label: 'Årsöversikt', icon: '📅', section: 'training', description: 'Summering' },
    { path: '/goals', label: 'Mål', icon: '🎯', section: 'training', description: 'Sätt & nå mål' },

    // Community
    { path: '/feed', label: 'Feed', icon: '📡', section: 'community', description: 'Life Stream' },
    { path: '/matchup', label: 'Matchup', icon: '🥊', section: 'community', description: 'Jämför stats' },
    { path: '/tävling', label: 'Tävling', icon: '🏆', section: 'community', description: 'Utmana vänner' },
    { path: '/statistik', label: 'Statistik', icon: '📊', section: 'community', description: 'Global stats' },
    { path: '/community', label: 'Hitta', icon: '👥', section: 'community', description: 'Sök användare' },

    // Tools
    { path: '/beast', label: 'The Beast', icon: '🦍', section: 'tools', description: 'Totalprofil' },
    { path: '/tools', label: 'Översikt', icon: '🧰', section: 'tools', description: 'Alla verktyg' },
    { path: '/tools/1rm', label: '1RM & Last', icon: '💪', section: 'tools' },
    { path: '/tools/race', label: 'Race', icon: '🏃', section: 'tools' },
    { path: '/tools/pace', label: 'Pace', icon: '⏱️', section: 'tools' },
    { path: '/tools/cycling', label: 'Cykling & Assault', icon: '🚴', section: 'tools' },
    { path: '/tools/health', label: 'Hälsa', icon: '🩺', section: 'tools' },

    // Admin (Simplified)
    { path: '/admin?tab=health', label: 'Dashboard', icon: '⚙️', section: 'admin', adminOnly: true },
    { path: '/admin?tab=database', label: 'MatDB', icon: '📦', section: 'admin', adminOnly: true },
    { path: '/admin/exercises', label: 'ÖvningDB', icon: '💪', section: 'admin', adminOnly: true },
    { path: '/admin?tab=users', label: 'Användare', icon: '👥', section: 'admin', adminOnly: true },
    { path: '/developer', label: 'Dev Tools', icon: '🛠️', section: 'admin', devOnly: true },
];

export const Navigation: React.FC<NavigationProps> = ({ onOpenOmnibox }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { cycleProgress, currentGoal, dailyCaloriesConsumed, targetCalories, activeCycle } = useHealth();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Filter items based on role and permissions
    const visibleItems = useMemo(() => {
        return NAV_ITEMS.filter(item => {
            if (item.adminOnly && user?.role !== 'admin' && user?.role !== 'developer') return false;
            if (item.devOnly && user?.role !== 'developer') return false;
            return true;
        });
    }, [user?.role]);

    // Split into pinned and unpinned
    const { pinnedItems, sections } = useMemo(() => {
        const pinnedPaths = new Set(settings.pinnedPaths || []);

        const pinned = visibleItems.filter(item => pinnedPaths.has(item.path));

        // Group remaining items by section
        const grouped = visibleItems.reduce((acc, item) => {
            // Don't show in sections if pinned (unless in edit mode where we might want to see duplicates or indication)
            // Actually, for the mobile "More" menu, reasonable to show unpinned ones. 
            // Let's show ALL in sections, but standard mobile view puts pins at top.
            if (!acc[item.section]) acc[item.section] = [];
            acc[item.section].push(item);
            return acc;
        }, {} as Record<NavSection, NavItem[]>);

        return { pinnedItems: pinned, sections: grouped };
    }, [visibleItems, settings.pinnedPaths]);

    const togglePin = (path: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const currentPins = settings.pinnedPaths || [];
        const isPinned = currentPins.includes(path);

        let newPins: string[];
        if (isPinned) {
            newPins = currentPins.filter(p => p !== path);
        } else {
            newPins = [...currentPins, path];
        }

        updateSettings({ ...settings, pinnedPaths: newPins });
    };

    // Helper: Check if a nav item path matches current location (including query params)
    const isPathActive = (itemPath: string): boolean => {
        const currentPath = location.pathname;
        const currentSearch = location.search;

        // Parse the item path for query params
        const [itemPathname, itemSearch] = itemPath.split('?');

        // For paths with query params (like /admin?tab=health)
        if (itemSearch) {
            // Must match both pathname and query params
            return currentPath === itemPathname && currentSearch === `?${itemSearch}`;
        }

        // Special handling for "Overview" style links that are base paths
        // We want exact match for these to avoid highlighting them when on a sub-route
        const exactMatchPaths = ['/tools', '/health', '/training', '/admin'];
        if (exactMatchPaths.includes(itemPathname)) {
            return currentPath === itemPathname && !currentSearch;
        }

        // For paths with potential sub-routes (like /health/body), use startsWith
        // but ensure we don't match the root by accident if we handled it above
        return currentPath.startsWith(itemPathname);
    };

    // Helper classes
    const linkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
        }`;

    // Custom link classes using path comparison (for admin items with query params)
    const getLinkClasses = (itemPath: string) => {
        const active = isPathActive(itemPath);
        return `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${active
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`;
    };

    // Parent button style for dropdowns (Desktop)
    const getGroupClasses = (section: NavSection) => {
        const isInSection = visibleItems
            .filter(i => i.section === section)
            .some(i => {
                // Precise match for /planera (Food) vs /planera/traning (Training)
                if (i.path === '/planera' && location.pathname === '/planera/traning') return false;

                // Keep 'Planera' (Food) active only for its specific sub-paths or exact match, not conflicts
                if (i.path === '/planera' && location.pathname.startsWith('/planera/traning')) return false;

                return location.pathname.startsWith(i.path);
            });

        return `flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isInSection
            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`;
    };

    const mobileLinkClasses = ({ isActive }: { isActive: boolean }) =>
        `relative flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-200 ${isActive
            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-500/10'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        }`;

    // Custom mobile link classes using path comparison (for admin items with query params)
    const getMobileLinkClasses = (itemPath: string) => {
        const active = isPathActive(itemPath);
        return `relative flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-200 ${active
            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-500/10'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`;
    };

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

                    {/* Desktop Navigation (Traditional Dropdowns) */}
                    <div className="hidden lg:flex items-center gap-1">
                        {/* Status Widgets */}
                        {(activeCycle && cycleProgress) && (
                            <div className="mr-4 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-medium">
                                <span className={{
                                    'deff': 'text-rose-400',
                                    'bulk': 'text-emerald-400',
                                    'neutral': 'text-blue-400'
                                }[currentGoal]}>●</span>
                                <span className="text-slate-300">{activeCycle.name}</span>
                                <span className="text-slate-500 border-l border-white/10 pl-2 ml-1">{cycleProgress.daysLeft} dagar kvar</span>
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

                        {/* Sections */}
                        {(['health', 'food', 'training', 'community', 'tools', 'admin'] as NavSection[]).map(section => {
                            const sectionItems = sections[section];
                            if (!sectionItems?.length) return null;

                            return (
                                <div key={section} className="relative group">
                                    <button className={getGroupClasses(section)}>
                                        <span className="capitalize">{sectionItems[0].icon}</span>
                                        <span className="hidden xl:inline capitalize">{section === 'food' ? 'Mat' : section === 'health' ? 'Hälsa' : section === 'training' ? 'Träning' : section === 'tools' ? 'Verktyg' : section}</span>
                                        <ChevronDown size={10} className="opacity-50 ml-1 group-hover:rotate-180 transition-transform" />
                                    </button>
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                        <div className="grid gap-1">
                                            {sectionItems.map(item => (
                                                <NavLink
                                                    key={item.path}
                                                    to={item.path}
                                                    className={getLinkClasses(item.path)}
                                                >
                                                    <span className="w-5 text-center">{item.icon}</span>
                                                    <span>{item.label}</span>
                                                </NavLink>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* User Profile */}
                        <div className="h-6 w-px bg-white/10 mx-2" />
                        <div className="relative group">
                            <Link to="/profile" className={`${linkClasses({ isActive: location.pathname === '/profile' })} flex items-center gap-2 !px-3 !py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-white/5`}>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">
                                    {user?.username?.substring(0, 1).toUpperCase() || 'U'}
                                </div>
                                <span className="hidden xl:inline text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                                    {user?.username || 'Gäst'}
                                </span>
                            </Link>

                            <div className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left">
                                    <span className="w-5 text-center">⚙️</span>
                                    <span>Inställningar</span>
                                </NavLink>
                                <NavLink to="/sync" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left">
                                    <span className="w-5 text-center">🔄</span>
                                    <span>Synkningar</span>
                                </NavLink>
                                <div className="h-px bg-white/5 my-1" />
                                <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 font-bold text-xs hover:text-rose-400 hover:bg-rose-500/10 transition-all w-full text-left">
                                    <span className="w-5 text-center">🚪</span>
                                    <span>Logga ut</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile/Tablet Actions */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button onClick={onOpenOmnibox} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                            🔍
                        </button>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                            {isMenuOpen ? <X size={20} /> : '☰'}
                        </button>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        <button onClick={onOpenOmnibox} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
                            🔍
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="lg:hidden absolute top-16 left-0 right-0 bottom-[-100vh] h-[calc(100vh-64px)] bg-slate-950/95 backdrop-blur-3xl overflow-y-auto pb-safe">
                    <div className="p-4 space-y-6">

                        {/* Edit Mode Toggle */}
                        <div className="flex items-center justify-between pb-4 border-b border-white/5">
                            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Meny</span>
                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isEditMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}
                            >
                                <Edit2 size={12} />
                                {isEditMode ? 'Klar' : 'Anpassa'}
                            </button>
                        </div>

                        {/* PINNED ITEMS (Always Top) */}
                        {pinnedItems.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-[10px] text-amber-500 uppercase tracking-widest font-bold px-3 flex items-center gap-2">
                                    <Star size={10} fill="currentColor" /> Favoriter
                                </div>
                                {pinnedItems.map(item => (
                                    <div key={item.path} className="relative group">
                                        <NavLink
                                            to={item.path}
                                            className={getMobileLinkClasses(item.path)}
                                            onClick={() => !isEditMode && setIsMenuOpen(false)}
                                        >
                                            <span className="text-xl">{item.icon}</span>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-100">{item.label}</span>
                                                {item.description && <span className="text-[10px] text-slate-500 font-medium">{item.description}</span>}
                                            </div>
                                        </NavLink>

                                        {/* Unpin Button */}
                                        {isEditMode && (
                                            <button
                                                onClick={(e) => togglePin(item.path, e)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-full text-amber-500 z-10"
                                            >
                                                <Star size={14} fill="currentColor" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ALL SECTIONS */}
                        {(['food', 'health', 'training', 'community', 'tools', 'admin'] as NavSection[]).map(section => {
                            // In normal mode, we might want to hide pinned items from their sections to avoid dupes?
                            // Or keep them for structure. Let's keep them but maybe dim them if we wanted.
                            // For now, simple list.

                            const items = sections[section];
                            if (!items?.length) return null;

                            return (
                                <div key={section} className="space-y-2">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-3 pt-2">
                                        {section === 'food' ? 'Mat & Recept' :
                                            section === 'health' ? 'Hälsa & Kropp' :
                                                section === 'training' ? 'Träning & Pass' :
                                                    section === 'community' ? 'Community' :
                                                        section === 'tools' ? 'Verktyg' : 'Admin'}
                                    </div>

                                    {items.map(item => {
                                        const isPinned = (settings.pinnedPaths || []).includes(item.path);
                                        // If pinned, maybe hide from here to reduce clutter? 
                                        // User asked to "reduce links that might not be relevant".
                                        // Let's HIDE pinned items from the general list IF they are pinned
                                        if (isPinned) return null;

                                        return (
                                            <div key={item.path} className="relative">
                                                <NavLink
                                                    to={item.path}
                                                    className={getMobileLinkClasses(item.path)}
                                                    onClick={() => !isEditMode && setIsMenuOpen(false)}
                                                >
                                                    <span className="text-xl opacity-70 group-hover:opacity-100">{item.icon}</span>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-200">{item.label}</span>
                                                        <span className="text-[10px] text-slate-600 font-medium">{item.description}</span>
                                                    </div>
                                                </NavLink>

                                                {/* Pin Button */}
                                                {isEditMode && (
                                                    <button
                                                        onClick={(e) => togglePin(item.path, e)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-full text-slate-600 hover:text-amber-500 hover:border-amber-500/50 transition-colors z-10"
                                                    >
                                                        <Star size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Account Bottom Section */}
                        <div className="pt-6 border-t border-white/5 space-y-2">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-3">Konto</div>
                            <NavLink to="/profile" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">
                                    {user?.username?.substring(0, 1).toUpperCase() || 'U'}
                                </div>
                                <span className="font-bold text-slate-200">Min Profil</span>
                            </NavLink>
                            <button onClick={logout} className="flex items-center gap-4 px-3 py-3 rounded-2xl w-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                                <span className="text-xl">🚪</span>
                                <span className="font-bold">Logga ut</span>
                            </button>
                        </div>

                        <div className="h-20" /> {/* Spacer for bottom scroll */}
                    </div>
                </div>
            )}
        </nav>
    );
};
