import React from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
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

    return (
        <div className="profile-page">
            <header className="page-header">
                <div>
                    <h1>Min Profil</h1>
                    <p className="page-subtitle">Anpassa dina inställningar</p>
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
