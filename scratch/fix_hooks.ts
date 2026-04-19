import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const patterns = [
    { from: /React\.(useState|useEffect|useMemo|useCallback|useRef)?\(/g, to: 'HOOK(' }, // Match broken and partially broken
];

const files = globSync('src/**/*.{ts,tsx}');

files.forEach(file => {
    let content = readFileSync(file, 'utf8');
    let changed = false;

    // This is hard because I lost the info of WHICH hook it was.
    // BUT, wait! I can look at the original files if I have them? No.
    // BUT! I can infer from usage.
    // Actually, I'll just use the fact that I know what hooks were in context files.

    if (file.includes('useActivityContext.ts')) {
        // ... this is too much work.
    }
});
