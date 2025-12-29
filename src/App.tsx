import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { CookingModeProvider } from './context/CookingModeProvider.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Layout } from './components/Layout.tsx';
import { WeeklyPage } from './pages/WeeklyPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
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
import { CompetitionPage } from './pages/CompetitionPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { WorkoutsPage } from './pages/WorkoutsPage.tsx';
import { CoachPage } from './pages/CoachPage.tsx';
import { PublicProfilePage } from './pages/PublicProfilePage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { GarminPage } from './pages/GarminPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { IntegrationsPage } from './pages/IntegrationsPage.tsx';
import { ActivitiesPage } from './pages/ActivitiesPage.tsx';
import { StrengthPage } from './pages/StrengthPage.tsx';
import { ExercisesPage } from './pages/ExercisesPage.tsx';
import { WorkoutBuilderPage } from './pages/WorkoutBuilderPage.tsx';
import { WorkoutDetailPage } from './pages/WorkoutDetailPage.tsx';
import { MatchupPage } from './pages/MatchupPage.tsx';

function RequireAuth({ children }: { children: JSX.Element }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-500">Laddar...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-500">Laddar...</div>;
    }

    if (user?.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
}

export function App() {
    return (
        <AuthProvider>
            <DataProvider>
                <SettingsProvider>
                    <CookingModeProvider>
                        <BrowserRouter>
                            <Routes>
                                {/* Public Routes */}
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/register" element={<RegisterPage />} />

                                {/* Protected Routes */}
                                <Route path="/*" element={
                                    <RequireAuth>
                                        <Layout>
                                            <Routes>
                                                <Route index element={<DashboardPage />} />
                                                <Route path="veckan" element={<WeeklyPage />} />
                                                <Route path="weekly" element={<WeeklyPage />} />
                                                <Route path="vecka" element={<WeeklyPage />} />
                                                <Route path="vecka/recept/:recipeId/*" element={<WeeklyPage />} />
                                                <Route path="planera" element={<PlanningPage />} />
                                                <Route path="pantry" element={<PantryPage />} />
                                                <Route path="recipes" element={<RecipesPage />} />
                                                <Route path="database" element={<DatabasePage />} />
                                                <Route path="databas" element={<DatabasePage />} />
                                                <Route path="calories" element={<CaloriesPage />} />
                                                <Route path="training" element={<TrainingPage />} />
                                                <Route path="profile" element={<ProfilePage />} />
                                                <Route path="health" element={<HealthPage />} />
                                                <Route path="health/:metric" element={<HealthPage />} />
                                                <Route path="halsa" element={<HealthPage />} />
                                                <Route path="halsa/:metric" element={<HealthPage />} />
                                                <Route path="hälsa" element={<HealthPage />} />
                                                <Route path="hälsa/:metric" element={<HealthPage />} />
                                                <Route path="coach" element={<CoachPage />} />
                                                <Route path="competition" element={<CompetitionPage />} />
                                                <Route path="competition" element={<CompetitionPage />} />
                                                <Route path="tävling" element={<CompetitionPage />} />
                                                <Route path="admin" element={
                                                    <RequireAdmin>
                                                        <AdminPage />
                                                    </RequireAdmin>
                                                } />
                                                <Route path="api" element={<ApiPage />} />
                                                <Route path="docs" element={<DocumentationPage />} />
                                                <Route path="community" element={<UsersPage />} />
                                                <Route path="u/:handle" element={<PublicProfilePage />} />
                                                <Route path="garmin" element={<GarminPage />} />
                                                <Route path="settings" element={<SettingsPage />} />
                                                <Route path="sync" element={<IntegrationsPage />} />
                                                <Route path="installningar" element={<SettingsPage />} />
                                                <Route path="activities" element={<ActivitiesPage />} />
                                                <Route path="logg" element={<ActivitiesPage />} />
                                                <Route path="strength" element={<StrengthPage />} />
                                                <Route path="strength/:exerciseName" element={<StrengthPage />} />
                                                <Route path="styrka" element={<StrengthPage />} />
                                                <Route path="styrka/:exerciseName" element={<StrengthPage />} />
                                                <Route path="hyrox" element={<Navigate to="/health/hyrox" replace />} />

                                                <Route path="pass" element={<WorkoutsPage />} />
                                                <Route path="workouts" element={<WorkoutsPage />} />
                                                <Route path="workouts/builder" element={<WorkoutBuilderPage />} />
                                                <Route path="workouts/:id" element={<WorkoutDetailPage />} />
                                                <Route path="/exercises" element={<ExercisesPage />} />
                                                <Route path="matchup" element={<MatchupPage />} />
                                                <Route path="kamrat" element={<MatchupPage />} />
                                            </Routes>
                                        </Layout>
                                    </RequireAuth>
                                } />

                                {/* Catch-all */}
                                <Route path="/*" element={
                                    <RequireAuth>
                                        <Layout>
                                            <Routes>
                                                <Route path="*" element={<Navigate to="/" />} />
                                            </Routes>
                                        </Layout>
                                    </RequireAuth>
                                } />
                            </Routes>
                        </BrowserRouter>
                    </CookingModeProvider>
                </SettingsProvider>
            </DataProvider>
        </AuthProvider>
    );
}
