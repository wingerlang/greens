import React, { useState, useMemo, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { useMessages } from '../context/MessageContext.tsx';
import './Navigation.css';
import { Logo } from './Logo.tsx';
import { 
    Star, MoreHorizontal, Edit2, X, ChevronDown, ChevronRight, Pin,
    Activity, LayoutDashboard, HeartPulse, Scale, BarChart3,
    Flame, CalendarRange, Sparkles, Home, BookOpen, Database,
    TrendingUp, CalendarDays, Library, ClipboardList, Dumbbell,
    Brain, Target, Rss, Swords, Trophy, PieChart, Search,
    Zap, Briefcase, Timer, Gauge, ShieldAlert, Settings, User, Users,
    MessageSquare, RefreshCw, LogOut, Menu, Wrench, Box, Package,
    ChevronLeft, Bike, Stethoscope
} from 'lucide-react';

interface NavigationProps {
    onOpenOmnibox?: () => void;
    onStravaSync?: () => void;
}

type NavSection = 'health' | 'food' | 'training' | 'community' | 'tools' | 'admin';

interface NavItem {
    path: string;
    label: string;
    icon: React.ElementType;
    section: NavSection;
    description?: string;
    adminOnly?: boolean;
    devOnly?: boolean;
    color?: string;
}

const NAV_ITEMS: NavItem[] = [
    // Health
    { path: '/health', label: 'Översikt', icon: LayoutDashboard, section: 'health', description: 'Trender & Insikter', color: 'text-emerald-500' },
    { path: '/health/body', label: 'Kropp', icon: Scale, section: 'health', description: 'Mått & Vikt', color: 'text-blue-500' },
    { path: '/health/recovery', label: 'Recovery', icon: HeartPulse, section: 'health', description: 'Återhämtning', color: 'text-rose-500' },
    { path: '/health/load', label: 'Belastning', icon: BarChart3, section: 'health', description: 'Training Load', color: 'text-amber-500' },

    // Food
    { path: '/calories', label: 'Kalorier', icon: Flame, section: 'food', description: 'Logga mat', color: 'text-orange-500' },
    { path: '/veckan', label: 'Veckan', icon: CalendarRange, section: 'food', description: 'Veckoöversikt', color: 'text-emerald-500' },
    { path: '/planera', label: 'Planera', icon: Sparkles, section: 'food', description: 'Måltider & Pass', color: 'text-indigo-500' },
    { path: '/pantry', label: 'Skafferi', icon: Home, section: 'food', description: 'Hantera ingredienser', color: 'text-amber-600' },
    { path: '/recipes', label: 'Recept', icon: BookOpen, section: 'food', description: 'Hitta & skapa', color: 'text-blue-500' },
    { path: '/database', label: 'Databas', icon: Database, section: 'food', description: 'Matdatabas', color: 'text-slate-400' },

    // Training
    { path: '/training', label: 'Översikt', icon: TrendingUp, section: 'training', description: 'Träningsöversikt', color: 'text-emerald-500' },
    { path: '/planera/traning', label: 'Planera', icon: CalendarDays, section: 'training', description: 'Planera pass', color: 'text-indigo-500' },
    { path: '/pass', label: 'Passbank', icon: Library, section: 'training', description: 'Sparade pass', color: 'text-amber-500' },
    { path: '/logg', label: 'Aktiviteter', icon: ClipboardList, section: 'training', description: 'Aktivitetslogg', color: 'text-slate-400' },
    { path: '/styrka', label: 'Styrka', icon: Dumbbell, section: 'training', description: 'Styrketräning', color: 'text-purple-500' },
    { path: '/exercises', label: 'Övningar', icon: Activity, section: 'training', description: 'Övningsbibliotek', color: 'text-cyan-500' },
    { path: '/coach', label: 'Coach', icon: Brain, section: 'training', description: 'Smart Coach', color: 'text-indigo-400' },
    { path: '/goals', label: 'Mål', icon: Target, section: 'training', description: 'Sätt & nå mål', color: 'text-rose-500' },

    // Community
    { path: '/feed', label: 'Feed', icon: Rss, section: 'community', description: 'Life Stream', color: 'text-orange-500' },
    { path: '/matchup', label: 'Matchup', icon: Swords, section: 'community', description: 'Jämför stats', color: 'text-rose-500' },
    { path: '/tävling', label: 'Tävling', icon: Trophy, section: 'community', description: 'Utmana vänner', color: 'text-amber-400' },
    { path: '/statistik', label: 'Statistik', icon: PieChart, section: 'community', description: 'Global stats', color: 'text-blue-500' },
    { path: '/community', label: 'Hitta', icon: Search, section: 'community', description: 'Sök användare', color: 'text-slate-400' },

    // Tools
    { path: '/beast', label: 'The Beast', icon: Zap, section: 'tools', description: 'Totalprofil', color: 'text-amber-500' },
    { path: '/tools', label: 'Översikt', icon: Briefcase, section: 'tools', description: 'Alla verktyg', color: 'text-slate-400' },
    { path: '/tools/1rm', label: '1RM & Last', icon: Dumbbell, section: 'tools' },
    { path: '/tools/running', label: 'Löpning', icon: Timer, section: 'tools' },
    { path: '/tools/cycling', label: 'Cykling & Assault', icon: Bike, section: 'tools' },
    { path: '/tools/health', label: 'Hälsa', icon: Stethoscope, section: 'tools' },

    // Admin (Simplified)
    { path: '/admin?tab=health', label: 'Dashboard', icon: Settings, section: 'admin', adminOnly: true },
    { path: '/admin?tab=database', label: 'MatDB', icon: Box, section: 'admin', adminOnly: true },
    { path: '/admin/exercises', label: 'ÖvningDB', icon: Dumbbell, section: 'admin', adminOnly: true },
    { path: '/admin?tab=users', label: 'Användare', icon: Users, section: 'admin', adminOnly: true },
    { path: '/developer', label: 'Dev Tools', icon: Wrench, section: 'admin', devOnly: true },
];

export const Navigation: React.FC<NavigationProps> = ({ onOpenOmnibox, onStravaSync }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { cycleProgress, currentGoal, dailyCaloriesConsumed, targetCalories, activeCycle } = useHealth();
    const { unreadCount } = useMessages();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            if (scrollY > 60 && !isScrolled) {
                setIsScrolled(true);
            } else if (scrollY < 20 && isScrolled) {
                setIsScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isScrolled]);

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
        <nav className={`sticky top-0 z-[100] w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300 ease-in-out flex items-center ${isScrolled ? 'h-11 shadow-2xl' : 'h-16'}`}>
            <div className={`max-w-7xl mx-auto px-4 md:px-4 w-full transition-all duration-300 ease-in-out origin-top ${isScrolled ? 'scale-[0.90]' : 'scale-100'}`}>
                <div className="flex items-center justify-between h-8">

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

                        {/* Sections */}
                        {(['health', 'food', 'training', 'community', 'tools', 'admin'] as NavSection[]).map(section => {
                            const sectionItems = sections[section];
                            if (!sectionItems?.length) return null;

                            return (
                                <div key={section} className="relative group">
                                    <button className={getGroupClasses(section)}>
                                        <div className="flex items-center justify-center w-5">
                                            {React.createElement(sectionItems[0].icon, { size: 16 })}
                                        </div>
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
                                                    <span className="w-5 flex justify-center"><item.icon size={14} /></span>
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
                                <div className="relative">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">
                                        {user?.username?.substring(0, 1).toUpperCase() || 'U'}
                                    </div>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-800"></span>
                                    )}
                                </div>
                                <span className="hidden xl:inline text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                                    {user?.username || 'Gäst'}
                                </span>
                            </Link>

                            <div className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-[100] p-1.5 backdrop-blur-xl">
                                <NavLink to="/meddelanden" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left">
                                    <div className="relative w-5 text-center">
                                        <MessageSquare size={14} />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-0 w-2 h-2 bg-rose-500 rounded-full"></span>
                                        )}
                                    </div>
                                    <span>Meddelanden</span>
                                </NavLink>
                                <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left">
                                    <span className="w-5 text-center"><Settings size={14} /></span>
                                    <span>Inställningar</span>
                                </NavLink>
                                <NavLink to="/sync" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all w-full text-left">
                                    <span className="w-5 text-center"><RefreshCw size={14} /></span>
                                    <span>Synkningar</span>
                                </NavLink>
                                {onStravaSync && (
                                    <button onClick={onStravaSync} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-[#FC4C02] hover:bg-[#FC4C02]/10 transition-all w-full text-left">
                                        <span className="w-5 text-center"><Zap size={14} /></span>
                                        <span>Strava Sync</span>
                                    </button>
                                )}
                                <div className="h-px bg-white/5 my-1" />
                                <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 font-bold text-xs hover:text-rose-400 hover:bg-rose-500/10 transition-all w-full text-left">
                                    <span className="w-5 text-center"><LogOut size={14} /></span>
                                    <span>Logga ut</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile/Tablet Actions */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button onClick={onOpenOmnibox} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                            <Search size={20} />
                        </button>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        <button onClick={onOpenOmnibox} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
                            <Search size={20} />
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
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color || 'bg-slate-800 text-slate-400'} bg-opacity-10 border border-current border-opacity-10`}>
                                                <item.icon size={20} />
                                            </div>
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
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color || 'bg-slate-800 text-slate-400'} bg-opacity-10`}>
                                                        <item.icon size={16} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-200">{item.label}</span>
                                                        {item.description && <span className="text-[9px] text-slate-500 font-medium">{item.description}</span>}
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
                            <NavLink to="/meddelanden" className={mobileLinkClasses} onClick={() => setIsMenuOpen(false)}>
                                <div className="relative w-6 h-6 flex items-center justify-center text-slate-400">
                                    <MessageSquare size={18} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-900"></span>
                                    )}
                                </div>
                                <span className="font-bold text-slate-200">Meddelanden</span>
                            </NavLink>
                            <button onClick={logout} className="flex items-center gap-4 px-3 py-3 rounded-2xl w-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-left">
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <LogOut size={18} />
                                </div>
                                <span className="font-bold">Logga ut</span>
                            </button>
                            {onStravaSync && (
                                <button onClick={() => { onStravaSync(); setIsMenuOpen(false); }} className="flex items-center gap-4 px-3 py-3 rounded-2xl w-full text-[#FC4C02] hover:bg-[#FC4C02]/10 transition-colors text-left">
                                    <div className="w-6 h-6 flex items-center justify-center">
                                        <Zap size={18} />
                                    </div>
                                    <span className="font-bold">Strava Smart Sync</span>
                                </button>
                            )}
                        </div>

                        <div className="h-20" /> {/* Spacer for bottom scroll */}
                    </div>
                </div>
            )}
        </nav>
    );
};
