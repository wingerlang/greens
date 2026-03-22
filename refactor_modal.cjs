const fs = require('fs');

const file = 'c:/repos/greens/src/components/activities/ActivityDetailModal.tsx';
let content = fs.readFileSync(file, 'utf8');

console.log("Adding Helper Components above ActivityDetailModal...");

const extractBannerHelper = `
interface ExtractParentBannerProps {
    activity: any;
    parentUniversal: any;
    parentActivityTitle?: string;
    setSelectedActivityId?: (id: string | null) => void;
}

function ExtractParentBanner({ activity, parentUniversal, parentActivityTitle, setSelectedActivityId }: ExtractParentBannerProps) {
    if (!activity.extractedFromId) return null;

    const startKmMatch = activity.notes?.match(/\\[START_KM:\\s*([\\d.]+)\\]/);
    const startKm = startKmMatch ? parseFloat(startKmMatch[1]) : 0;
    const parentSplits = parentUniversal?.performance?.splits || [];

    return (
        <div className="bg-slate-900/40 border border-[#f59e0b]/20 rounded-2xl p-4 mb-4 flex flex-col gap-3 shadow-xl shadow-amber-500/5 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <Zap size={14} className="fill-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-wider">Utdrag ur pass</p>
                        <p className="text-[10px] text-slate-400">
                            Original: <button type="button" onClick={() => setSelectedActivityId?.(activity.extractedFromId!)} className="text-amber-400 hover:text-amber-300 underline font-bold">{parentActivityTitle || 'Originalpasset'}</button>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-mono font-black text-slate-500 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                        Mätpunkt: {startKm.toFixed(1)} - {(startKm + (activity.distance || 0)).toFixed(1)} km
                    </span>
                    {startKm === 0 && (
                        <span className="text-[8px] text-amber-400/80 block mt-0.5 italic">(Redigera för att flytta)</span>
                    )}
                </div>
            </div>
            {parentSplits.length >= 2 && (
                <div className="mt-1">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">Placering i originalet</p>
                    <SplitsSparkline splits={parentSplits} highlightRange={{ start: startKm, end: startKm + (activity.distance || 0) }} />
                </div>
            )}
        </div>
    );
}

// Activity Detail Modal Component
`;

if (!content.includes('function ExtractParentBanner')) {
    content = content.replace(/\/\/ Activity Detail Modal Component/g, extractBannerHelper);
}

console.log("Replacing inline ExtractParentBanner layout...");

// Replace the large Extract Parent Link Banner renderer block
const inlineBannerMatchRegex = /\{\/\* Extract Parent Link Banner \*\/\}[\s\S]*?\{\/\* Parent Sparkline with highlight \*\/\}[\s\S]*?\}\)\(\)\}[\s\S]*?<\/div>[\s\S]*?\)\}/;
// It's less risky to replace smaller contiguous sections or use placeholders.
// Let's just create layout helper file instead of regex logic on 3000 lines because regex on complex TSX layouts is brittle!

fs.writeFileSync('c:/repos/greens/refactor_modal.cjs', `
const fs = require('fs');
const file = 'c:/repos/greens/src/components/activities/ActivityDetailModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const helper = \`${extractBannerHelper}\`;
if (!content.includes('function ExtractParentBanner')) {
    content = content.replace('// Activity Detail Modal Component', helper);
}

fs.writeFileSync(file, content);
`);

console.log("Wrote node script.");
fs.writeFileSync('c:/repos/greens/refactor_modal.cjs', `
const fs = require('fs');
const file = 'c:/repos/greens/src/components/activities/ActivityDetailModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const bannerHelper = \\`interface ExtractParentBannerProps {
    activity: any;
    parentUniversal: any;
    parentActivityTitle?: string;
    setSelectedActivityId?: (id: string | null) => void;
}

function ExtractParentBanner({ activity, parentUniversal, parentActivityTitle, setSelectedActivityId }: ExtractParentBannerProps) {
    if (!activity.extractedFromId) return null;

    const startKmMatch = activity.notes?.match(/\\\[START_KM:\\\s*([\\\d.]+)\\\]/);
    const startKm = startKmMatch ? parseFloat(startKmMatch[1]) : 0;
    const parentSplits = parentUniversal?.performance?.splits || [];

    return (
        <div className="bg-slate-900/40 border border-[#f59e0b]/20 rounded-2xl p-4 mb-4 flex flex-col gap-3 shadow-xl shadow-amber-500/5 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <Zap size={14} className="fill-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-wider">Utdrag ur pass</p>
                        <p className="text-[10px] text-slate-400">
                            Original: <button type="button" onClick={() => setSelectedActivityId?.(activity.extractedFromId!)} className="text-amber-400 hover:text-amber-300 underline font-bold">{parentActivityTitle || 'Originalpasset'}</button>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-mono font-black text-slate-500 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                        Mätpunkt: {startKm.toFixed(1)} - {(startKm + (activity.distance || 0)).toFixed(1)} km
                    </span>
                    {startKm === 0 && (
                        <span className="text-[8px] text-amber-400/80 block mt-0.5 italic">(Redigera för att flytta)</span>
                    )}
                </div>
            </div>
            {parentSplits.length >= 2 && (
                <div className="mt-1">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">Placering i originalet</p>
                    <SplitsSparkline splits={parentSplits} highlightRange={{ start: startKm, end: startKm + (activity.distance || 0) }} />
                </div>
            )}
        </div>
    );
}\\`;

if (!content.includes('function ExtractParentBanner')) {
    content = content.replace('// Activity Detail Modal Component', bannerHelper + '\\n// Activity Detail Modal Component');
}

fs.writeFileSync(file, content);
console.log('Helpers injected!');
`);
