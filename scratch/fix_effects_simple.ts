const files = [
    'src/context/features/useUserContext.ts',
    'src/context/features/useActivityContext.ts'
];

for (const file of files) {
    try {
        const text = Deno.readTextFileSync(file);
        let newText = text;

        if (file.includes('useUserContext.ts')) {
            newText = newText.replace('React.useCallback(() => {\n        if (currentUser?.settings) {', 'React.useEffect(() => {\n        if (currentUser?.settings) {');
        }

        if (file.includes('useActivityContext.ts')) {
            newText = newText.replace('React.useMemo(() => {\n        if (!isLoaded) return;', 'React.useEffect(() => {\n        if (!isLoaded) return;');
            newText = newText.replace('React.useMemo(() => {\n        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;', 'React.useEffect(() => {\n        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;');
        }

        if (newText !== text) {
            Deno.writeTextFileSync(file, newText);
            console.log(`Fixed ${file}`);
        }
    } catch (e) {
        console.error(`Failed to process ${file}: ${e.message}`);
    }
}
