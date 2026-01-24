import React, { useMemo, useState } from "react";
import { useData } from "../context/DataContext.tsx";
import { type Recipe } from "../models/types.ts";
import { parseIngredients } from "../utils/ingredientParser.ts";

export function PantryPage() {
  const { pantryItems, togglePantryItem, setPantryItems, recipes } = useData();
  const [searchTerm, setSearchTerm] = useState("");

  // Pre-defined common staples for quick access
  const commonStaples = [
    "Salt",
    "Peppar",
    "Olivolja",
    "Smör",
    "Mjölk",
    "Ägg",
    "Lök",
    "Vitlök",
    "Pasta",
    "Ris",
    "Krossade tomater",
    "Socker",
    "Mjöl",
    "Bakpulver",
    "Soja",
    "Buljong",
  ];

  // Filtered view of owned items
  const ownedItems = useMemo(() => {
    return [...pantryItems].sort((a, b) => a.localeCompare(b));
  }, [pantryItems]);

  // Calculate recipe matches based on pantry
  const recipeMatches = useMemo(() => {
    if (pantryItems.length === 0) return [];

    return recipes.map((recipe) => {
      if (!recipe.ingredientsText) {
        return { recipe, matchPercentage: 0, missing: [] };
      }

      const ingredients = parseIngredients(recipe.ingredientsText);
      const total = ingredients.length;
      if (total === 0) return { recipe, matchPercentage: 0, missing: [] };

      let owned = 0;
      const missing: string[] = [];

      ingredients.forEach((ing) => {
        const ingName = ing.name.toLowerCase();
        // Check exact match or partial match
        // naive check: is "lök" in pantry? match "gul lök"
        // better: is pantry item "lök" in ingredient "gul lök"?
        const hasItem = pantryItems.some((pItem) =>
          ingName.includes(pItem.toLowerCase()) ||
          pItem.toLowerCase().includes(ingName)
        );

        if (hasItem) {
          owned++;
        } else {
          missing.push(ing.name);
        }
      });

      return {
        recipe,
        matchPercentage: Math.round((owned / total) * 100),
        missing,
      };
    })
      .filter((m) => m.matchPercentage > 0)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [recipes, pantryItems]);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Capitalize first letter
      const item = searchTerm.trim().charAt(0).toUpperCase() +
        searchTerm.trim().slice(1);
      if (!pantryItems.includes(item)) {
        togglePantryItem(item);
      }
      setSearchTerm("");
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-24 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent mb-2">
          Maträddaren 🏠
        </h1>
        <p className="text-slate-400">
          Bocka för vad du har hemma så föreslår vi recept.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
        {/* Left Column: Inventory Management */}
        <div className="space-y-6">
          {/* Add Item Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <form onSubmit={handleAddCustom} className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                🔍
              </span>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="Lägg till vad du har hemma (t.ex. 'Quinoa')..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>

            {/* Common Staples Quick Add */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
                Vanliga Basvaror
              </h3>
              <div className="flex flex-wrap gap-2">
                {commonStaples.map((item) => {
                  const isOwned = pantryItems.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => togglePantryItem(item)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isOwned
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {isOwned ? "✓ " : "+ "}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Inventory */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ditt Skafferi ({pantryItems.length})
                </h3>
                {pantryItems.length > 0 && (
                  <button
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    onClick={() => {
                      if (confirm("Rensa hela skafferiet?")) {
                        setPantryItems([]);
                      }
                    }}
                  >
                    Rensa allt
                  </button>
                )}
              </div>

              {pantryItems.length === 0
                ? (
                  <div className="text-center py-8 text-slate-600 border border-dashed border-slate-800 rounded-xl">
                    <span className="text-2xl block mb-2 opacity-50">🏚️</span>
                    Ekat tomt här. Lägg till basvaror ovan!
                  </div>
                )
                : (
                  <div className="flex flex-wrap gap-2">
                    {ownedItems.map((item: string) => (
                      <button
                        key={item}
                        onClick={() => togglePantryItem(item)}
                        className="group flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700 hover:border-rose-500/30 hover:bg-rose-500/10 rounded-xl transition-all"
                      >
                        <span className="text-slate-200">{item}</span>
                        <span className="text-slate-500 group-hover:text-rose-400">
                          ✕
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Right Column: Recipe Suggestions */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>🍳</span> Vad kan du laga?
            </h2>

            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {recipeMatches.length === 0
                ? (
                  <p className="text-slate-500 text-sm italic">
                    {pantryItems.length < 3
                      ? "Lägg till fler ingredienser för att se matchningar..."
                      : "Inga recept matchar just nu. Prova lägga till fler basvaror!"}
                  </p>
                )
                : (
                  recipeMatches.map((
                    { recipe, matchPercentage, missing }: {
                      recipe: Recipe;
                      matchPercentage: number;
                      missing: string[];
                    },
                  ) => (
                    <div
                      key={recipe.id}
                      className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/30 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                          {recipe.name}
                        </h3>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-md ${
                            matchPercentage === 100
                              ? "bg-emerald-500 text-emerald-950"
                              : matchPercentage >= 75
                              ? "bg-emerald-500/20 text-emerald-400"
                              : matchPercentage >= 50
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {matchPercentage}% Match
                        </span>
                      </div>

                      {/* Missing Ingredients Preview */}
                      {missing.length > 0 && matchPercentage < 100 && (
                        <div className="mt-2 text-xs">
                          <span className="text-slate-500">Saknas:</span>
                          <span className="text-rose-400/80">
                            {missing.slice(0, 3).join(", ")}
                            {missing.length > 3 &&
                              ` +${missing.length - 3} till`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
