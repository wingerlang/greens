import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.tsx';
import { Logo } from './Logo.tsx';
import './Navigation.css';

export function Navigation() {
    const { theme, toggleTheme } = useSettings();

    return (
        <nav className="navigation">
            <div className="nav-brand">
                <NavLink to="/" className="brand-link">
                    <Logo size="sm" showText={true} />
                </NavLink>
            </div>
            <ul className="nav-links">
                <li>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        <span className="nav-icon">📅</span>
                        <span>Veckan</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/planera"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        <span className="nav-icon">✨</span>
                        <span>Planera</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/database"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        <span className="nav-icon">📦</span>
                        <span>Databas</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/recipes"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        <span className="nav-icon">📖</span>
                        <span>Recept</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/calories"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        <span className="nav-icon">🔥</span>
                        <span>Kalorier</span>
                    </NavLink>
                </li>
            </ul>
            <div className="nav-actions">
                <button
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <NavLink
                    to="/profile"
                    className={({ isActive }) => isActive ? 'nav-link profile-link active' : 'nav-link profile-link'}
                >
                    <span className="nav-icon">👤</span>
                </NavLink>
            </div>
        </nav>
    );
}
