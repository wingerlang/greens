import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataProvider } from './context/DataContext.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { AnalyticsProvider } from './context/AnalyticsContext.tsx';
import { CookingModeProvider } from './context/CookingModeProvider.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { MessageProvider } from './context/MessageContext.tsx';
import { Layout } from './components/Layout.tsx';
import { RequireRole } from './components/RequireRole.tsx';
import DebugBar from './components/debug/DebugBar.tsx';
import { BugReporter } from './components/debug/BugReporter.tsx';
import { RootHandler } from './components/RootHandler.tsx';

// Lazy loading pages for better performance
const WeeklyPage = React.lazy(() => import('./pages/WeeklyPage.tsx'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'));
const MessagesPage = React.lazy(() => import('./pages/MessagesPage.tsx'));
const DatabasePage = React.lazy(() => import('./pages/DatabasePage.tsx'));
const ExerciseDatabasePage = React.lazy(() => import('./pages/admin/ExerciseDatabasePage.tsx'));
const PantryPage = React.lazy(() => import('./pages/PantryPage.tsx'));
const RecipesPage = React.lazy(() => import('./pages/RecipesPage.tsx'));
const CaloriesPage = React.lazy(() => import('./pages/CaloriesPage.tsx'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage.tsx'));
const TrainingPeriodPage = React.lazy(() => import('./pages/TrainingPeriodPage.tsx'));
const TrainingPage = React.lazy(() => import('./pages/TrainingPage.tsx'));
const PlanningPage = React.lazy(() => import('./pages/PlanningPage.tsx'));
const TrainingPlanningPage = React.lazy(() => import('./pages/TrainingPlanningPage.tsx'));
const ApiPage = React.lazy(() => import('./pages/ApiPage.tsx'));
const AdminPage = React.lazy(() => import('./pages/AdminPage.tsx'));
const AnalyticsDashboard = React.lazy(() => import('./pages/admin/AnalyticsDashboard.tsx').then(m => ({ default: m.AnalyticsDashboard })));
const DocumentationPage = React.lazy(() => import('./components/DocumentationPage.tsx').then(m => ({ default: m.DocumentationPage })));
const HealthPage = React.lazy(() => import('./pages/HealthPage.tsx'));
const CompetitionPage = React.lazy(() => import('./pages/CompetitionPage.tsx'));
const LoginPage = React.lazy(() => import('./pages/LoginPage.tsx').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage.tsx').then(m => ({ default: m.RegisterPage })));
const WorkoutsPage = React.lazy(() => import('./pages/WorkoutsPage.tsx'));
const CoachPage = React.lazy(() => import('./pages/CoachPage.tsx'));
const PublicProfilePage = React.lazy(() => import('./pages/PublicProfilePage.tsx'));
const UsersPage = React.lazy(() => import('./pages/UsersPage.tsx'));
const GarminPage = React.lazy(() => import('./pages/GarminPage.tsx'));
const IntegrationsPage = React.lazy(() => import('./pages/IntegrationsPage.tsx'));
const ActivitiesPage = React.lazy(() => import('./pages/ActivitiesPage.tsx'));
const StrengthPage = React.lazy(() => import('./pages/StrengthPage.tsx'));
const ExercisesPage = React.lazy(() => import('./pages/ExercisesPage.tsx'));
const MuscleOverviewPage = React.lazy(() => import('./pages/exercises/MuscleOverviewPage.tsx'));
const LoadAnalysisPage = React.lazy(() => import('./pages/training/LoadAnalysisPage.tsx'));
const WorkoutBuilderPage = React.lazy(() => import('./pages/WorkoutBuilderPage.tsx'));
const WorkoutDetailPage = React.lazy(() => import('./pages/WorkoutDetailPage.tsx'));
const MatchupPage = React.lazy(() => import('./pages/MatchupPage.tsx'));
const LifeStreamPage = React.lazy(() => import('./pages/LifeStreamPage.tsx'));
const YearInReviewPage = React.lazy(() => import('./pages/YearInReviewPage.tsx'));
const GoalsPage = React.lazy(() => import('./pages/GoalsPage.tsx'));
const ActivityStandalonePage = React.lazy(() => import('./pages/ActivityStandalonePage.tsx'));
const CommunityStatsPage = React.lazy(() => import('./pages/CommunityStatsPage.tsx'));
const ToolsPage = React.lazy(() => import('./pages/ToolsPage.tsx'));
const ToolsOneRepMaxPage = React.lazy(() => import('./pages/tools/ToolsOneRepMaxPage.tsx'));
const ToolsRacePredictorPage = React.lazy(() => import('./pages/tools/ToolsRacePredictorPage.tsx'));
const ToolsPaceConverterPage = React.lazy(() => import('./pages/tools/ToolsPaceConverterPage.tsx'));
const ToolsHealthPage = React.lazy(() => import('./pages/tools/ToolsHealthPage.tsx'));
const ToolsPowerPage = React.lazy(() => import('./pages/tools/ToolsPowerPage.tsx'));
const ToolsMacroPage = React.lazy(() => import('./pages/tools/ToolsMacroPage.tsx'));
const ToolsCooperPage = React.lazy(() => import('./pages/tools/ToolsCooperPage.tsx'));
const ToolsHeartRatePage = React.lazy(() => import('./pages/tools/ToolsHeartRatePage.tsx'));
const ToolsStrengthStandardsPage = React.lazy(() => import('./pages/tools/ToolsStrengthStandardsPage.tsx'));
const ToolsOlympicPage = React.lazy(() => import('./pages/tools/ToolsOlympicPage.tsx'));
const ToolsHyroxPage = React.lazy(() => import('./pages/tools/ToolsHyroxPage.tsx'));
const ToolsRacePlannerPage = React.lazy(() => import('./pages/tools/ToolsRacePlannerPage.tsx'));
const ToolsReplayPage = React.lazy(() => import('./pages/tools/ToolsReplayPage.tsx'));
const ToolsInterferencePage = React.lazy(() => import('./pages/tools/ToolsInterferencePage.tsx'));
const ToolsTrainingReportPage = React.lazy(() => import('./pages/tools/ToolsTrainingReportPage.tsx'));
const ToolsCyclingPage = React.lazy(() => import('./pages/tools/ToolsCyclingPage.tsx'));
const BeastModePage = React.lazy(() => import('./pages/BeastModePage.tsx'));
const PlannerPage = React.lazy(() => import('./components/planner/PlannerPage.tsx'));
const RoadmapPage = React.lazy(() => import('./pages/RoadmapPage.tsx'));
const DocsPage = React.lazy(() => import('./pages/DocsPage.tsx'));
const SummaryPage = React.lazy(() => import('./pages/SummaryPage.tsx'));
const DeveloperLayout = React.lazy(() => import('./pages/developer/DeveloperLayout.tsx'));
const DeveloperDashboard = React.lazy(() => import('./pages/developer/DeveloperDashboard.tsx'));
const DeveloperExplorer = React.lazy(() => import('./pages/developer/DeveloperExplorer.tsx'));
const DeveloperAnalysis = React.lazy(() => import('./pages/developer/DeveloperAnalysis.tsx'));
const DeveloperDeepAnalysis = React.lazy(() => import('./pages/developer/DeveloperDeepAnalysis.tsx'));
const DeveloperTodos = React.lazy(() => import('./pages/developer/DeveloperTodos.tsx'));
const DeveloperHealth = React.lazy(() => import('./pages/developer/DeveloperHealth.tsx'));
const DeveloperManagement = React.lazy(() => import('./pages/developer/DeveloperManagement.tsx'));
const DeveloperCoverage = React.lazy(() => import('./pages/developer/DeveloperCoverage.tsx'));

function PageLoader() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden">
            <div className="relative flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="mt-4 text-emerald-500 font-bold tracking-widest text-[10px] uppercase opacity-70 animate-pulse">Initializing Interface</div>
            </div>
        </div>
    );
}

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

const queryClient = new QueryClient();

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <DataProvider>
                    <SettingsProvider>
                        <CookingModeProvider>
                            <BrowserRouter>
                                <AnalyticsProvider>
                                    <MessageProvider>
                                        <DebugBar />
                                        <BugReporter />
                                        <React.Suspense fallback={<PageLoader />}>
                                            <Routes>
                                                {/* Public Routes */}
                                                <Route path="/login" element={<LoginPage />} />
                                                <Route path="/register" element={<RegisterPage />} />

                                                {/* Root Logic */}
                                                <Route path="/" element={<RootHandler />} />

                                                {/* Protected Routes */}
                                                <Route path="/*" element={
                                                    <RequireAuth>
                                                        <Layout>
                                                            <Routes>
                                                                <Route path="meddelanden" element={<MessagesPage />} />
                                                                <Route path="messages" element={<Navigate to="/meddelanden" replace />} />
                                                                <Route path="veckan" element={<WeeklyPage />} />
                                                                <Route path="weekly" element={<WeeklyPage />} />
                                                                <Route path="vecka" element={<WeeklyPage />} />
                                                                <Route path="vecka/recept/:recipeId/*" element={<WeeklyPage />} />
                                                                <Route path="matplanera" element={<PlanningPage />} />
                                                                <Route path="planning/training" element={<TrainingPlanningPage />} />
                                                                <Route path="planera" element={<TrainingPlanningPage />} />
                                                                <Route path="planera/traning" element={<TrainingPlanningPage />} />
                                                                <Route path="planner" element={<PlannerPage />} />
                                                                <Route path="pantry" element={<PantryPage />} />
                                                                <Route path="recipes" element={<RecipesPage />} />
                                                                <Route path="database" element={<DatabasePage />} />
                                                                <Route path="databas" element={<DatabasePage />} />
                                                                <Route path="calories" element={<CaloriesPage />} />
                                                                <Route path="training/period/:id?" element={<TrainingPeriodPage />} />
                                                                <Route path="training/:tab?/:subTab?/:id?" element={<TrainingPage />} />
                                                                <Route path="profile/:tab?" element={<ProfilePage />} />
                                                                <Route path="profile" element={<ProfilePage />} />
                                                                <Route path="health" element={<HealthPage />} />
                                                                <Route path="health/:metric" element={<HealthPage />} />
                                                                <Route path="halsa" element={<HealthPage />} />
                                                                <Route path="halsa/:metric" element={<HealthPage />} />
                                                                <Route path="hälsa" element={<HealthPage />} />
                                                                <Route path="hälsa/:metric" element={<HealthPage />} />
                                                                <Route path="coach" element={<CoachPage />} />
                                                                <Route path="competition" element={<CompetitionPage />} />
                                                                <Route path="tävling" element={<CompetitionPage />} />

                                                                <Route path="admin/*" element={
                                                                    <RequireRole role="admin">
                                                                        <AdminPage />
                                                                    </RequireRole>
                                                                } />
                                                                <Route path="analytics" element={<Navigate to="/admin/analytics" replace />} />
                                                                <Route path="analys" element={<Navigate to="/admin/analytics" replace />} />

                                                                {/* Developer Routes */}
                                                                <Route path="developer" element={
                                                                    <RequireRole role="developer">
                                                                        <DeveloperLayout />
                                                                    </RequireRole>
                                                                }>
                                                                    <Route index element={<DeveloperDashboard />} />
                                                                    <Route path="todos" element={<DeveloperTodos />} />
                                                                    <Route path="explorer" element={<DeveloperExplorer />} />
                                                                    <Route path="analysis" element={<DeveloperAnalysis />} />
                                                                    <Route path="deep" element={<DeveloperDeepAnalysis />} />
                                                                    <Route path="health" element={<DeveloperHealth />} />
                                                                    <Route path="management" element={<DeveloperManagement />} />
                                                                    <Route path="coverage" element={<DeveloperCoverage />} />
                                                                </Route>

                                                                <Route path="api" element={<ApiPage />} />
                                                                <Route path="docs" element={<DocumentationPage />} />
                                                                <Route path="regler" element={<DocsPage />} />
                                                                <Route path="roadmap" element={<RoadmapPage />} />
                                                                <Route path="community" element={<UsersPage />} />
                                                                <Route path="u/:handle" element={<PublicProfilePage />} />
                                                                <Route path="garmin" element={<GarminPage />} />
                                                                <Route path="settings" element={<Navigate to="/profile" replace />} />
                                                                <Route path="sync" element={<IntegrationsPage />} />
                                                                <Route path="installningar" element={<Navigate to="/profile" replace />} />
                                                                <Route path="activities" element={<ActivitiesPage />} />
                                                                <Route path="logg" element={<ActivitiesPage />} />
                                                                <Route path="strength" element={<StrengthPage />} />
                                                                <Route path="strength/:tab" element={<StrengthPage />} />
                                                                <Route path="styrka" element={<StrengthPage />} />
                                                                <Route path="styrka/:tab" element={<StrengthPage />} />
                                                                <Route path="hyrox" element={<Navigate to="/health/hyrox" replace />} />

                                                                <Route path="pass" element={<WorkoutsPage />} />
                                                                <Route path="workouts" element={<WorkoutsPage />} />
                                                                <Route path="workouts/builder" element={<WorkoutBuilderPage />} />
                                                                <Route path="workouts/:id" element={<WorkoutDetailPage />} />
                                                                <Route path="/exercises" element={<ExercisesPage />} />
                                                                <Route path="/övning" element={<ExercisesPage />} />
                                                                <Route path="/exercises/muscles" element={<MuscleOverviewPage />} />
                                                                <Route path="/training/load" element={<LoadAnalysisPage />} />
                                                                <Route path="matchup" element={<MatchupPage />} />
                                                                <Route path="kamrat" element={<MatchupPage />} />
                                                                <Route path="feed" element={<LifeStreamPage />} />
                                                                <Route path="lifestream" element={<LifeStreamPage />} />
                                                                <Route path="review" element={<YearInReviewPage />} />
                                                                <Route path="year-in-review" element={<Navigate to="/review" replace />} />
                                                                <Route path="ars-sammanfattning" element={<Navigate to="/review" replace />} />
                                                                <Route path="summary" element={<SummaryPage />} />
                                                                <Route path="sammanfattning" element={<SummaryPage />} />
                                                                <Route path="goals" element={<GoalsPage />} />
                                                                <Route path="mal" element={<GoalsPage />} />
                                                                <Route path="activity/:id" element={<ActivityStandalonePage />} />
                                                                <Route path="statistics/:tab?" element={<CommunityStatsPage />} />
                                                                <Route path="statistik/:tab?" element={<CommunityStatsPage />} />

                                                                <Route path="tools" element={<ToolsPage />} />
                                                                <Route path="verktyg" element={<ToolsPage />} />
                                                                <Route path="tools/1rm" element={<ToolsOneRepMaxPage />} />
                                                                <Route path="tools/1rm/:exerciseName" element={<ToolsOneRepMaxPage />} />
                                                                <Route path="rm/:exerciseName?" element={<ToolsOneRepMaxPage />} />
                                                                <Route path="tools/race" element={<ToolsRacePredictorPage />} />
                                                                <Route path="tools/race-planner" element={<ToolsRacePlannerPage />} />
                                                                <Route path="tools/race-predictor" element={<ToolsRacePredictorPage />} />
                                                                <Route path="tools/pace" element={<ToolsPaceConverterPage />} />
                                                                <Route path="tools/health" element={<ToolsHealthPage />} />
                                                                <Route path="tools/power" element={<ToolsPowerPage />} />
                                                                <Route path="tools/macros" element={<ToolsMacroPage />} />
                                                                <Route path="tools/cooper" element={<ToolsCooperPage />} />
                                                                <Route path="tools/hr" element={<ToolsHeartRatePage />} />
                                                                <Route path="tools/standards" element={<ToolsStrengthStandardsPage />} />
                                                                <Route path="tools/olympic" element={<ToolsOlympicPage />} />
                                                                <Route path="tools/hyrox" element={<ToolsHyroxPage />} />
                                                                <Route path="tools/replay" element={<ToolsReplayPage />} />
                                                                <Route path="tools/interference" element={<ToolsInterferencePage />} />
                                                                <Route path="tools/report" element={<ToolsTrainingReportPage />} />
                                                                <Route path="tools/cycling" element={<ToolsCyclingPage />} />
                                                                <Route path="tools/beast" element={<BeastModePage />} />
                                                                <Route path="beast" element={<BeastModePage />} />
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
                                        </React.Suspense>
                                    </MessageProvider>
                                </AnalyticsProvider>
                            </BrowserRouter>
                        </CookingModeProvider>
                    </SettingsProvider>
                </DataProvider>
            </AuthProvider>
        </QueryClientProvider >
    );
}
