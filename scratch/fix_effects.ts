import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const files = globSync('src/context/**/*.{ts,tsx}');

files.forEach(file => {
    let content = readFileSync(file, 'utf8');
    let changed = false;

    // Use cases:
    // 1. React.useCallback(() => { ... }, [...]) -> Effect if used for startup
    // 2. React.useMemo(() => { ... }, [...]) -> Effect if it contains side effects like polling or storage calls
    // Actually, I'll just look for the specific lines I know are effects.

    if (file.includes('useUserContext.ts')) {
        content = content.replace('React.useCallback(() => {\n        if (currentUser?.settings) {', 'React.useEffect(() => {\n        if (currentUser?.settings) {');
        changed = true;
    }
    
    if (file.includes('useActivityContext.ts')) {
        // Pre-seed Race Data (70)
        content = content.replace('React.useMemo(() => {\n        if (!isLoaded) return;', 'React.useEffect(() => {\n        if (!isLoaded) return;');
        // Automatic Reconciliation (1418)
        content = content.replace('React.useMemo(() => {\n        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;', 'React.useEffect(() => {\n        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;');
        changed = true;
    }

    if (changed) {
        writeFileSync(file, content);
        console.log(`Fixed ${file}`);
    }
});
