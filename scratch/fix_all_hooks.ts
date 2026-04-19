// Fix ALL corrupted hooks across the codebase
// 1. useActivityContext.ts: React.useMemo -> React.useCallback (except unifiedActivities which is a real useMemo)
// 2. ActivityDetailModal.tsx: React.React. -> React.

const files: Array<{path: string, fixes: Array<{from: string, to: string}>}> = [
    {
        path: 'src/context/features/useActivityContext.ts',
        fixes: [
            // Convert all React.useMemo back to React.useCallback
            // EXCEPT the real useMemo at line 514 (unifiedActivities)
            { from: 'React.useMemo(', to: 'React.useCallback(' },
        ]
    },
    {
        path: 'src/components/activities/ActivityDetailModal.tsx',
        fixes: [
            { from: 'React.React.', to: 'React.' },
        ]
    }
];

for (const file of files) {
    try {
        let content = Deno.readTextFileSync(file.path);
        let changeCount = 0;
        
        for (const fix of file.fixes) {
            const count = content.split(fix.from).length - 1;
            content = content.replaceAll(fix.from, fix.to);
            changeCount += count;
        }
        
        Deno.writeTextFileSync(file.path, content);
        console.log(`Fixed ${file.path}: ${changeCount} replacements`);
    } catch (e) {
        console.error(`Error processing ${file.path}: ${(e as Error).message}`);
    }
}

// Now fix the ONE real useMemo back in useActivityContext.ts
// The unifiedActivities computed value at line ~514
{
    const path = 'src/context/features/useActivityContext.ts';
    let content = Deno.readTextFileSync(path);
    
    // The unifiedActivities is the ONLY legitimate useMemo - it computes a derived value
    // It's characterized by: const unifiedActivities = React.useCallback(() => {
    content = content.replace(
        'const unifiedActivities = React.useCallback(() => {',
        'const unifiedActivities = React.useMemo(() => {'
    );
    
    Deno.writeTextFileSync(path, content);
    console.log('Restored unifiedActivities useMemo');
}

// Verify: count remaining issues
for (const check of [
    { path: 'src/context/features/useActivityContext.ts', pattern: 'React.useMemo(' },
    { path: 'src/components/activities/ActivityDetailModal.tsx', pattern: 'React.React.' },
    { path: 'src/context/DataContext.tsx', pattern: 'React.(' },
    { path: 'src/context/features/useUserContext.ts', pattern: 'React.(' },
]) {
    try {
        const content = Deno.readTextFileSync(check.path);
        const count = content.split(check.pattern).length - 1;
        if (count > 0) {
            console.log(`⚠️  ${check.path}: ${count} remaining "${check.pattern}"`);
        } else {
            console.log(`✅ ${check.path}: clean`);
        }
    } catch (e) {
        console.error(`Cannot read ${check.path}: ${(e as Error).message}`);
    }
}
