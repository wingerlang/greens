import React from "react";

export const DbSchemaModule: React.FC = () => {
  const schemaExample = {
    id: "food-linser",
    name: "Linser",
    calories: 350,
    protein: 24,
    carbs: 50,
    fat: 1.5,
    fiber: 11,
    unit: "kg",
    category: "legumes",
    iron: 7.5,
    zinc: 4.8,
    isCompleteProtein: false,
    proteinCategory: "legume",
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="p-2 bg-blue-500/10 rounded-lg">📊</span>
          Databasformat (JSON)
        </h3>
        <p className="text-gray-400 mb-4">
          Appen använder ett utökat JSON-format för att spara livsmedelsdata.
          Här är de viktigaste fälten:
        </p>

        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm border border-slate-800 shadow-inner overflow-x-auto">
          <pre className="text-blue-400">
                        {JSON.stringify(schemaExample, null, 2)}
          </pre>
        </div>
      </section>

      <section>
        <h4 className="font-semibold mb-3">Fältbeskrivning</h4>
        <div className="overflow-hidden border border-slate-800 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-gray-300">
              <tr>
                <th className="px-4 py-2">Fält</th>
                <th className="px-4 py-2">Typ</th>
                <th className="px-4 py-2">Beskrivning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-gray-400">
              <tr>
                <td className="px-4 py-2 text-blue-400">id</td>
                <td className="px-4 py-2">string</td>
                <td className="px-4 py-2">Unikt ID (e.g. food-broccoli)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-blue-400">calories</td>
                <td className="px-4 py-2">number</td>
                <td className="px-4 py-2">kcal per 100g</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-blue-400">iron / zinc</td>
                <td className="px-4 py-2">number</td>
                <td className="px-4 py-2">mg per 100g</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-blue-400">vitaminB12</td>
                <td className="px-4 py-2">number</td>
                <td className="px-4 py-2">µg per 100g</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-blue-400">proteinCategory</td>
                <td className="px-4 py-2">enum</td>
                <td className="px-4 py-2">legume | grain | nut | soy_quinoa</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-4">
        <span className="text-2xl">💡</span>
        <p className="text-sm text-amber-200/80 italic">
          Alla näringsvärden anges per 100g ätbar vara. För torkade varor
          (linser/ris) anges värdet för den torra råvaran om inte isCooked är
          satt till true.
        </p>
      </div>
    </div>
  );
};
