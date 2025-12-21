import React from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function ProfilePage() {
    const {
        settings,
        theme,
        toggleTheme,
        toggleMealVisibility,
        updateSettings
    } = useSettings();
    const { currentUser } = useData();

    return (
        <div className="profile-page">
            <header className="mb-12">
                <div className="flex items-center gap-6 p-8 bg-slate-900/50 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-emerald-500/20">
                        👤
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-white">{currentUser?.name || 'Gäst'}</h1>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold ${currentUser?.plan === 'evergreen' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-gray-400'
                                }`}>
                                {currentUser?.plan === 'evergreen' ? '🌲 Evergreen' : 'Gratis'}
                            </span>
                        </div>
                        <p className="text-gray-400 font-medium opacity-60 tracking-wide uppercase text-xs">{currentUser?.email || 'Ingen e-post'}</p>
                        <p className="text-emerald-400/50 text-[10px] font-bold uppercase tracking-tighter">Medlem sedan {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'idag'}</p>
                    </div>
                </div>
            </header>

            {/* Theme Section */}
            <section className="settings-section">
                <h2>Utseende</h2>
                <div className="setting-card">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Tema</span>
                            <span className="setting-description">Välj mellan ljust och mörkt läge</span>
                        </div>
                        <div className="theme-toggle">
                            <button
                                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => theme !== 'light' && toggleTheme()}
                            >
                                ☀️ Ljust
                            </button>
                            <button
                                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => theme !== 'dark' && toggleTheme()}
                            >
                                🌙 Mörkt
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Meal Visibility Section */}
            <section className="settings-section">
                <h2>Veckovy</h2>
                <div className="setting-card">
                    <div className="setting-info" style={{ marginBottom: '1rem' }}>
                        <span className="setting-label">Synliga måltider</span>
                        <span className="setting-description">Välj vilka måltider som ska visas i veckovy</span>
                    </div>
                    <div className="meal-checkboxes">
                        {ALL_MEALS.map(meal => (
                            <label key={meal} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.visibleMeals.includes(meal)}
                                    onChange={() => toggleMealVisibility(meal)}
                                />
                                <span className="checkbox-custom"></span>
                                <span>{MEAL_TYPE_LABELS[meal]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </section>

            {/* Daily Goals Section */}
            <section className="settings-section">
                <h2>Dagliga Mål</h2>
                <div className="setting-card">
                    <div className="goals-grid">
                        <div className="goal-input-group">
                            <label htmlFor="calorieGoal">Kalorier (kcal)</label>
                            <input
                                type="number"
                                id="calorieGoal"
                                value={settings.dailyCalorieGoal}
                                onChange={(e) => updateSettings({ dailyCalorieGoal: Number(e.target.value) })}
                                min="0"
                            />
                        </div>
                        <div className="goal-input-group">
                            <label htmlFor="proteinGoal">Protein (g)</label>
                            <input
                                type="number"
                                id="proteinGoal"
                                value={settings.dailyProteinGoal}
                                onChange={(e) => updateSettings({ dailyProteinGoal: Number(e.target.value) })}
                                min="0"
                            />
                        </div>
                        <div className="goal-input-group">
                            <label htmlFor="carbsGoal">Kolhydrater (g)</label>
                            <input
                                type="number"
                                id="carbsGoal"
                                value={settings.dailyCarbsGoal}
                                onChange={(e) => updateSettings({ dailyCarbsGoal: Number(e.target.value) })}
                                min="0"
                            />
                        </div>
                        <div className="goal-input-group">
                            <label htmlFor="fatGoal">Fett (g)</label>
                            <input
                                type="number"
                                id="fatGoal"
                                value={settings.dailyFatGoal}
                                onChange={(e) => updateSettings({ dailyFatGoal: Number(e.target.value) })}
                                min="0"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Physical Profile Section */}
            <section className="settings-section">
                <h2>Fysisk Profil</h2>
                <div className="setting-card">
                    <div className="goals-grid">
                        <div className="goal-input-group">
                            <label>Kön</label>
                            <select
                                value={settings.gender || 'other'}
                                onChange={(e) => updateSettings({ gender: e.target.value as any })}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none"
                            >
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="other">Annat / Snitt</option>
                            </select>
                        </div>
                        <div className="goal-input-group">
                            <label>Ålder</label>
                            <input
                                type="number"
                                value={settings.age || ''}
                                onChange={(e) => updateSettings({ age: Number(e.target.value) })}
                                placeholder="30"
                            />
                        </div>
                        <div className="goal-input-group">
                            <label>Längd (cm)</label>
                            <input
                                type="number"
                                value={settings.height || ''}
                                onChange={(e) => updateSettings({ height: Number(e.target.value) })}
                                placeholder="175"
                            />
                        </div>
                        <div className="goal-input-group">
                            <label>Träningsmål</label>
                            <select
                                value={settings.trainingGoal || 'neutral'}
                                onChange={(e) => updateSettings({ trainingGoal: e.target.value as any })}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none"
                            >
                                <option value="neutral">Neutral (Balans)</option>
                                <option value="deff">Deff (-500 kcal)</option>
                                <option value="bulk">Bulk (+500 kcal)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* Data Section */}
            <section className="settings-section">
                <h2>Data</h2>
                <div className="setting-card">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Rensa all data</span>
                            <span className="setting-description">Ta bort all sparad data (kan inte ångras)</span>
                        </div>
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                if (confirm('Är du säker? All data raderas permanent.')) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }}
                        >
                            Rensa data
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
