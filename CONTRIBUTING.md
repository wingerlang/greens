# Greens - Contributing Guidelines

## 🎯 Core Principles

1. **Modularity** - Every component should be self-contained and reusable
2. **Simplicity** - Prefer simple, readable code over clever abstractions
3. **Flexibility** - Design for change, use interfaces and types
4. **Testability** - Write unit tests for all business logic

---

## 📁 File Structure Rules

```
src/
├── models/          # Types, interfaces, constants
├── context/         # React contexts for state management
├── components/      # Reusable UI components
├── pages/           # Route-level page components
├── hooks/           # Custom React hooks
├── utils/           # Pure utility functions
└── tests/           # Unit tests (*.test.ts)
```

### File Size Limits
- **Max 400 lines per file** - Split larger files into modules
- **Max 50 lines per function** - Extract sub-functions
- **Max 10 imports** - Consider a barrel file if more needed

---

## ✅ Testing Requirements

**Always write unit tests using `Deno.test`:**

```typescript
// src/tests/utils.test.ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { calculateNutrition } from "../utils/nutrition.ts";

Deno.test("calculateNutrition returns correct values", () => {
  const result = calculateNutrition([...]);
  assertEquals(result.calories, 500);
});
```

Run tests: `deno test`

---

## 🧱 Component Guidelines

### 1. Keep Components Small
```tsx
// ❌ Bad - component does too much
function BigPage() { /* 500 lines */ }

// ✅ Good - split into focused components
function Page() {
  return (
    <PageHeader />
    <PageContent />
    <PageFooter />
  );
}
```

### 2. Extract Business Logic to Hooks
```tsx
// ❌ Bad - logic in component
function RecipePage() {
  const [recipes, setRecipes] = useState([]);
  // ...100 lines of logic
}

// ✅ Good - logic in custom hook
function RecipePage() {
  const { recipes, addRecipe, deleteRecipe } = useRecipes();
}
```

### 3. Use TypeScript Strictly
```tsx
// ❌ Bad - any types
function process(data: any) { ... }

// ✅ Good - explicit types
function process(data: FoodItem[]): NutritionSummary { ... }
```

---

## 🎨 Styling Guidelines

1. Use CSS variables from `index.css` design system
2. Component-specific CSS in same folder: `Component.tsx` + `Component.css`
3. Mobile-first responsive design
4. Prefer semantic class names: `.food-card` not `.fc-1`

---

## 🔌 Plug & Play Architecture

### Adding a New Page
1. Create `src/pages/NewPage.tsx` + `NewPage.css`
2. Add route in `App.tsx`
3. Add nav link in `Navigation.tsx`

### Adding a New Data Type
1. Add interface to `src/models/types.ts`
2. Add CRUD methods to `DataContext.tsx`
3. Write tests in `src/tests/`

### Adding a New Setting
1. Add to `UserSettings` interface in `types.ts`
2. Update `DEFAULT_USER_SETTINGS`
3. Add UI in `ProfilePage.tsx`

---

## 📝 Commit Message Format

```
feat: add recipe nutrition calculator
fix: correct CO2 calculation for kg units
refactor: split DatabasePage into components
test: add unit tests for nutrition utils
```

---

## 🚀 Before Submitting

- [ ] `deno lint` passes
- [ ] `deno test` passes
- [ ] No files over 400 lines
- [ ] Types are explicit (no `any`)
- [ ] New features have tests
