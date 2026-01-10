
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

export interface ProjectStats {
    totalFiles: number;
    totalLines: number;
    filesByExtension: Record<string, number>;
    linesByExtension: Record<string, number>;
}

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size?: number;
    lines?: number;
    children?: FileNode[];
}

export interface CodeIssue {
    type: 'duplicate_file' | 'similar_name' | 'large_file' | 'long_function' | 'many_services';
    severity: 'low' | 'medium' | 'high';
    message: string;
    file: string;
    relatedFile?: string;
    details?: string;
}

export class CodeAnalysisService {
    private rootDir: string;

    constructor(rootDir: string = "./src") {
        this.rootDir = rootDir;
    }

    async getProjectStats(): Promise<ProjectStats> {
        const stats: ProjectStats = {
            totalFiles: 0,
            totalLines: 0,
            filesByExtension: {},
            linesByExtension: {}
        };

        await this.walkAndCount(this.rootDir, stats);
        return stats;
    }

    private async walkAndCount(path: string, stats: ProjectStats) {
        try {
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;
                if (entry.isDirectory) {
                    await this.walkAndCount(fullPath, stats);
                } else if (entry.isFile) {
                    const ext = entry.name.split('.').pop() || 'unknown';

                    // Skip binary or irrelevant files
                    if (['png', 'jpg', 'jpeg', 'ico', 'svg', 'woff', 'woff2', 'ttf'].includes(ext)) continue;

                    stats.totalFiles++;
                    stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + 1;

                    try {
                        const content = await Deno.readTextFile(fullPath);
                        const lines = content.split('\n').length;
                        stats.totalLines += lines;
                        stats.linesByExtension[ext] = (stats.linesByExtension[ext] || 0) + lines;
                    } catch (e) {
                        // Ignore read errors
                    }
                }
            }
        } catch (e) {
            console.error(`Error walking ${path}:`, e);
        }
    }

    async getFileStructure(): Promise<FileNode> {
        return await this.buildTree(this.rootDir);
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
                if (entry.isDirectory) {
                    entries.push(await this.buildTree(fullPath));
                } else {
                    const fileNode: FileNode = {
                        name: entry.name,
                        path: fullPath,
                        type: 'file'
                    };
                    // Optional: Get size/lines here if needed, but might be slow for tree
                    entries.push(fileNode);
                }
            }
            // Sort: Directories first, then files
            node.children = entries.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'dir' ? -1 : 1;
            });
        } catch (e) {
            console.error(`Error building tree for ${path}:`, e);
        }

        return node;
    }

    async analyzeCodebase(): Promise<CodeIssue[]> {
        const issues: CodeIssue[] = [];
        const files: { path: string, content: string, lines: number, name: string }[] = [];

        // 1. Gather all files
        await this.gatherFiles(this.rootDir, files);

        // 2. Analyze
        const filenameMap = new Map<string, string[]>();

        for (const file of files) {
            // Check Large Files
            if (file.lines > 300) {
                issues.push({
                    type: 'large_file',
                    severity: file.lines > 600 ? 'high' : 'medium',
                    message: `Large file detected: ${file.lines} lines`,
                    file: file.path,
                    details: `Files larger than 300 lines are harder to maintain.`
                });
            }

            // Group by filename (ignoring extension) to find similar concepts
            const baseName = file.name.split('.')[0];
            if (!filenameMap.has(baseName)) {
                filenameMap.set(baseName, []);
            }
            filenameMap.get(baseName)?.push(file.path);

            // Duplicate content check (simple exact match for now)
            // (Skipped for performance unless requested specifically, but user asked for it)
            // Let's do a quick hash or just comparison if sizes match?
            // For now, let's rely on filenames and maybe content chunks.
        }

        // Check for duplicate filenames
        for (const [name, paths] of filenameMap.entries()) {
            if (paths.length > 1) {
                issues.push({
                    type: 'duplicate_file',
                    severity: 'medium',
                    message: `Duplicate filename found: ${name}`,
                    file: paths[0],
                    relatedFile: paths.slice(1).join(', '),
                    details: `Multiple files share the name '${name}'. This might indicate ambiguous architecture.`
                });
            }
        }

        // Check for Service proliferation
        const serviceFiles = files.filter(f => f.path.includes('/services/') || f.name.endsWith('Service.ts'));
        if (serviceFiles.length > 20) {
             issues.push({
                type: 'many_services',
                severity: 'low',
                message: `High number of services detected (${serviceFiles.length})`,
                file: 'src/api/services',
                details: 'Ensure services have clear boundaries.'
            });
        }

        return issues;
    }

    private async gatherFiles(path: string, list: { path: string, content: string, lines: number, name: string }[]) {
        try {
            for await (const entry of Deno.readDir(path)) {
                const fullPath = `${path}/${entry.name}`;
                if (entry.isDirectory) {
                    await this.gatherFiles(fullPath, list);
                } else if (entry.isFile) {
                     const ext = entry.name.split('.').pop() || '';
                     if (!['ts', 'tsx', 'js', 'jsx'].includes(ext)) continue;

                     try {
                        const content = await Deno.readTextFile(fullPath);
                        list.push({
                            path: fullPath,
                            content,
                            lines: content.split('\n').length,
                            name: entry.name
                        });
                     } catch (e) { }
                }
            }
        } catch (e) { }
    }

    async generateAgentReport(): Promise<string> {
        const stats = await this.getProjectStats();
        const issues = await this.analyzeCodebase();

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
