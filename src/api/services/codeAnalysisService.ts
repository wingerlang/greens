
/// <reference lib="deno.ns" />
import { join } from "node:path";

export interface GitStats {
    topChurnFiles: { file: string; changes: number }[];
    newFilesHistory: { date: string; count: number }[];
}

export interface ComplexityStats {
    mostComplexFiles: { file: string; maxDepth: number }[];
    averageDepth: number;
}

export interface ProjectStats {
    totalFiles: number;
    totalLines: number;
    filesByExtension: Record<string, number>;
    linesByExtension: Record<string, number>;
    gitStats?: GitStats;
    complexityStats?: ComplexityStats;
    dependencyCount?: number;
    excludedRules?: string[];
}

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size?: number;
    lines?: number;
    children?: FileNode[];
    fileCount?: number;
}

export interface CodeIssue {
    type: 'duplicate_file' | 'similar_name' | 'large_file' | 'long_function' | 'many_services';
    severity: 'low' | 'medium' | 'high';
    message: string;
    file: string;
    relatedFile?: string;
    details?: string;
}

export interface FunctionInfo {
    name: string;
    file: string;
    line: number;
}

export interface DuplicateFunction {
    nameA: string;
    nameB: string;
    fileA: string;
    fileB: string;
    similarity: number;
}

export interface SimilarFilePair {
    fileA: string;
    fileB: string;
    similarity: number; // 0-1
    sharedTerms: string[];
}

export interface SearchResult {
    file: string;
    matches: { line: number, content: string }[];
}

const DEFAULT_EXCLUDES = [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '.vscode', '.idea', '.deno', 'artifacts', 'debug', 'npm:'
];

export class CodeAnalysisService {
    private rootDir: string;

    constructor(rootDir: string = "./src") {
        this.rootDir = rootDir;
    }

    async getDocumentationFiles(): Promise<{ name: string, path: string, content: string }[]> {
        const files: { name: string, path: string, content: string }[] = [];
        const docs = ['BUGS.MD', 'TODO.md', 'AGENT_MANIFEST.md', 'ARCHITECTURE.md', 'README.md', 'CONTRIBUTING.md', 'REFACTORING_PLAN.md'];

        for (const doc of docs) {
            try {
                // Check root directory (./)
                const path = `./${doc}`;
                const content = await Deno.readTextFile(path);
                files.push({ name: doc, path, content });
            } catch (e) {
                // Ignore missing files
            }
        }
        return files;
    }

