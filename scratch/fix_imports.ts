// Fix React imports - ensure all context files that use React.xxx have React imported
const files = [
    'src/context/features/useUserContext.ts',
    'src/context/features/useBodyContext.ts',
    'src/context/features/useNutritionContext.ts',
    'src/context/features/useActivityContext.ts',
];

for (const file of files) {
    let content = Deno.readTextFileSync(file);
    
    // Check if it uses React.xxx pattern
    if (content.includes('React.use') || content.includes('React.create')) {
        // Check if it has "import React" already
        if (!content.match(/^import React/m)) {
            // Add "import React from 'react'" at the top, BEFORE the existing import
            // Replace the first line's import to include React default
            const firstImportMatch = content.match(/^import \{([^}]+)\} from ['"]react['"];?\s*$/m);
            if (firstImportMatch) {
                const namedImports = firstImportMatch[1];
                const oldLine = firstImportMatch[0];
                const newLine = `import React, {${namedImports}} from 'react';`;
                content = content.replace(oldLine, newLine);
                console.log(`${file}: Added React default import alongside named imports`);
            } else {
                // No existing react import - add one at the top
                content = `import React from 'react';\n${content}`;
                console.log(`${file}: Added React default import at top`);
            }
            Deno.writeTextFileSync(file, content);
        } else {
            console.log(`${file}: React import already present`);
        }
    } else {
        console.log(`${file}: No React.xxx usage found`);
    }
}
