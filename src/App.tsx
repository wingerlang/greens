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
import { PlanningPage } from './pages/PlanningPage.tsx';
import { DocumentationPage } from './components/DocumentationPage.tsx';

export function App() {
    return (
        <SettingsProvider>
            <DataProvider>
                <CookingModeProvider>
                    <BrowserRouter>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<WeeklyPage />} />
                                <Route path="/weekly" element={<WeeklyPage />} />
                                <Route path="/vecka" element={<WeeklyPage />} />
                                <Route path="/vecka/recept/:recipeId/*" element={<WeeklyPage />} />
                                <Route path="/planera" element={<PlanningPage />} />
                                <Route path="/database" element={<DatabasePage />} />
                                <Route path="/pantry" element={<PantryPage />} />
                                <Route path="/recipes" element={<RecipesPage />} />
                                <Route path="/calories" element={<CaloriesPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/documentation" element={<DocumentationPage />} />
                            </Routes>
                        </Layout>
                    </BrowserRouter>
                </CookingModeProvider>
            </DataProvider>
        </SettingsProvider>
    );
}
