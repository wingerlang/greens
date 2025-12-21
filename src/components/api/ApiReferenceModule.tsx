import React from 'react';

export const ApiReferenceModule: React.FC = () => {
    return (
        <div className="space-y-6">
            <section>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="p-2 bg-purple-500/10 rounded-lg">🔌</span>
                    Developer Interface
                </h3>
                <p className="text-gray-400 mb-4">
                    Du kan interagera med appens data genom <code>useData()</code> hooken. Detta är det rekommenderade sättet att bygga nya moduler.
                </p>

                <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm border border-slate-800 space-y-4">
                    <div>
                        <div className="text-gray-500 mb-2">// Hämta alla råvaror</div>
                        <code className="text-purple-400">const {"{ foodItems }"} = useData();</code>
                    </div>
                    <div>
                        <div className="text-gray-500 mb-2">// Lägg till en ny råvara</div>
                        <code className="text-purple-400">addFoodItem(newItem: FoodItem);</code>
                    </div>
                </div>
            </section>

            <section>
                <h4 className="font-semibold mb-3">Backend Integration (Framtid)</h4>
                <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <span className="font-bold">POST</span>
                        <code className="bg-slate-900 px-2 py-1 rounded text-xs">/api/v1/ingredients/bulk</code>
                    </div>
                    <p className="text-sm text-gray-500">
                        Denna endpoint är förberedd för framtida synkronisering med en molndatabas. Just nu hanteras all bulk-data lokalt via import-modulen.
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="text-blue-400 font-bold mb-1 italic">Type Safety</div>
                    <p className="text-xs text-gray-500">Fullt stöd för TypeScript med <code>FoodItem</code> och <code>Recipe</code> gränssnitt.</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="text-green-400 font-bold mb-1 italic">Real-time</div>
                    <p className="text-xs text-gray-500">Context-API säkerställer att alla vyer uppdateras direkt vid import.</p>
                </div>
            </div>
        </div>
    );
};
