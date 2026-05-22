import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import {
    type FoodItem,
    type FoodItemFormData,
    type Unit,
    type FoodCategory,
    type Season,
    CATEGORY_LABELS,
    UNIT_LABELS,
    getISODate,
    generateId,
} from '../../models/types.ts';
import { parseNutritionText, extractFromJSONLD, cleanProductName, extractBrand, extractPackagingWeight } from '../../utils/nutrition/index.ts';

const CATEGORY_GROUPS: Record<string, FoodCategory[]> = {
    'Grönt & Frukt': ['vegetables', 'fruits'],
    'Protein & Baljväxter': ['protein', 'legumes', 'dairy-alt', 'nuts-seeds', 'supplements', 'meal-replacement', 'protein-bar'],
    'Skafferi & Bas': ['grains', 'cereals', 'baking', 'spices', 'condiments', 'sauces', 'sweeteners', 'fats'],
    'Dryck': ['beverages'],
    'Godis & Snacks': ['candy'],
    'Övrigt': ['other']
};

const EMPTY_FORM: FoodItemFormData = {
    name: '',
    brand: '',
    imageUrl: '',
    packageWeight: 0,
    defaultPortionGrams: 0,
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    unit: 'g',
    category: 'other',
    storageType: 'pantry',
    pricePerUnit: 0,
    co2PerUnit: 0,
    containsGluten: false,
    iron: 0,
    calcium: 0,
    zinc: 0,
    vitaminB12: 0,
    isCompleteProtein: false,
    missingAminoAcids: [],
    complementaryCategories: [],
    proteinCategory: undefined,
    seasons: [],
    ingredients: '',
};

const getImgSrc = (url: string) => {
    if (!url) return '';
    if (url.startsWith('uploads/')) return `/${url}`;
    return url;
};

const MacroInput: React.FC<{ label: string, value: number, onChange: (v: number) => void, suffix: string, step?: number }> = ({ label, value, onChange, suffix, step = 1 }) => (
    <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</label>
        <div className="relative">
            <input
                type="number"
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-right pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">{suffix}</span>
        </div>
    </div>
);

interface FoodItemFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingItem: FoodItem | null;
    initialCategory?: FoodCategory;
}

