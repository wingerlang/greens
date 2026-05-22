import React, { useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { FoodItem } from '../../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../../services/profileService.ts';
export function ProtocolView() {
    const navigate = useNavigate();
    const { foodItems, recipes } = useData();
    const { settings, updateSettings } = useSettings();
    const [isEditing, setIsEditing] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // UI State for new entry
    const [selectedFoodId, setSelectedFoodId] = useState('');
    const [timing, setTiming] = useState('Morgon');
    const [dose, setDose] = useState('');
    const [notes, setNotes] = useState('');

    const protocol = settings.supplementProtocol || [];
    
    const eligibleItems = foodItems.filter(f => ['supplements', 'protein', 'protein-bar', 'meal-replacement'].includes(f.category));

    const handleAdd = () => {
        if (!selectedFoodId) return;
        const isRecipe = selectedFoodId.startsWith('recipe:');
        const finalId = selectedFoodId.replace('recipe:', '');
        
        const newEntry = {
            foodItemId: finalId,
            isRecipe,
            timing,
            dose,
            isActive: true,
            notes
        };
        const newProtocol = [...protocol, newEntry];
        updateSettings({
            supplementProtocol: newProtocol
        });
        profileService.updateProfile({ supplementProtocol: newProtocol });
        setSelectedFoodId('');
        setDose('');
        setNotes('');
    };

    const handleRemove = (index: number) => {
        const updated = [...protocol];
        updated.splice(index, 1);
        updateSettings({ supplementProtocol: updated });
        profileService.updateProfile({ supplementProtocol: updated });
    };

    const handleToggleActive = (index: number) => {
        const updated = [...protocol];
        updated[index].isActive = !updated[index].isActive;
        updateSettings({ supplementProtocol: updated });
        profileService.updateProfile({ supplementProtocol: updated });
    };

    // Group by timing
    const grouped = protocol.reduce((acc, entry) => {
        if (!acc[entry.timing]) acc[entry.timing] = [];
        acc[entry.timing].push(entry);
        return acc;
    }, {} as Record<string, typeof protocol>);

    const timings = ['Morgon', 'Förmiddag', 'Innan träning', 'Under träning', 'Efter träning', 'Lunch', 'Eftermiddag', 'Kväll', 'Innan sänggående', 'Vid behov'];

    const handleSelectChange = (val: string) => {
        setSelectedFoodId(val);
        setIsDropdownOpen(false);
        
        if (val.startsWith('recipe:')) {
            const recipe = recipes.find(r => r.id === val.replace('recipe:', ''));
            if (recipe) {
                setDose('1 portion');
            }
        } else {
            const sup = eligibleItems.find(s => s.id === val);
            if (sup && sup.supplementDetails?.recommendedDose) {
                setDose(sup.supplementDetails.recommendedDose);
            } else {
                setDose('1 portion');
            }
            if (sup && sup.supplementDetails?.timing) {
                setTiming(sup.supplementDetails.timing);
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-end bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="text-3xl">💊</span>
                        Mitt Protokoll
                    </h2>
                    <p className="text-slate-400 mt-2 max-w-xl">
                        Hantera ditt dagliga intag av kosttillskott. Bygg upp ditt protokoll för att säkerställa att du får i dig rätt tillskott vid rätt tidpunkt för optimal effekt.
                    </p>
                </div>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    {isEditing ? 'Klar' : 'Redigera Protokoll'}
                </button>
            </header>

            {isEditing && (
                <div className="bg-slate-800/40 border border-emerald-500/30 p-6 rounded-3xl mb-8 space-y-4">
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                        <span>➕</span> Lägg till tillskott i protokoll
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2 relative">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tillskott</label>
                            
                            <div 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm cursor-pointer flex justify-between items-center hover:border-emerald-500/50 transition-colors"
                            >
                                {selectedFoodId ? (
                                    selectedFoodId.startsWith('recipe:') 
                                        ? <span className="flex items-center gap-2"><span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Recept</span> <span className="truncate max-w-[150px] sm:max-w-xs">{recipes.find(r => r.id === selectedFoodId.replace('recipe:', ''))?.name}</span></span>
                                        : (() => {
                                            const item = eligibleItems.find(i => i.id === selectedFoodId);
                                            if (!item) return "Okänd";
                                            return <span className="flex items-center gap-2">
                                                {item.category === 'supplements' ? <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Tillskott</span> : <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Protein</span>}
                                                <span className="truncate max-w-[150px] sm:max-w-xs">{item.name}</span>
                                            </span>;
                                        })()
                                ) : (
                                    <span className="text-slate-500">Välj från databasen...</span>
                                )}
                                <span className={`text-slate-500 text-xs transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                            </div>

                            {isDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                    <div className="absolute top-[72px] left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 py-1">💊 Kosttillskott & Protein</div>
                                        {eligibleItems.map(item => {
                                            const inProtocol = protocol.some(p => p.foodItemId === item.id && !p.isRecipe);
                                            return (
                                                <div 
                                                    key={item.id}
                                                    onClick={() => handleSelectChange(item.id)}
                                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedFoodId === item.id ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-200'}`}
                                                >
                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                        {item.category === 'supplements' ? <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded font-black uppercase tracking-widest shrink-0">Tillskott</span> : <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-black uppercase tracking-widest shrink-0">Protein</span>}
                                                        <span className="truncate">{item.name} {item.brand ? <span className="text-[9px] text-slate-500 ml-1">{item.brand}</span> : ''}</span>
                                                    </div>
                                                    {inProtocol && <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded">I protokoll ✓</span>}
                                                </div>
                                            );
                                        })}

                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 py-1 mt-2 border-t border-slate-700 pt-2">🍲 Recept (t.ex. Morgonshake)</div>
                                        {recipes.map(item => {
                                            const inProtocol = protocol.some(p => p.foodItemId === item.id && p.isRecipe);
                                            return (
                                                <div 
                                                    key={`recipe:${item.id}`}
                                                    onClick={() => handleSelectChange(`recipe:${item.id}`)}
                                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedFoodId === `recipe:${item.id}` ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-200'}`}
                                                >
                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded font-black uppercase tracking-widest shrink-0">Recept</span>
                                                        <span className="truncate">{item.name}</span>
                                                    </div>
                                                    {inProtocol && <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded">I protokoll ✓</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">När?</label>
                            <select
                                value={timing}
                                onChange={(e) => setTiming(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-emerald-500/50"
                            >
                                {timings.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <span>Dosering</span>
                                <div className="flex gap-1">
                                    <button onClick={() => setDose('0.5 portioner')} className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition-colors" title="0.5 portioner">0.5</button>
                                    <button onClick={() => setDose('1 portion')} className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition-colors" title="1 portion">1</button>
                                    <button onClick={() => setDose('2 portioner')} className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition-colors" title="2 portioner">2</button>
                                </div>
                            </label>
                            <input
                                type="text"
                                value={dose}
                                onChange={(e) => setDose(e.target.value)}
                                placeholder="t.ex. 5g eller 2 kapslar"
                                className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleAdd}
                                disabled={!selectedFoodId}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black uppercase tracking-widest text-xs py-3 rounded-xl transition-all"
                            >
                                Lägg till
                            </button>
                        </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-slate-700/50 flex justify-end">
                        <button 
                            onClick={() => navigate('/database?action=new&category=supplements')}
                            className="text-[10px] font-black text-slate-500 hover:text-emerald-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            <span>+</span> Hittar du inte ditt tillskott? Skapa nytt
                        </button>
                    </div>
                </div>
            )}

            {protocol.length === 0 ? (
                <div className="text-center p-12 bg-slate-900/30 rounded-3xl border border-dashed border-slate-700">
                    <span className="text-4xl block mb-4">📝</span>
                    <h3 className="text-lg font-black text-white mb-2">Ditt protokoll är tomt</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-6">
                        Börja med att klicka på "Redigera Protokoll" för att bygga upp ditt dagliga schema av kosttillskott.
                    </p>
                    <button 
                        onClick={() => navigate('/database?action=new&category=supplements')}
                        className="text-xs font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-purple-500/10 rounded-xl transition-colors"
                    >
                        <span>➕</span> Lägg till nytt tillskott i databasen
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {timings.filter(t => grouped[t]).map(time => (
                        <div key={time} className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                            <div className="bg-slate-800/50 px-6 py-4 border-b border-white/5">
                                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">{time}</h3>
                            </div>
                            <div className="p-4 space-y-3 flex-1">
                                {grouped[time].map((entry, idx) => {
                                    const isRecipe = entry.isRecipe;
                                    const entity = isRecipe ? recipes.find(r => r.id === entry.foodItemId) : foodItems.find(f => f.id === entry.foodItemId);
                                    if (!entity) return null;
                                    const realIndex = protocol.findIndex(p => p === entry);

                                    return (
                                        <div key={idx} className={`p-4 rounded-2xl border transition-all ${entry.isActive ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-900/50 border-slate-800 opacity-50'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {isRecipe && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Recept</span>}
                                                        <h4 className={`font-bold ${entry.isActive ? 'text-white' : 'text-slate-400'}`}>{entity.name}</h4>
                                                    </div>
                                                    {!isRecipe && <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{(entity as FoodItem).brand || 'Okänt märke'}</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isEditing && (
                                                        <button onClick={() => handleRemove(realIndex)} className="w-6 h-6 flex items-center justify-center bg-rose-500/20 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-colors text-xs">
                                                            ×
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleToggleActive(realIndex)} className={`w-8 h-5 rounded-full relative transition-colors ${entry.isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${entry.isActive ? 'translate-x-3' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="bg-slate-950 px-2 py-1 rounded text-xs font-mono text-emerald-400">
                                                    {entry.dose}
                                                </div>
                                                {!isRecipe && (entity as FoodItem).supplementDetails?.purpose && (
                                                    <div className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]" title={(entity as FoodItem).supplementDetails!.purpose}>
                                                        {(entity as FoodItem).supplementDetails!.purpose}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
