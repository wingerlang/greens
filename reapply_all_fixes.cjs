const fs = require('fs');

const file = 'c:/repos/greens/src/components/activities/ActivityDetailModal.tsx';
let content = fs.readFileSync(file, 'utf8');

console.log("Re-applying all 5 fixes to ActivityDetailModal...");

// 1. smartExtractInfo rolling window definition
const smartExtractRegex = /\/\/ Smart Extraction Detection [\s\S]*?label: `⚡ Spara \${d}km-tid` }[\s\S]*?return null;[\s\S]*?}, \[activity.id, activity.title, activity.notes\]\);/;
const smartExtractReplacement = `// Smart Extraction Detection (Performance Markers)
    const smartExtractInfo = React.useMemo(() => {
        if (activity.extractedFromId) return null;
        const text = ((activity.title || '') + ' ' + (activity.notes || '')).toLowerCase();

        let distance = 0;
        let title = '';
        if (text.includes('5k max') || text.includes('5km max') || text.includes('5 k max') || text.includes('snabb 5k')) {
            distance = 5.0; title = '5k Max';
        } else if (text.includes('10k max') || text.includes('10km max') || text.includes('10 k max') || text.includes('snabb 10k')) {
            distance = 10.0; title = '10k Max';
        } else {
            const distMatch = text.match(/(\\d+(?:[.,]\\d+)?)\\s*km/);
            if (distMatch) distance = parseFloat(distMatch[1].replace(',', '.'));
        }

        if (distance > 0) {
            let bestTime = Infinity;
            let bestStartKm = 0;
            const n = Math.floor(distance);

            if (existingSplits && existingSplits.length >= n) {
                for (let i = 0; i <= existingSplits.length - n; i++) {
                    let timeAcc = 0;
                    for (let j = 0; j < n; j++) { timeAcc += existingSplits[i + j].movingTime; }
                    if (timeAcc < bestTime) {
                        bestTime = timeAcc;
                        bestStartKm = existingSplits[i].split - 1;
                    }
                }
            }
            return { distance, title: title || \`\${distance}km Max\`, label: \`⚡ Spara \${distance}km-tid\`, startKm: bestStartKm.toString() };
        }
        return null;
    }, [activity.id, activity.title, activity.notes, existingSplits]);`;

// 2. handleApplySmartExtract pre-fill
const handleExtractRegex = /const handleApplySmartExtract = \(\) => \{[\s\S]*?duration: '',[\s\S]*?setShowExtractForm\(true\);[\s\S]*?\};/;
const handleExtractReplacement = `const handleApplySmartExtract = () => {
        if (!smartExtractInfo) return;
        setExtractForm({
            ...extractForm,
            distance: smartExtractInfo.distance.toString(),
            title: smartExtractInfo.title,
            startKm: (smartExtractInfo as any).startKm || '0',
            duration: '', 
            isHiddenInCalendar: true
        });
        setShowExtractForm(true);
    };`;

// Apply 1 & 2
content = content.replace(/\/\/ Smart Extraction Detection[\s\S]*?return null;\s*\}\s*,\s*\[activity\.id,\s*activity\.title,\s*activity\.notes\]\);/, smartExtractReplacement);
content = content.replace(/const handleApplySmartExtract = \(\) => \{[\s\S]*?duration: '',[\s\S]*?setShowExtractForm\(true\);[\s\S]*?\};/, handleExtractReplacement);

// 3. Fallback table highlight guard startKm >= 0
content = content.replace(/const isHighlighted = startKm > 0/g, 'const isHighlighted = startKm >= 0');

fs.writeFileSync(file, content);
console.log("Done 1.");