    private isExcluded(path: string, userExcludes: string[]): boolean {
        // Normalize path
        const normalized = path.replace(/^\.\//, '');
        // Check default excludes
        if (DEFAULT_EXCLUDES.some(ex => normalized.includes(ex) || normalized.split('/').includes(ex))) return true;
        // Check user excludes
        if (userExcludes.some(ex => normalized.includes(ex))) return true;
        return false;
    }

    async getProjectStats(excludedPaths: string[] = []): Promise<ProjectStats> {
        const stats: ProjectStats = {
            totalFiles: 0,
            totalLines: 0,
            filesByExtension: {},
            linesByExtension: {},
            complexityStats: { mostComplexFiles: [], averageDepth: 0 },
            dependencyCount: 0,
            excludedRules: excludedPaths
        };

        const complexityData: { file: string, maxDepth: number }[] = [];
        await this.walkAndCount(this.rootDir, stats, excludedPaths, complexityData);

        if (complexityData.length > 0) {
            stats.complexityStats = {
                mostComplexFiles: complexityData.sort((a, b) => b.maxDepth - a.maxDepth).slice(0, 20),
                averageDepth: complexityData.reduce((acc, curr) => acc + curr.maxDepth, 0) / complexityData.length
            };
        }

        stats.gitStats = await this.getGitStats(excludedPaths);
        stats.dependencyCount = await this.getDependencyCount();

        return stats;
    }

    private async walkAndCount(path: string, stats: ProjectStats, excludedPaths: string[], complexityData: { file: string, maxDepth: number }[]) {
        try {
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;

                if (this.isExcluded(fullPath, excludedPaths)) continue;

                if (entry.isDirectory) {
                    await this.walkAndCount(fullPath, stats, excludedPaths, complexityData);
                } else if (entry.isFile) {
                    const ext = entry.name.split('.').pop() || 'unknown';
                    if (['png', 'jpg', 'jpeg', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'map'].includes(ext)) continue;

                    stats.totalFiles++;
                    stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + 1;

                    try {
                        const content = await Deno.readTextFile(fullPath);
                        const lines = content.split('\n');
                        const lineCount = lines.length;

                        stats.totalLines += lineCount;
                        stats.linesByExtension[ext] = (stats.linesByExtension[ext] || 0) + lineCount;

                        // Complexity Analysis (Max Indentation)
                        if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
                            let maxDepth = 0;
                            for (const line of lines) {
                                const trim = line.trim();
                                if (!trim || trim.startsWith('//') || trim.startsWith('/*') || trim.startsWith('*')) continue;
                                const match = line.match(/^(\s*)/);
                                if (match) {
                                    // 2 spaces = 1 depth (approx)
                                    const depth = Math.floor(match[1].length / 2);
                                    if (depth > maxDepth) maxDepth = depth;
                                }
                            }
                            complexityData.push({ file: fullPath, maxDepth });
                        }

                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error(`Error walking ${path}:`, e);
        }
    }

    async getGitStats(excludedPaths: string[] = []): Promise<GitStats> {
        const stats: GitStats = {
            topChurnFiles: [],
            newFilesHistory: []
        };

        try {
            // Churn: git log --pretty=format: --name-only
            // We use Deno.Command to invoke git
            const cmdChurn = new Deno.Command("git", {
                args: ["log", "--pretty=format:", "--name-only"],
                stdout: "piped",
                stderr: "piped"
            });
            const outputChurn = await cmdChurn.output();
            if (outputChurn.code === 0) {
                const text = new TextDecoder().decode(outputChurn.stdout);
                const fileCounts: Record<string, number> = {};
                const lines = text.split('\n');
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine) continue;
                    // Check exclusion
                    if (this.isExcluded(cleanLine, excludedPaths)) continue;

                    // Simple filter to keep it relevant
                    fileCounts[cleanLine] = (fileCounts[cleanLine] || 0) + 1;
                }
                stats.topChurnFiles = Object.entries(fileCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([file, changes]) => ({ file, changes }));
            }

            // New Files History
            const cmdNew = new Deno.Command("git", {
                args: ["log", "--diff-filter=A", "--name-only", "--format=DATE:%ad", "--date=short"],
                stdout: "piped",
                stderr: "piped"
            });
            const outputNew = await cmdNew.output();
            if (outputNew.code === 0) {
                const text = new TextDecoder().decode(outputNew.stdout);
                const lines = text.split('\n');
                let currentDate = '';
                const dateCounts: Record<string, number> = {};

                for (const line of lines) {
                    const clean = line.trim();
                    if (!clean) continue;
                    if (clean.startsWith('DATE:')) {
                        currentDate = clean.substring(5);
                    } else {
                        // It's a file
                        if (this.isExcluded(clean, excludedPaths)) continue;
                        if (currentDate) {
                            dateCounts[currentDate] = (dateCounts[currentDate] || 0) + 1;
                        }
                    }
                }

                stats.newFilesHistory = Object.entries(dateCounts)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, count]) => ({ date, count }));
            }

        } catch (e) {
            console.error("Git stats failed (Git might not be available):", e);
        }
        return stats;
    }

    async getDependencyCount(): Promise<number> {
        let count = 0;
        try {
            const pkgRaw = await Deno.readTextFile('package.json');
            const pkg = JSON.parse(pkgRaw);
            count += Object.keys(pkg.dependencies || {}).length;
            count += Object.keys(pkg.devDependencies || {}).length;
        } catch {}
        try {
            const denoRaw = await Deno.readTextFile('deno.json');
            const deno = JSON.parse(denoRaw);
            count += Object.keys(deno.imports || {}).length;
        } catch {}
        return count;
    }

    async getFileStructure(): Promise<FileNode> {
        return await this.buildTree(this.rootDir);
    }

    async getExtendedFileStructure(): Promise<FileNode> {
        return await this.buildExtendedTree(this.rootDir);
    }

    private async buildTree(path: string): Promise<FileNode> {
        const name = path.split('/').pop() || path;
        const node: FileNode = {
            name,
            path,
            type: 'dir',
            children: []
        };

        try {
            const entries: FileNode[] = [];
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;
                if (this.isExcluded(fullPath, [])) continue;

                if (entry.isDirectory) {
                    entries.push(await this.buildTree(fullPath));
                } else {
                    entries.push({ name: entry.name, path: fullPath, type: 'file' });
                }
            }
            node.children = entries.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'dir' ? -1 : 1;
            });
        } catch (e) { }
        return node;
    }

    private async buildExtendedTree(path: string): Promise<FileNode> {
        const name = path.split('/').pop() || path;
        const node: FileNode = {
            name,
            path,
            type: 'dir',
            children: [],
            lines: 0,
            fileCount: 0,
            size: 0
        };

        try {
            const entries: FileNode[] = [];
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;
                if (this.isExcluded(fullPath, [])) continue;

                if (entry.isDirectory) {
                    const childDir = await this.buildExtendedTree(fullPath);
                    entries.push(childDir);
                    node.lines = (node.lines || 0) + (childDir.lines || 0);
                    node.fileCount = (node.fileCount || 0) + (childDir.fileCount || 0);
                    node.size = (node.size || 0) + (childDir.size || 0);
                } else if (entry.isFile) {
                    const ext = entry.name.split('.').pop() || '';
                    let lines = 0;
                    let size = 0;
                    try {
                        const stat = await Deno.stat(fullPath);
                        size = stat.size;
                        if (['ts', 'tsx', 'js', 'jsx', 'css', 'json', 'md', 'html'].includes(ext)) {
                            const content = await Deno.readTextFile(fullPath);
                            lines = content.split('\n').length;
                        }
                    } catch (e) { }

                    entries.push({ name: entry.name, path: fullPath, type: 'file', lines, size });
                    node.lines = (node.lines || 0) + lines;
                    node.fileCount = (node.fileCount || 0) + 1;
                    node.size = (node.size || 0) + size;
                }
            }
            node.children = entries.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'dir' ? -1 : 1;
            });
        } catch (e) { }
        return node;
    }

    async analyzeCodebase(excludedPaths: string[] = []): Promise<CodeIssue[]> {
        const issues: CodeIssue[] = [];
        const files: { path: string, content: string, lines: number, name: string }[] = [];
        await this.gatherFiles(this.rootDir, files, excludedPaths);

        const filenameMap = new Map<string, string[]>();
        for (const file of files) {
            if (file.lines > 300) {
                issues.push({
                    type: 'large_file',
                    severity: file.lines > 600 ? 'high' : 'medium',
                    message: `Large file detected: ${file.lines} lines`,
                    file: file.path
                });
            }
            const baseName = file.name.split('.')[0];
            if (!filenameMap.has(baseName)) filenameMap.set(baseName, []);
            filenameMap.get(baseName)?.push(file.path);
        }

        for (const [name, paths] of filenameMap.entries()) {
            if (paths.length > 1) {
                issues.push({
                    type: 'duplicate_file',
                    severity: 'medium',
                    message: `Duplicate filename: ${name}`,
                    file: paths[0],
                    relatedFile: paths.slice(1).join(', ')
                });
            }
        }
        return issues;
    }

    private async gatherFiles(path: string, list: { path: string, content: string, lines: number, name: string }[], excludedPaths: string[] = []) {
        try {
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;

                if (this.isExcluded(fullPath, excludedPaths)) continue;

                if (entry.isDirectory) {
                    await this.gatherFiles(fullPath, list, excludedPaths);
                } else if (entry.isFile) {
                    const ext = entry.name.split('.').pop() || '';
                    if (!['ts', 'tsx', 'js', 'jsx'].includes(ext)) continue;
                    try {
                        const content = await Deno.readTextFile(fullPath);
                        list.push({ path: fullPath, content, lines: content.split('\n').length, name: entry.name });
                    } catch (e) { }
                }
            }
        } catch (e) { }
    }

    async analyzeFunctions(excludedPaths: string[] = []): Promise<DuplicateFunction[]> {
        const files: { path: string, content: string }[] = [];
        await this.gatherFiles(this.rootDir, files as any, excludedPaths);

        const functions: FunctionInfo[] = [];
        const IGNORE_PATTERNS = /^(use|set|get|handle|render|on|is|has|create|update|delete|fetch|load|moment|clsx|cn|z)$/i;
        const IGNORE_EXACT = ['useEffect', 'useState', 'useCallback', 'useMemo', 'useRef', 't', 'log', 'error'];

        for (const file of files) {
            const lines = file.content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const matchFunc = line.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
                const matchConst = line.match(/const\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?(\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/);
                const matchMethod = line.match(/^\s*(public|private|protected)?\s*(async)?\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/);

                const name = matchFunc?.[1] || matchConst?.[1] || matchMethod?.[3];

                if (name && name.length > 3 && !IGNORE_EXACT.includes(name) && !IGNORE_PATTERNS.test(name)) {
                    functions.push({ name, file: file.path, line: i + 1 });
                }
            }
        }

        const duplicates: DuplicateFunction[] = [];
        functions.sort((a, b) => a.name.length - b.name.length);

        for (let i = 0; i < functions.length; i++) {
            for (let j = i + 1; j < functions.length; j++) {
                const a = functions[i];
                const b = functions[j];

                if (Math.abs(a.name.length - b.name.length) > 3) continue;

                if (a.name === b.name && a.file !== b.file) {
                    duplicates.push({ nameA: a.name, nameB: b.name, fileA: a.file, fileB: b.file, similarity: 1 });
                } else if (a.name !== b.name) {
                    const dist = this.levenshtein(a.name, b.name);
                    const maxLength = Math.max(a.name.length, b.name.length);
                    const sim = 1 - (dist / maxLength);
                    if (sim >= 0.85) {
                        duplicates.push({ nameA: a.name, nameB: b.name, fileA: a.file, fileB: b.file, similarity: sim });
                    }
                }
            }
        }

        const unique = duplicates.filter((d, index, self) =>
            index === self.findIndex((t) => (t.nameA === d.nameA && t.nameB === d.nameB) || (t.nameA === d.nameB && t.nameB === d.nameA))
        );

        return unique.sort((a, b) => b.similarity - a.similarity).slice(0, 100);
    }

    async findSimilarFiles(excludedPaths: string[] = []): Promise<SimilarFilePair[]> {
        const files: { path: string, content: string }[] = [];
        await this.gatherFiles(this.rootDir, files as any, excludedPaths);

        const fileTerms = new Map<string, Set<string>>();
        for (const file of files) {
            const tokens = file.content.split(/[^a-zA-Z0-9_]+/).filter(t => t.length > 5 && !/^(import|export|const|from|return|function|class|interface|async|await)$/.test(t));
            fileTerms.set(file.path, new Set(tokens));
        }

        const pairs: SimilarFilePair[] = [];
        const filenames = Array.from(fileTerms.keys());

        for (let i = 0; i < filenames.length; i++) {
            for (let j = i + 1; j < filenames.length; j++) {
                const fA = filenames[i];
                const fB = filenames[j];

                const setA = fileTerms.get(fA)!;
                const setB = fileTerms.get(fB)!;

                let intersection = 0;
                const shared: string[] = [];
                for (const t of setA) {
                    if (setB.has(t)) {
                        intersection++;
                        if (shared.length < 5) shared.push(t);
                    }
                }

                const union = setA.size + setB.size - intersection;
                const similarity = intersection / union;

                if (similarity > 0.4 && intersection > 10) {
                    pairs.push({ fileA: fA, fileB: fB, similarity, sharedTerms: shared });
                }
            }
        }
        return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 50);
    }

    async searchCodebase(query: string, excludedPaths: string[] = []): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        if (!query || query.length < 2) return results;

        const files: { path: string, content: string }[] = [];
        await this.gatherFiles(this.rootDir, files as any, excludedPaths);

        const lowerQuery = query.toLowerCase();

        for (const file of files) {
            // Check filename matches first (higher priority usually, but we return all)
            const lines = file.content.split('\n');
            const matches: { line: number, content: string }[] = [];

            lines.forEach((line, index) => {
                if (line.toLowerCase().includes(lowerQuery)) {
                    matches.push({ line: index + 1, content: line.trim() });
                }
            });

            if (matches.length > 0) {
                results.push({ file: file.path, matches });
            }
        }

        return results.slice(0, 50); // Limit results
    }

    async getFileContent(path: string): Promise<string> {
        // Security check: Ensure path is within allowed dirs
        // Allow reading root MD files and src
        const allowed = [this.rootDir, './' + this.rootDir, 'src/', ...['BUGS.MD', 'TODO.md', 'AGENT_MANIFEST.md', 'ARCHITECTURE.md', 'README.md', 'CONTRIBUTING.md', 'REFACTORING_PLAN.md'].map(f => `./${f}`)];

        if (!allowed.some(p => path.startsWith(p)) && !path.endsWith('.md')) { // Relaxed check for MD files in root
             if (!path.startsWith('src/') && !path.startsWith('./src')) {
                  // Fallback stricter check if not MD
                  throw new Error("Access denied: Invalid path");
             }
        }
        try {
            return await Deno.readTextFile(path);
        } catch (e) {
            return `Error reading file: ${e}`;
        }
    }

    private levenshtein(a: string, b: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }

    async findUnusedFiles(excludedPaths: string[] = []): Promise<string[]> {
        const files: { path: string, content: string }[] = [];
        await this.gatherFiles(this.rootDir, files as any, excludedPaths);

        const allPaths = new Set(files.map(f => f.path.replace(/^\.\//, '')));
        const importedPaths = new Set<string>();

        // Known entry points that are implicitly used
        const entryPatterns = [
            'src/main.tsx', 'src/App.tsx', 'src/api/server.ts', 'src/api/node-entry.ts',
            'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js',
            'src/api/node-polyfill.ts', 'src/api/main.ts'
        ];
        entryPatterns.forEach(e => importedPaths.add(e));

        // Patterns for files that are implicitly used (routes, contexts, hooks, types)
        const implicitPatterns = [
            /Page\.tsx$/, // Route pages rendered by React Router
            /Context\.tsx$/, // Context providers
            /Layout\.tsx$/, // Layout components
            /index\.tsx?$/, // Barrel exports
            /sampleData\.ts$/, // Sample/seed data
            /types\.ts$/, // Type definitions
            /globals\.css$/, // Global styles
        ];

        const importRegex = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        const lazyImportRegex = /lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]/g;

        for (const file of files) {
            const content = file.content;
            const currentDir = file.path.split('/').slice(0, -1).join('/');

            const checkImport = (imp: string) => {
                if (imp.startsWith('.')) {
                    // Resolve relative path
                    let resolved = join(currentDir, imp);
                    // Normalize to forward slashes (Windows compatibility)
                    resolved = resolved.replace(/\\/g, '/');
                    if (resolved.startsWith('src/')) resolved = './' + resolved; // consistency

                    // Try extensions
                    const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
                    for (const ext of exts) {
                        const p = (resolved + ext).replace(/^\.\//, '');
                        if (allPaths.has(p)) {
                            importedPaths.add(p);
                            return;
                        }
                        // Handle /index case
                        const pIndex = (resolved + '/index' + ext).replace(/^\.\//, '');
                        if (allPaths.has(pIndex)) {
                            importedPaths.add(pIndex);
                            return;
                        }
                    }
                }
            };

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
            while ((match = dynamicImportRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
            while ((match = lazyImportRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
        }

        const unused: string[] = [];
        for (const path of allPaths) {
            // Skip already imported files
            if (importedPaths.has(path)) continue;
            // Skip type definition files
            if (path.endsWith('.d.ts')) continue;
            // Skip files matching implicit patterns
            if (implicitPatterns.some(p => p.test(path))) continue;

            unused.push(path);
        }

        return unused;
    }

    async extractComments(excludedPaths: string[] = []): Promise<{ file: string, line: number, text: string, type: 'todo' | 'code' | 'info', context: string[] }[]> {
        const files: { path: string, content: string }[] = [];
        await this.gatherFiles(this.rootDir, files as any, excludedPaths);

        const results: { file: string, line: number, text: string, type: 'todo' | 'code' | 'info', context: string[] }[] = [];
        const codePatterns = [
            /const\s+[a-z]/i, /function\s/, /return\s/, /import\s/, /export\s/, /<[a-zA-Z]/, /\{\s*$/, /;\s*$/
        ];

        for (const file of files) {
            const lines = file.content.split('\n');
            let inBlockComment = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                const context: string[] = [];
                if (i > 0) context.push(lines[i - 1]);
                if (i < lines.length - 1) context.push(lines[i + 1]);

                const addResult = (text: string, type: 'todo' | 'code' | 'info') => {
                    results.push({ file: file.path, line: i + 1, text, type, context });
                };

                if (inBlockComment) {
                    if (line.includes('*/')) {
                        inBlockComment = false;
                        line = line.substring(line.indexOf('*/') + 2).trim();
                        if (!line) continue;
                    } else {
                        // Inside block comment
                        const text = line.replace(/^\*\s?/, '').trim();
                        if (text) {
                            let type: 'todo' | 'code' | 'info' = 'info';
                            if (text.toLowerCase().includes('todo') || text.toLowerCase().includes('fixme')) type = 'todo';
                            else if (codePatterns.some(p => p.test(text))) type = 'code';
                            addResult(text, type);
                        }
                        continue;
                    }
                }

                if (line.startsWith('/*')) {
                    inBlockComment = true;
                    if (line.includes('*/')) {
                        inBlockComment = false;
                        // Single line block comment
                        const text = line.replace(/^\/\*/, '').replace(/\*\/$/, '').trim();
                        if (text) {
                            let type: 'todo' | 'code' | 'info' = 'info';
                            if (text.toLowerCase().includes('todo') || text.toLowerCase().includes('fixme')) type = 'todo';
                            addResult(text, type);
                        }
                    }
                    continue;
                }

                if (line.startsWith('//')) {
                    const text = line.substring(2).trim();
                    if (text) {
                        let type: 'todo' | 'code' | 'info' = 'info';
                        if (text.toLowerCase().includes('todo') || text.toLowerCase().includes('fixme')) type = 'todo';
                        else if (codePatterns.some(p => p.test(text))) type = 'code';
                        addResult(text, type);
                    }
                }
            }
        }
        return results;
    }

    async getRouteStructure(): Promise<string[]> {
        try {
            const appContent = await Deno.readTextFile('src/App.tsx');
            const routes: string[] = [];
            const regex = /<Route\s+[^>]*path=["']([^"']+)["']/g;
            let match;
            while ((match = regex.exec(appContent)) !== null) {
                routes.push(match[1]);
            }
            return routes;
        } catch (e) {
            return [];
        }
    }

    async getDependencies(): Promise<{ name: string, version: string, type: 'prod' | 'dev' }[]> {
        const deps: { name: string, version: string, type: 'prod' | 'dev' }[] = [];
        try {
            // Check package.json
            const pkgRaw = await Deno.readTextFile('package.json');
            const pkg = JSON.parse(pkgRaw);
            if (pkg.dependencies) {
                Object.entries(pkg.dependencies).forEach(([k, v]) => deps.push({ name: k, version: String(v), type: 'prod' }));
            }
            if (pkg.devDependencies) {
                Object.entries(pkg.devDependencies).forEach(([k, v]) => deps.push({ name: k, version: String(v), type: 'dev' }));
            }

            // Check deno.json imports
            const denoRaw = await Deno.readTextFile('deno.json');
            const deno = JSON.parse(denoRaw);
            if (deno.imports) {
                Object.entries(deno.imports).forEach(([k, v]) => {
                    deps.push({ name: k, version: String(v), type: 'prod' });
                });
            }
        } catch (e) { }
        return deps;
    }

    async generateAgentReport(excludedPaths: string[] = []): Promise<string> {
        const stats = await this.getProjectStats(excludedPaths);
        const issues = await this.analyzeCodebase(excludedPaths);

        return `
# Codebase Analysis Report
Generated by Developer Tools

## Statistics
- **Total Files**: ${stats.totalFiles}
- **Total Lines**: ${stats.totalLines}
- **TypeScript Files**: ${stats.filesByExtension['ts'] || 0}
- **TSX Files**: ${stats.filesByExtension['tsx'] || 0}

## Top Issues
${issues.length === 0 ? "No major issues found." : ""}
${issues.map(issue => `- [${issue.severity.toUpperCase()}] **${issue.type}**: ${issue.message} (${issue.file}) ${issue.relatedFile ? `-> ${issue.relatedFile}` : ''}`).join('\n')}

## Large Files (>300 LOC)
${issues.filter(i => i.type === 'large_file').map(i => `- ${i.file}`).join('\n')}

## Recommendations
1. Review large files and consider splitting them.
2. Check duplicate filenames for architectural ambiguities.
`;
    }
}
