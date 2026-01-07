# Agent Optimization Report

## 1. Diagnosis
The current codebase exhibits "Human-Native" traits that hinder Agent performance:

*   **God Classes:** `src/utils/nutritionParser.ts` (now refactored) and `src/api/handlers/data.ts` mixed multiple concerns, making it hard for Agents to retrieve specific context without token bloat.
*   **Implicit Logic:** Many utility functions relied on regex magic without clear input/output contracts.
*   **Lack of runtime validation:** Inputs were trusted blindly, leading to potential silent failures or garbage-in-garbage-out scenarios for AI tool use.
*   **Discoverability:** The directory structure is flat in some areas (`utils/` has 40+ files) making it hard for an Agent to "see" what tools are available without listing all files.

## 2. Refactoring Standards ("The Agent Standard")

### A. Atomic Modularity
*   **Rule:** One primary concept per file.
*   **Implementation:** `src/utils/nutrition/` demonstrates this. Instead of one file doing everything, we have `textParser.ts`, `brandExtractor.ts`, etc.
*   **Benefit:** Agents can inject *only* the specific tool logic into their context window (RAG optimization).

### B. Semantic Typing (Zod)
*   **Rule:** All public tools must have Zod schemas for Inputs and Outputs.
*   **Implementation:** `src/utils/nutrition/schemas.ts` defines the contracts.
*   **Benefit:** Prevents hallucinations. If an Agent generates invalid parameters, Zod rejects it *before* execution, providing a clear error message to the Agent for self-correction.

### C. Context-Dense Documentation
*   **Rule:** Docstrings must describe *Goal*, *Constraints*, and *Dependencies*.
*   **Implementation:**
    ```typescript
    /**
     * Goal: Extract standard nutrition facts...
     * Constraints: Relies on regex patterns...
     * Dependencies: Zod for validation.
     */
    ```
*   **Benefit:** teaches the LLM *when* to use the tool, not just what it does.

## 3. The Blueprint Execution
I have refactored `src/utils/nutritionParser.ts` into the `src/utils/nutrition/` directory following the standards above.

*   **Original:** ~200 lines of mixed logic.
*   **New:**
    *   `schemas.ts`: Strict types.
    *   `parsers/`: Dedicated logic for Text and JSON-LD.
    *   `extractors/`: Dedicated logic for Brands, Packaging, and Names.
    *   `index.ts`: Clean API surface.

## 4. Next Steps
To fully modernize this repository:
1.  **Split `src/api/handlers/data.ts`**: Break it into `mealHandler.ts`, `weightHandler.ts`, etc.
2.  **Audit `src/utils/`**: Apply the Atomic Modularity pattern to other large files like `healthCalculators.ts` if they grow too large.
3.  **Enforce Zod:** Gradually add Zod validation to all API endpoints.
