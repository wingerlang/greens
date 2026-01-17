# Refactoring Plan: Modularization of Large Files

This plan outlines the strategy to refactor the largest files in the codebase (>750 lines) into smaller, reusable, and feature-based components. The goal is to improve maintainability and readability without altering functionality.

## 1. Architectural Strategy

We will adopt a **Feature-based Architecture** to organize the extracted components. This scales better than a generic `components/` folder and keeps related logic together.

**Target Structure:**
```
src/
  features/
    dashboard/          # DashboardPage components
      components/
    activity/           # ActivityDetailModal, Logging
      components/
    strength/           # ExerciseDetailModal, Strength logic
      components/
    goals/              # GoalModal
      components/
    search/             # Omnibox
      components/
    nutrition/          # DatabasePage, Food logging
      components/
```

## 2. Refactoring Guidelines

*   **"Lift and Shift":** Extract components as they are, passing necessary data via props. Minimize logic changes during extraction.
*   **Props Interface:** Define strict TypeScript interfaces for all new components.
*   **No Circular Dependencies:** Ensure child components do not import their parents.
*   **Atomic Commits:** Refactor one major file at a time to minimize regression risk.

## 3. Detailed Breakdown by File

### A. `src/context/DataContext.tsx` (~2200 lines)
**Strategy:** Instead of breaking the *Provider* immediately (which is high risk), we will extract the *logic* into custom hooks (composables) that the Provider utilizes.

*   **Step 1:** Create `src/context/hooks/`
*   **Step 2:** Extract logic groups into separate files:
    *   `useNutritionData.ts`: `foodItems`, `recipes`, `mealEntries`, CRUD functions, calculations.
    *   `useActivityData.ts`: `exerciseEntries`, `strengthSessions`, `unifiedActivities`, streak logic.
    *   `useBodyData.ts`: `weightEntries`, `bodyMeasurements`, `dailyVitals`.
    *   `usePlanningData.ts`: `weeklyPlans`, `plannedActivities`, `coachConfig`.
*   **Step 3:** Refactor `DataContext` to simply compose these hooks.

### B. `src/pages/DashboardPage.tsx` (~1700 lines)
**Target Directory:** `src/features/dashboard/components/`

*   **`DailyStatsCard.tsx`**: The top row summary (calories, protein, training time).
*   **`HealthMetricsCard.tsx`**: The large card with Weight/BMI stats and the Sparkline chart.
*   **`WeeklyTimeline.tsx`**: The horizontal bar chart visualization of the last 7 days.
*   **`QuickLogWidgets.tsx`**: Wrapper for Sleep, Water, Alcohol cards (extracting the logic for these small widgets).
*   **`ActionFab.tsx`**: The floating action button logic.

### C. `src/components/activities/ActivityDetailModal.tsx` (~1700 lines)
**Target Directory:** `src/features/activity/components/detail/`

*   **`ActivityHeader.tsx`**: Title, Date, Edit/Close buttons, Strava link logic.
*   **`ActivityStatsGrid.tsx`**: The main grid showing Time, Distance, Pace, Calories, HR.
*   **`SplitsChart.tsx`**: The Bar/Line chart combo for splits.
*   **`ActivityEditForm.tsx`**: The editing mode form logic.
*   **`MergeView.tsx`**: The comparison table for merged activities.
*   **`StrengthWorkoutList.tsx`**: The expandable list of strength exercises (currently inline).

### D. `src/components/training/ExerciseDetailModal.tsx` (~1500 lines)
**Target Directory:** `src/features/strength/components/exercise-detail/`

*   **`ExerciseHero.tsx`**: The top banner showing "Annual Best" or current status.
*   **`ExerciseRecords.tsx`**: The cards for "Max Weight", "Best 1RM", "Max Distance".
*   **`ProgressionChart.tsx`**: The complex SVG chart logic (Annual/History views).
*   **`HistoryTable.tsx`**: The scrollable list of all historical sessions.

### E. `src/components/training/GoalModal.tsx` (~1450 lines)
**Target Directory:** `src/features/goals/components/wizard/`

*   **`GoalTypeSelector.tsx`**: The grid of goal types (Frequency, Distance, etc.).
*   **`FrequencyConfig.tsx`**: Inputs for "X times per week".
*   **`VolumeConfig.tsx`**: Inputs for Distance/Tonnage/Calories.
*   **`BodyGoalConfig.tsx`**: Inputs for Weight/Measurements (Direction, Rate, Current/Target).
*   **`NutritionConfig.tsx`**: Inputs for Macros/Calories + Nutrition Wizard integration.

### F. `src/components/Omnibox.tsx` (~1400 lines)
**Target Directory:** `src/features/search/components/omnibox/`

*   **`OmniboxInput.tsx`**: The main input field with feedback mode.
*   **`QuickLogFood.tsx`**: The UI state when a food item is locked (Quantity, MealType, Date inputs).
*   **`QuickLogExercise.tsx`**: The UI state for logging duration/intensity.
*   **`SearchResults.tsx`**: The list rendering for Foods, Users, and Navigation items.

### G. `src/pages/DatabasePage.tsx` (~1383 lines)
**Target Directory:** `src/features/nutrition/components/database/`

*   **`FoodFormModal.tsx`**: The large create/edit form.
    *   *Sub-component:* `SmartParserInput.tsx` (Text area + Image dropzone + Parsing logic).
*   **`FoodDetailView.tsx`**: The view-only modal with stats and history.
*   **`FoodListTable.tsx`**: The list view implementation.
*   **`FoodGridCard.tsx`**: The card component for grid view.

## 4. Execution Order

1.  **DashboardPage:** High visibility, lower risk than Context.
2.  **Omnibox:** Self-contained logic.
3.  **DatabasePage:** Clean UI separation possible.
4.  **ActivityDetailModal:** Complex logic, needs careful prop drilling.
5.  **ExerciseDetailModal:** Similar complexity to ActivityDetail.
6.  **GoalModal:** Heavy form state logic.
7.  **DataContext:** Critical path. Ideally done in smaller chunks or as the final major step once components are stabilized.

## 5. Success Criteria
*   Files reduced to < 500 lines where possible.
*   No TypeScript errors.
*   No runtime crashes or missing functionality.
*   Feature folders created and populated.