export function FoodItemFormModal({ isOpen, onClose, editingItem, initialCategory }: FoodItemFormModalProps) {
    const { foodItems, foodAliases, addFoodItem, updateFoodItem, updateFoodAlias, addPurchaseLog } = useData();

    // Form State
    const [formData, setFormData] = useState<FoodItemFormData>(EMPTY_FORM);
    const [alias, setAlias] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [inputMode, setInputMode] = useState<'per100g' | 'perPortion'>('per100g');
    const [portionValues, setPortionValues] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        caffeine: 0,
        alcohol: 0
    });
    const [isDragging, setIsDragging] = useState(false);
    const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
    const [purchaseDate, setPurchaseDate] = useState(getISODate());
    const [registerPurchase, setRegisterPurchase] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (editingItem) {
            setAlias(foodAliases[editingItem.id] || '');
            setFormData({
                name: editingItem.name,
                brand: editingItem.brand || '',
                imageUrl: editingItem.imageUrl || '',
                packageWeight: editingItem.packageWeight || 0,
                defaultPortionGrams: editingItem.defaultPortionGrams || 0,
                description: editingItem.description || '',
                calories: editingItem.calories,
                protein: editingItem.protein,
                carbs: editingItem.carbs,
                fat: editingItem.fat,
                fiber: editingItem.fiber || 0,
                unit: editingItem.unit,
                category: editingItem.category,
                storageType: editingItem.storageType || 'pantry',
                pricePerUnit: editingItem.pricePerUnit || 0,
                co2PerUnit: editingItem.co2PerUnit || 0,
                containsGluten: editingItem.containsGluten || false,
                iron: editingItem.iron || 0,
                calcium: editingItem.calcium || 0,
                zinc: editingItem.zinc || 0,
                vitaminB12: editingItem.vitaminB12 || 0,
                isCompleteProtein: editingItem.isCompleteProtein || false,
                missingAminoAcids: editingItem.missingAminoAcids || [],
                complementaryCategories: editingItem.complementaryCategories || [],
                proteinCategory: editingItem.proteinCategory,
                seasons: editingItem.seasons || [],
                ingredients: editingItem.ingredients || '',
                aliases: editingItem.aliases || [],
                lastPurchasedPrice: editingItem.lastPurchasedPrice,
                lastPurchasedDate: editingItem.lastPurchasedDate,
                commonPackageSizes: editingItem.commonPackageSizes || [],
                extendedDetails: {
                    ...editingItem.extendedDetails,
                    caffeine: editingItem.extendedDetails?.caffeine || 0,
                    alcohol: editingItem.extendedDetails?.alcohol || 0
                },
                supplementDetails: editingItem.supplementDetails || undefined
            });
            const portion = editingItem.defaultPortionGrams || 100;
            setPortionValues({
                calories: Number(((editingItem.calories * portion) / 100).toFixed(2)),
                protein: Number(((editingItem.protein * portion) / 100).toFixed(2)),
                carbs: Number(((editingItem.carbs * portion) / 100).toFixed(2)),
                fat: Number(((editingItem.fat * portion) / 100).toFixed(2)),
                fiber: Number((((editingItem.fiber || 0) * portion) / 100).toFixed(2)),
                caffeine: Number((((editingItem.extendedDetails?.caffeine || 0) * portion) / 100).toFixed(2)),
                alcohol: Number((((editingItem.extendedDetails?.alcohol || 0) * portion) / 100).toFixed(2))
            });
            setInputMode('per100g');
            setPurchasePrice(editingItem.lastPurchasedPrice || '');
            setPurchaseDate(getISODate());
            setRegisterPurchase(false);
            setParseError(null);
        } else {
            setFormData({
                ...EMPTY_FORM,
                category: initialCategory || 'other'
            });
            setPurchasePrice('');
            setPurchaseDate(getISODate());
            setRegisterPurchase(false);
            setParseError(null);
        }
    }, [isOpen, editingItem, foodAliases]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalFormData = {
            ...formData,
            aliases: alias.split(',').map(s => s.trim()).filter(Boolean)
        };

        // If registering a purchase, update latest price/date
        if (registerPurchase && purchasePrice !== '') {
            finalFormData.lastPurchasedPrice = Number(purchasePrice);
            finalFormData.lastPurchasedDate = purchaseDate;
        }

        if (editingItem) {
            updateFoodItem(editingItem.id, finalFormData);
            if (alias !== (foodAliases[editingItem.id] || '')) {
                updateFoodAlias(editingItem.id, alias);
            }
            
            // Add to purchase log if requested
            if (registerPurchase && purchasePrice !== '') {
                addPurchaseLog({
                    id: generateId(),
                    foodItemId: editingItem.id,
                    date: purchaseDate,
                    price: Number(purchasePrice),
                    quantity: 1,
                    packageSize: formData.packageWeight || 0,
                    unit: formData.unit
                });
            }
        } else {
            const newItem = addFoodItem(finalFormData);
            if (registerPurchase && purchasePrice !== '' && newItem) {
                addPurchaseLog({
                    id: generateId(),
                    foodItemId: newItem.id,
                    date: purchaseDate,
                    price: Number(purchasePrice),
                    quantity: 1,
                    packageSize: formData.packageWeight || 0,
                    unit: formData.unit
                });
            }
        }
        onClose();
    };

    const updatePricePerUnit = (price: number | '', weight: number) => {
        if (price !== '' && price > 0 && weight > 0) {
            const pUnit = (price / (weight / 1000));
            setFormData(prev => ({ ...prev, pricePerUnit: Math.round(pUnit * 10) / 10 }));
        }
    };

    const updateNutrition = (field: keyof typeof portionValues, value: number) => {
        const portionGrams = formData.defaultPortionGrams || 100;
        if (inputMode === 'per100g') {
            if (field === 'caffeine' || field === 'alcohol') {
                setFormData(prev => ({
                    ...prev,
                    extendedDetails: { ...prev.extendedDetails, [field]: value }
                }));
            } else {
                setFormData(prev => ({ ...prev, [field]: value }));
            }
            setPortionValues(prev => ({ ...prev, [field]: Number(((value * portionGrams) / 100).toFixed(2)) }));
        } else {
            setPortionValues(prev => ({ ...prev, [field]: value }));
            const val100g = Number(((value / portionGrams) * 100).toFixed(2));
            if (field === 'caffeine' || field === 'alcohol') {
                setFormData(prev => ({
                    ...prev,
                    extendedDetails: { ...prev.extendedDetails, [field]: val100g }
                }));
            } else {
                setFormData(prev => ({ ...prev, [field]: val100g }));
            }
        }
    };

    const handlePortionGramsChange = (newGrams: number) => {
        setFormData(prev => {
            const updated = { ...prev, defaultPortionGrams: newGrams };
            if (inputMode === 'perPortion') {
                const ratio = newGrams > 0 ? 100 / newGrams : 0;
                updated.calories = Number((portionValues.calories * ratio).toFixed(2));
                updated.protein = Number((portionValues.protein * ratio).toFixed(2));
                updated.carbs = Number((portionValues.carbs * ratio).toFixed(2));
                updated.fat = Number((portionValues.fat * ratio).toFixed(2));
                updated.fiber = Number((portionValues.fiber * ratio).toFixed(2));
                updated.extendedDetails = {
                    ...updated.extendedDetails,
                    caffeine: Number((portionValues.caffeine * ratio).toFixed(2)),
                    alcohol: Number((portionValues.alcohol * ratio).toFixed(2))
                };
            } else {
                setPortionValues({
                    calories: Number(((prev.calories * newGrams) / 100).toFixed(2)),
                    protein: Number(((prev.protein * newGrams) / 100).toFixed(2)),
                    carbs: Number(((prev.carbs * newGrams) / 100).toFixed(2)),
                    fat: Number(((prev.fat * newGrams) / 100).toFixed(2)),
                    fiber: Number(((prev.fiber || 0) * newGrams / 100).toFixed(2)),
                    caffeine: Number(((prev.extendedDetails?.caffeine || 0) * newGrams / 100).toFixed(2)),
                    alcohol: Number(((prev.extendedDetails?.alcohol || 0) * newGrams / 100).toFixed(2))
                });
            }
            return updated;
        });
    };

    const applyParsedData = (parsed: any) => {
        const knownBrands = Array.from(new Set(foodItems.map(f => f.brand).filter(Boolean))) as string[];
        let brand = parsed.brand || extractBrand(parsed.text || '', knownBrands);

        if (brand) {
            brand = brand.replace(/\b(nuvarande|ordinarie|jmf|kampanj|medlems)\s*pris.*$/i, '').trim();
            brand = brand.replace(/\bpris\s*[:\d].*$/i, '').trim();
            brand = brand.replace(/produktinformation.*$/i, '').trim();
            brand = brand.replace(/product\s*information.*$/i, '').trim();
        }

        const packageWeight = parsed.packageWeight || extractPackagingWeight(parsed.text || '');

        setFormData(prev => ({
            ...prev,
            name: parsed.name || prev.name,
            brand: brand || prev.brand,
            packageWeight: packageWeight || prev.packageWeight,
            calories: parsed.calories !== undefined ? parsed.calories : prev.calories,
            protein: parsed.protein !== undefined ? parsed.protein : prev.protein,
            carbs: parsed.carbs !== undefined ? parsed.carbs : prev.carbs,
            fat: parsed.fat !== undefined ? parsed.fat : prev.fat,
            fiber: parsed.fiber !== undefined ? parsed.fiber : prev.fiber,
            ingredients: parsed.ingredients || prev.ingredients,
            defaultPortionGrams: parsed.defaultPortionGrams !== undefined ? parsed.defaultPortionGrams : prev.defaultPortionGrams,
        }));
    };

    const handleTextPaste = async (text: string) => {
        if (!text) return;
        setParseError(null);
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) {
            const url = urlMatch[1];
            setIsParsing(true);
            try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('/api/parse-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ url })
                });
                if (!res.ok) throw new Error('Kunde inte hämta sidan. Kontrollera URL:en.');
                const data = await res.json();
                let results = extractFromJSONLD(data.jsonLds || []);
                const textResults = parseNutritionText(data.text);
                const finalResults = {
                    ...results,
                    calories: results.calories ?? textResults.calories,
                    protein: results.protein ?? textResults.protein,
                    carbs: results.carbs ?? textResults.carbs,
                    fat: results.fat ?? textResults.fat,
                    fiber: results.fiber ?? textResults.fiber,
                    name: cleanProductName(data.title, data.h1) || results.name || textResults.name,
                    text: data.text
                };
                applyParsedData(finalResults);
            } catch (err) {
                setParseError(err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning.');
            } finally {
                setIsParsing(false);
            }
            return;
        }
        const parsed = parseNutritionText(text);
        applyParsedData({ ...parsed, text });
    };

    const handleImageUpload = async (file: File) => {
        setIsParsing(true);
        setParseError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('auth_token');
            const uploadRes = await fetch('/api/upload-temp', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });
            if (!uploadRes.ok) throw new Error('Uppladdning misslyckades');
            const { tempUrl } = await uploadRes.json();
            setFormData(prev => ({ ...prev, imageUrl: tempUrl }));
            const parseRes = await fetch('/api/parse-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ tempUrl })
            });
            if (!parseRes.ok) throw new Error('OCR-analys misslyckades');
            const { text, parsed } = await parseRes.json();
            applyParsedData({ ...parsed, text });
        } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Kunde inte läsa bilden.');
        } finally {
            setIsParsing(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                handleImageUpload(file);
                return;
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                handleImageUpload(file);
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleSubmit(e as any);
                }
            }}
        >
            <div
                className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white">
                                {editingItem ? '✏️ Redigera Råvara' : '➕ Lägg till Råvara'}
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono">ESC</kbd> stäng • <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono">Ctrl+S</kbd> spara
                            </p>
                        </div>
                        <div className="h-8 w-[1px] bg-slate-800 hidden md:block" />
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showAdvanced ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                        >
                            <span>{showAdvanced ? '✨' : '⚙️'}</span>
                            {showAdvanced ? 'Visa Mindre' : 'Visa Allt'}
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors text-xl"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Basic Info & Macros */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Namn *
                                    </label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="t.ex. Kikärtor, Havregryn..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Märke
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.brand || ''}
                                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                            placeholder="t.ex. Zeta"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Alias (kommaseparerat)
                                        </label>
                                        <input
                                            type="text"
                                            value={alias}
                                            onChange={(e) => setAlias(e.target.value)}
                                            placeholder="eg. sojaprotein, mifu..."
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Kategori
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value as FoodCategory })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                        >
                                            {Object.entries(CATEGORY_GROUPS).map(([group, keys]) => (
                                                <optgroup key={group} label={group}>
                                                    {keys.map(key => (
                                                        <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Macros Section */}
                            <div className="bg-slate-800/40 rounded-2xl p-5 border border-slate-700/50">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                        <span>📊</span> Näringsvärden
                                    </h3>
                                    <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700 text-[10px] font-black uppercase tracking-tighter">
                                        <button
                                            type="button"
                                            onClick={() => setInputMode('per100g')}
                                            className={`px-2 py-1 rounded transition-all ${inputMode === 'per100g' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            100g
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInputMode('perPortion')}
                                            className={`px-2 py-1 rounded transition-all ${inputMode === 'perPortion' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Portion
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <MacroInput
                                        label="Kalorier"
                                        value={inputMode === 'per100g' ? formData.calories : portionValues.calories}
                                        onChange={v => updateNutrition('calories', v)}
                                        suffix="kcal"
                                    />
                                    <MacroInput
                                        label="Protein"
                                        value={inputMode === 'per100g' ? formData.protein : portionValues.protein}
                                        onChange={v => updateNutrition('protein', v)}
                                        suffix="g"
                                        step={0.1}
                                    />
                                    <MacroInput
                                        label="Kolhydrater"
                                        value={inputMode === 'per100g' ? formData.carbs : portionValues.carbs}
                                        onChange={v => updateNutrition('carbs', v)}
                                        suffix="g"
                                        step={0.1}
                                    />
                                    <MacroInput
                                        label="Fett"
                                        value={inputMode === 'per100g' ? formData.fat : portionValues.fat}
                                        onChange={v => updateNutrition('fat', v)}
                                        suffix="g"
                                        step={0.1}
                                    />
                                    {showAdvanced && (
                                        <>
                                            <MacroInput
                                                label="Fiber"
                                                value={inputMode === 'per100g' ? (formData.fiber || 0) : portionValues.fiber}
                                                onChange={v => updateNutrition('fiber', v)}
                                                suffix="g"
                                                step={0.1}
                                            />
                                            <MacroInput
                                                label="Koffein"
                                                value={inputMode === 'per100g' ? (formData.extendedDetails?.caffeine || 0) : portionValues.caffeine}
                                                onChange={v => updateNutrition('caffeine', v)}
                                                suffix="mg"
                                            />
                                            <MacroInput
                                                label="Alkohol"
                                                value={inputMode === 'per100g' ? (formData.extendedDetails?.alcohol || 0) : portionValues.alcohol}
                                                onChange={v => updateNutrition('alcohol', v)}
                                                suffix="e"
                                                step={0.1}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Micronutrients (Advanced Only) */}
                            {showAdvanced && (
                                <div className="bg-blue-500/5 rounded-2xl p-5 border border-blue-500/10">
                                    <h3 className="text-sm font-bold text-blue-400 mb-6 flex items-center gap-2">
                                        <span>🧪</span> Mikronutrienter
                                    </h3>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <MacroInput label="Järn" value={formData.iron || 0} onChange={v => setFormData({ ...formData, iron: v })} suffix="mg" step={0.01} />
                                        <MacroInput label="Zink" value={formData.zinc || 0} onChange={v => setFormData({ ...formData, zinc: v })} suffix="mg" step={0.1} />
                                        <MacroInput label="Kalcium" value={formData.calcium || 0} onChange={v => setFormData({ ...formData, calcium: v })} suffix="mg" />
                                        <MacroInput label="B12" value={formData.vitaminB12 || 0} onChange={v => setFormData({ ...formData, vitaminB12: v })} suffix="µg" step={0.1} />
                                    </div>
                                </div>
                            )}

                            {/* Protein Analysis (Advanced Only) */}
                            {showAdvanced && formData.protein > 5 && (
                                <div className="bg-amber-500/5 rounded-2xl p-5 border border-amber-500/10">
                                    <h3 className="text-sm font-bold text-amber-400 mb-6 flex items-center gap-2">
                                        <span>🧬</span> Protein-analys
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Fullvärdigt protein</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isCompleteProtein: !formData.isCompleteProtein })}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isCompleteProtein ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.isCompleteProtein ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Proteinkategori</label>
                                            <select
                                                value={formData.proteinCategory || ''}
                                                onChange={(e) => setFormData({ ...formData, proteinCategory: e.target.value as any })}
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white"
                                            >
                                                <option value="">Välj...</option>
                                                <option value="animal">Animaliskt</option>
                                                <option value="pulse">Baljväxt (Lysin-rik)</option>
                                                <option value="grain">Spannmål (Methionin-rik)</option>
                                                <option value="nut-seed">Nöt/Frö</option>
                                                <option value="mixed">Blandat</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Parser, Images & Details */}
                        <div className="space-y-6">
                            {/* Smart Parser */}
                            <div
                                className={`bg-emerald-500/5 rounded-2xl p-5 border relative overflow-hidden transition-all ${isDragging ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-500/10'}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm">✨</span>
                                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Smart Tolkare</span>
                                    {isParsing && (
                                        <div className="flex items-center gap-2 ml-auto">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] text-emerald-500">Analyserar...</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1 relative">
                                        <textarea
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 min-h-[100px] resize-none"
                                            placeholder="Klistra in innehållsförteckning, näringsvärden eller en länk..."
                                            onChange={(e) => handleTextPaste(e.target.value)}
                                            onPaste={handlePaste}
                                        />
                                        <div className="absolute right-3 bottom-3 flex gap-2">
                                            <input type="file" id="img-upload" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                                            <label htmlFor="img-upload" className="cursor-pointer p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors">📷</label>
                                        </div>
                                    </div>
                                    {formData.imageUrl && (
                                        <div className="w-24 h-24 shrink-0 bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden relative group">
                                            <img src={getImgSrc(formData.imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, imageUrl: '' }))} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold">Ta bort</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Portions & Unit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Standardportion</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.defaultPortionGrams || ''}
                                            onChange={e => handlePortionGramsChange(Number(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                            placeholder="t.ex. 35"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">G</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Mätenhet</label>
                                    <select
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value as Unit })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                    >
                                        {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description / Ingredients */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ingredienser</label>
                                    <textarea
                                        value={formData.ingredients || ''}
                                        onChange={e => setFormData({ ...formData, ingredients: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white min-h-[80px]"
                                        placeholder="Vad innehåller produkten?"
                                    />
                                </div>
                                {showAdvanced && (
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Beskrivning</label>
                                        <textarea
                                            value={formData.description || ''}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white min-h-[60px]"
                                            placeholder="Extra personliga anteckningar..."
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Supplement Details */}
                            {formData.category === 'supplements' && (
                                <div className="bg-purple-500/5 rounded-2xl p-5 border border-purple-500/10 space-y-4">
                                    <h3 className="text-xs font-bold text-purple-400 flex items-center gap-2">
                                        <span>💊</span> Kosttillskott
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Syfte</label>
                                            <input
                                                type="text"
                                                value={formData.supplementDetails?.purpose || ''}
                                                onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, purpose: e.target.value } })}
                                                placeholder="t.ex. Återhämtning, Prestation"
                                                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Effekt</label>
                                                <input
                                                    type="text"
                                                    value={formData.supplementDetails?.effect || ''}
                                                    onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, effect: e.target.value } })}
                                                    placeholder="t.ex. Ökar explosivitet"
                                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">När ska det tas?</label>
                                                <input
                                                    type="text"
                                                    value={formData.supplementDetails?.timing || ''}
                                                    onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, timing: e.target.value } })}
                                                    placeholder="t.ex. Innan träning"
                                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Form</label>
                                                <select
                                                    value={formData.supplementDetails?.form || 'powder'}
                                                    onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, form: e.target.value as any } })}
                                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm"
                                                >
                                                    <option value="powder">Pulver</option>
                                                    <option value="pill">Piller</option>
                                                    <option value="capsule">Kapsel</option>
                                                    <option value="liquid">Vätska</option>
                                                    <option value="gummy">Gummy</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Rekommenderad dos</label>
                                                <input
                                                    type="text"
                                                    value={formData.supplementDetails?.recommendedDose || ''}
                                                    onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, recommendedDose: e.target.value } })}
                                                    placeholder="t.ex. 2 kapslar"
                                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Aktiva ämnen</label>
                                            <input
                                                type="text"
                                                value={formData.supplementDetails?.activeIngredients || ''}
                                                onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, activeIngredients: e.target.value } })}
                                                placeholder="t.ex. 5g Kreatin Monohydrat"
                                                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Varning / Kontraindikationer</label>
                                            <input
                                                type="text"
                                                value={formData.supplementDetails?.contraindications || ''}
                                                onChange={e => setFormData({ ...formData, supplementDetails: { ...formData.supplementDetails, contraindications: e.target.value } })}
                                                placeholder="t.ex. Ta inte tillsammans med kaffe"
                                                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm text-amber-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Environmental & Price */}
                            <div className="bg-slate-800/40 rounded-2xl p-5 border border-slate-700/50 space-y-4">
                                <h3 className="text-xs font-bold text-blue-400 flex items-center gap-2">
                                    <span>💰</span> Pris & Förpackning
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Inköpspris</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={purchasePrice}
                                                    placeholder="t.ex. 25.90"
                                                    onChange={(e) => {
                                                        const price = e.target.value === '' ? '' : Number(e.target.value);
                                                        setPurchasePrice(price);
                                                        updatePricePerUnit(price, formData.packageWeight || 0);
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">KR</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={registerPurchase}
                                                        onChange={e => setRegisterPurchase(e.target.checked)}
                                                        className="peer sr-only"
                                                    />
                                                    <div className="w-10 h-5 bg-slate-800 rounded-full border border-slate-700 peer-checked:bg-blue-500 peer-checked:border-blue-400 transition-all shadow-inner" />
                                                    <div className="absolute left-1 top-1 w-3 h-3 bg-slate-500 rounded-full peer-checked:translate-x-5 peer-checked:bg-white transition-transform" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">Logga Inköp</span>
                                            </label>

                                            {registerPurchase && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <input
                                                        type="date"
                                                        value={purchaseDate}
                                                        onChange={e => setPurchaseDate(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Förpackning</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={formData.packageWeight || ''}
                                                onChange={(e) => {
                                                    const weight = Number(e.target.value);
                                                    setFormData(prev => ({ ...prev, packageWeight: weight }));
                                                    updatePricePerUnit(purchasePrice, weight);
                                                }}
                                                placeholder="t.ex. 400"
                                                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">{formData.unit}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Andra vanliga storlekar (t.ex. 400, 800)</label>
                                    <input
                                        type="text"
                                        value={(formData.commonPackageSizes || []).join(', ')}
                                        onChange={(e) => {
                                            const sizes = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            setFormData(prev => ({ ...prev, commonPackageSizes: sizes }));
                                        }}
                                        placeholder="t.ex. 450, 900"
                                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Målpris (Jmf-pris)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.pricePerUnit || 0}
                                            onChange={v => setFormData({ ...formData, pricePerUnit: Number(v.target.value) })}
                                            className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-blue-400 font-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 pr-16"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">KR/KG</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-2 italic px-1">
                                        Detta pris används för att beräkna kostnad för recept och snacks. {formData.lastPurchasedPrice && `Senast loggade pris: ${formData.lastPurchasedPrice}kr (${formData.lastPurchasedDate})`}
                                    </p>
                                </div>

                                {showAdvanced && (
                                    <div className="pt-2 border-t border-slate-800/50">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">CO2 Avtryck</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={formData.co2PerUnit || 0}
                                                onChange={v => setFormData({ ...formData, co2PerUnit: Number(v.target.value) })}
                                                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">KG CO2/KG</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Seasons (Advanced Only) */}
                            {showAdvanced && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">I säsong</label>
                                    <div className="flex flex-wrap gap-2">
                                        {
                                            [
                                                { id: 'spring', label: 'Vår' },
                                                { id: 'summer', label: 'Sommar' },
                                                { id: 'autumn', label: 'Höst' },
                                                { id: 'winter', label: 'Vinter' }
                                            ].map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const seasons = formData.seasons || [];
                                                        setFormData({ ...formData, seasons: seasons.includes(s.id as Season) ? seasons.filter(x => x !== s.id) : [...seasons, s.id as Season] });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${formData.seasons?.includes(s.id as Season) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                                                >
                                                    {s.label}
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sticky Footer */}
                    <div className="flex gap-4 pt-8 mt-8 border-t border-slate-800 sticky bottom-0 bg-slate-900 pb-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                        >
                            {editingItem ? 'Spara Ändringar' : 'Lägg till i databas'}
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
}

export default FoodItemFormModal;
