import React from 'react';
import { Link } from 'react-router-dom';

const APP_VERSION = '2.4.0';
const BUILD_DATE = '2026-01-07';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-white/5 bg-slate-950/50">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {/* Main Footer Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                    {/* Brand & Version */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">🥗</span>
                            <span className="font-black text-white">Greens</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                            Din kompletta plattform för hälsa, kost och träning.
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono">v{APP_VERSION}</span>
                            <span>•</span>
                            <span>{BUILD_DATE}</span>
                        </div>
                    </div>

                    {/* Quick Links - Mat */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Mat</h4>
                        <ul className="space-y-2">
                            <li><Link to="/veckan" className="text-xs text-slate-400 hover:text-white transition-colors">Veckan</Link></li>
                            <li><Link to="/recipes" className="text-xs text-slate-400 hover:text-white transition-colors">Recept</Link></li>
                            <li><Link to="/database" className="text-xs text-slate-400 hover:text-white transition-colors">Matdatabas</Link></li>
                            <li><Link to="/calories" className="text-xs text-slate-400 hover:text-white transition-colors">Kalorier</Link></li>
                        </ul>
                    </div>

                    {/* Quick Links - Träning */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Träning</h4>
                        <ul className="space-y-2">
                            <li><Link to="/training" className="text-xs text-slate-400 hover:text-white transition-colors">Översikt</Link></li>
                            <li><Link to="/logg" className="text-xs text-slate-400 hover:text-white transition-colors">Aktivitetslogg</Link></li>
                            <li><Link to="/styrka" className="text-xs text-slate-400 hover:text-white transition-colors">Styrketräning</Link></li>
                            <li><Link to="/coach" className="text-xs text-slate-400 hover:text-white transition-colors">Smart Coach</Link></li>
                        </ul>
                    </div>

                    {/* Quick Links - System */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">System</h4>
                        <ul className="space-y-2">
                            <li><Link to="/admin" className="text-xs text-slate-400 hover:text-white transition-colors">Admin</Link></li>
                            <li><Link to="/regler" className="text-xs text-slate-400 hover:text-white transition-colors">Dokumentation</Link></li>
                            <li><Link to="/roadmap" className="text-xs text-slate-400 hover:text-white transition-colors">Roadmap</Link></li>
                            <li><Link to="/tools" className="text-xs text-slate-400 hover:text-white transition-colors">Verktyg</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] text-slate-600">
                        © {currentYear} Greens. Byggd med ❤️ och 🥦
                    </p>

                    <div className="flex items-center gap-4">
                        <Link to="/profile" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                            Profil
                        </Link>
                        <Link to="/sync" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                            Synkningar
                        </Link>
                        <a
                            href="https://github.com/wingerlang/greens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
