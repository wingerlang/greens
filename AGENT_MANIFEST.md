# Agent Manifest

> **Goal:** This file serves as a map for AI agents to navigate the codebase efficiently.
> **Usage:** Read this file to understand where tools, logic, and data reside before exploring the directory tree.

## 🗺️ High-Level Map

| Directory | Purpose | Agent Relevance |
|-----------|---------|-----------------|
| `src/utils/` | **Core Logic & Calculators**. Pure functions for math, parsing, and analysis. | **HIGH**. Primary toolset for answering user questions. |
| `src/api/` | **Backend & Data**. Handlers, Database Access (KV), and Routing. | **HIGH**. Use for understanding data flow and persistence. |
| `src/models/` | **Types & Interfaces**. Shared TypeScript definitions. | **HIGH**. Single source of truth for data structures. |
| `src/pages/` | **Frontend Views**. React components for UI. | **MEDIUM**. Reference for UI structure; do not put logic here. |
| `src/hooks/` | **Frontend Logic**. Reusable React hooks (State, Data Fetching). | **MEDIUM**. implementation details for UI behavior. |

---

## 🛠️ Key Tools & Modules

### 1. Nutrition & Parsing (`src/utils/nutrition/`)
* **Goal:** Extract structured nutrition data from messy inputs (Text, JSON-LD, Images).
* **Standard:** Atomic modules with Zod validation.
* **Modules:**
    * `parsers/textParser.ts`: `parseNutritionText(text)` - Extracts macros from OCR/Raw text.
    * `parsers/jsonLdParser.ts`: `extractFromJSONLD(json)` - Extracts data from Schema.org objects.
    * `extractors/productNameExtractor.ts`: `cleanProductName(title, h1)` - Cleans e-commerce titles.
    * `extractors/packagingExtractor.ts`: `extractPackagingWeight(text)` - Finds net weight (e.g. "500g").
    * `extractors/brandExtractor.ts`: `extractBrand(text, knownBrands)` - Identifies manufacturers.

### 2. Health Calculators (`src/utils/healthCalculators.ts`)
* **Goal:** Calculate BMR, TDEE, BMI, and Macro splits.
* **Functions:**
    * `calculateBMR(weight, height, age, gender)`: Mifflin-St Jeor equation.
    * `calculateTDEE(bmr, activityLevel)`: Total Daily Energy Expenditure.
    * `calculateCalorieDeficit(currentWeight, targetWeight, days, tdee)`: Weight loss planning.

### 3. Strength Calculators (`src/utils/strengthCalculators.ts`)
* **Goal:** 1RM estimations and Plate Loading.
* **Functions:**
    * `calculateEstimated1RM(weight, reps)`: Returns averaged 1RM from multiple formulas.
    * `calculateWilks(weight, total, gender)`: Powerlifting score.

### 4. Database Access (`src/api/db/`)
* **Goal:** Low-level Deno KV interaction.
* **Files:**
    * `user.ts`: User CRUD and Auth.
    * `data.ts`: Monolithic user data (Legacy).
    * `kv.ts`: Raw KV client instance.

### 5. API Handlers (`src/api/handlers/`)
* **Goal:** Process HTTP requests.
* **Files:**
    * `data.ts`: **WARNING** Mixed concern handler for Meals, Weight, Measurements.
    * `auth.ts`: Login/Register logic.
    * `upload.ts`: File upload and OCR processing.

---

## ⚠️ Anti-Patterns & "No-Go" Zones

* **God Classes:** Avoid adding to `src/api/handlers/data.ts`. It is over-complex.
* **Legacy Monolith:** Avoid `saveUserData` (full blob save). Prefer granular repositories (e.g., `mealRepository`).
* **Implicit Types:** Do not use `any`. Always import types from `src/models/types.ts`.
