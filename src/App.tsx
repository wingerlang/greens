import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { CookingModeProvider } from './context/CookingModeProvider.tsx';
import { Layout } from './components/Layout.tsx';
import { WeeklyPage } from './pages/WeeklyPage.tsx';
import { DatabasePage } from './pages/DatabasePage.tsx';
import { PantryPage } from './pages/PantryPage.tsx';
import { RecipesPage } from './pages/RecipesPage.tsx';
import { CaloriesPage } from './pages/CaloriesPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { TrainingPage } from './pages/TrainingPage.tsx';
import { PlanningPage } from './pages/PlanningPage.tsx';
import { ApiPage } from './pages/ApiPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { DocumentationPage } from './components/DocumentationPage.tsx';
import { HealthPage } from './pages/HealthPage.tsx';

export function App() {
    return (
        <DataProvider>
            <SettingsProvider>
                <CookingModeProvider>
                    <BrowserRouter>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<WeeklyPage />} />
                                <Route path="/weekly" element={<WeeklyPage />} />
                                <Route path="/vecka" element={<WeeklyPage />} />
                                <Route path="/vecka/recept/:recipeId/*" element={<WeeklyPage />} />
                                <Route path="/planera" element={<PlanningPage />} />
                                <Route path="/pantry" element={<PantryPage />} />
                                <Route path="/recipes" element={<RecipesPage />} />
                                <Route path="/calories" element={<CaloriesPage />} />
                                <Route path="/training" element={<TrainingPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/health" element={<HealthPage />} />
                                <Route path="/halsa" element={<HealthPage />} />
                                <Route path="/admin" element={<AdminPage />} />
                            </Routes>
                        </Layout>
                    </BrowserRouter>
                </CookingModeProvider>
            </SettingsProvider>
        </DataProvider>
    );
}
