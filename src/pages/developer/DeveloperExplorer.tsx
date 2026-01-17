
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDeveloper } from './DeveloperContext.tsx';
import { Folder, File, ChevronRight, ChevronDown, Search, BarChart2, AlertCircle, LayoutList, LayoutGrid, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: FileNode[];
    lines?: number;
    fileCount?: number;
    size?: number;
}

interface SearchResult {
    file: string;
    matches: { line: number, content: string }[];
}

type ViewMode = 'tree' | 'list';
type SortField = 'name' | 'lines' | 'size' | 'ext';
type SortDirection = 'asc' | 'desc';

export function DeveloperExplorer() {
    const { token } = useAuth();
    const { excludedFolders, setExcludedFolders, refreshTrigger } = useDeveloper();
    const [structure, setStructure] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // View Settings
    const [viewMode, setViewMode] = useState<ViewMode>('tree');
    const [showExcludes, setShowExcludes] = useState(false);
    const [sortField, setSortField] = useState<SortField>('lines');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // File Viewer State
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [loadingFile, setLoadingFile] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const query = new URLSearchParams({ excluded: excludedFolders.join(',') }).toString();

    // Fetch structure
    useEffect(() => {
        setLoading(true);
        // Always fetch stats now for the list view
        fetch(`/api/developer/structure?stats=true&${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setStructure(data.structure))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [token, refreshTrigger, query]);

    // Fetch file content
    useEffect(() => {
        if (!selectedFile) {
            setFileContent('');
            return;
        }

        setLoadingFile(true);
        setFileError(null);
        fetch(`/api/developer/file?path=${encodeURIComponent(selectedFile)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load file');
            setFileContent(data.content);
        })
        .catch(err => {
            console.error(err);
            setFileError(err.message);
            setFileContent('');
        })
        .finally(() => setLoadingFile(false));
    }, [selectedFile, token]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }

        setIsSearching(true);
        fetch(`/api/developer/search?q=${encodeURIComponent(searchQuery)}&${query}`, {
             headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setSearchResults(data.results))
        .catch(console.error)
        .finally(() => setIsSearching(false));
    };

    const getLanguage = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext === 'ts' || ext === 'tsx') return 'typescript';
        if (ext === 'js' || ext === 'jsx') return 'javascript';
        if (ext === 'css') return 'css';
        if (ext === 'json') return 'json';
        if (ext === 'md') return 'markdown';
        return 'text';
    };

    // Flatten structure for list view
    const flatFiles = useMemo(() => {
        if (!structure) return [];
        const files: FileNode[] = [];
        const traverse = (node: FileNode) => {
            if (node.type === 'file') {
                files.push(node);
            } else if (node.children) {
                node.children.forEach(traverse);
            }
        };
        traverse(structure);
        return files.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];

            if (sortField === 'ext') {
                valA = a.name.split('.').pop() || '';
                valB = b.name.split('.').pop() || '';
            }

            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [structure, sortField, sortDirection]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <div className="w-4 h-4" />;
        return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-white">Code Explorer</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search content..."
                            className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-48 transition-all focus:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </form>

                    <div className="h-8 w-px bg-slate-700 mx-2" />

                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('tree')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'tree' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                            title="Tree View"
                        >
                            <LayoutList size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                            title="List View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowExcludes(!showExcludes)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showExcludes ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        >
                            <Filter size={16} />
                            <span>Filters</span>
                        </button>
                        {showExcludes && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-20">
                                <h3 className="text-sm font-semibold text-white mb-2">Excluded Folders</h3>
                                <div className="space-y-2">
                                    {['tests', 'public', 'scripts'].map(folder => (
                                        <label key={folder} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excludedFolders.includes(folder)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setExcludedFolders([...excludedFolders, folder]);
                                                    else setExcludedFolders(excludedFolders.filter(f => f !== folder));
                                                }}
                                                className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                                            />
                                            {folder}
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                                    System folders (node_modules, .git) are always excluded.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Tree / List / Search Results */}
                <div className="bg-slate-900 rounded-lg border border-slate-700 p-0 font-mono text-sm overflow-hidden flex flex-col lg:col-span-1">
                     {isSearching ? (
                        <div className="p-4 text-slate-400 animate-pulse">Searching...</div>
                    ) : searchResults ? (
                         <div className="p-4 overflow-auto flex-1 space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                <span>Found {searchResults.length} files</span>
                                <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="text-emerald-400 hover:underline">Clear</button>
                            </div>
                            {searchResults.map((res, i) => (
                                <div key={i} className="space-y-1">
                                    <div
                                        className="font-semibold text-emerald-400 cursor-pointer hover:underline truncate"
                                        onClick={() => setSelectedFile(res.file)}
                                        title={res.file}
                                    >
                                        {res.file.split('/').pop()}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate pl-2 border-l border-slate-700 ml-1">
                                        {res.file}
                                    </div>
                                    {res.matches.slice(0, 3).map((m, j) => (
                                        <div key={j} className="text-xs text-slate-400 pl-4 truncate opacity-70">
                                            L{m.line}: {m.content}
                                        </div>
                                    ))}
                                </div>
                            ))}
                            {searchResults.length === 0 && <div className="text-slate-500 italic">No matches found.</div>}
                        </div>
                    ) : loading ? (
                        <div className="p-4 text-slate-400 animate-pulse">Mapping file system...</div>
                    ) : structure ? (
                        viewMode === 'tree' ? (
                            <div className="p-4 overflow-auto flex-1">
                                <FileTree node={structure} depth={0} onSelect={setSelectedFile} selectedPath={selectedFile} />
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center bg-slate-800 border-b border-slate-700 p-2 text-xs font-semibold text-slate-300 sticky top-0">
                                    <div className="flex-1 px-2 cursor-pointer hover:text-white flex items-center gap-1" onClick={() => toggleSort('name')}>
                                        File <SortIcon field="name" />
                                    </div>
                                    <div className="w-16 px-2 text-right cursor-pointer hover:text-white flex items-center justify-end gap-1" onClick={() => toggleSort('lines')}>
                                        Lines <SortIcon field="lines" />
                                    </div>
                                    <div className="w-16 px-2 text-right cursor-pointer hover:text-white flex items-center justify-end gap-1" onClick={() => toggleSort('size')}>
                                        Size <SortIcon field="size" />
                                    </div>
                                </div>
                                <div className="overflow-auto flex-1 p-0">
                                    {flatFiles.map(file => (
                                        <div
                                            key={file.path}
                                            onClick={() => setSelectedFile(file.path)}
                                            className={`flex items-center p-2 border-b border-slate-800 cursor-pointer hover:bg-slate-800 ${selectedFile === file.path ? 'bg-indigo-900/30 text-indigo-200' : 'text-slate-400'}`}
                                        >
                                            <div className="flex-1 px-2 truncate">
                                                <div className="text-slate-200 truncate">{file.name}</div>
                                                <div className="text-xs text-slate-600 truncate">{file.path}</div>
                                            </div>
                                            <div className="w-16 px-2 text-right text-xs font-mono text-emerald-500/80">
                                                {file.lines?.toLocaleString() || '-'}
                                            </div>
                                            <div className="w-16 px-2 text-right text-xs font-mono text-blue-500/80">
                                                {file.size ? (file.size / 1024).toFixed(1) + 'k' : '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="p-4 text-red-400">Failed to load structure.</div>
                    )}
                </div>

                {/* Right: File Viewer */}
                <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 p-0 overflow-hidden flex flex-col h-full">
                   <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                        <span className="font-mono text-sm text-slate-300">
                            {selectedFile || 'No file selected'}
                        </span>
                        {selectedFile && (
                            <span className="text-xs text-slate-500">
                                {flatFiles.find(f => f.path === selectedFile)?.lines} lines
                            </span>
                        )}
                   </div>
                   <div className="flex-1 overflow-auto bg-slate-950 text-slate-300 font-mono text-sm relative">
                       {loadingFile ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-500 animate-pulse">
                               Loading content...
                           </div>
                       ) : fileError ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2">
                               <AlertCircle size={32} />
                               <span>{fileError}</span>
                           </div>
                       ) : selectedFile ? (
                           <SyntaxHighlighter
                               language={getLanguage(selectedFile)}
                               style={vscDarkPlus}
                               customStyle={{ margin: 0, padding: '1rem', height: '100%', fontSize: '13px' }}
                               showLineNumbers
                           >
                               {fileContent}
                           </SyntaxHighlighter>
                       ) : (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-600 italic">
                               Select a file to view its content.
                           </div>
                       )}
                   </div>
                </div>
            </div>
        </div>
    );
}

function FileTree({ node, depth, onSelect, selectedPath }: { node: FileNode; depth: number, onSelect: (path: string) => void, selectedPath: string | null }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isDir = node.type === 'dir';

    if (!isDir) {
        return (
            <div
                className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer group ${selectedPath === node.path ? 'bg-indigo-900/50 text-indigo-200' : 'hover:bg-slate-800 text-slate-400'}`}
                style={{ paddingLeft: `${depth * 20}px` }}
                onClick={() => onSelect(node.path)}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <File size={14} className={selectedPath === node.path ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-500"} />
                    <span className="truncate">{node.name}</span>
                </div>
                <span className="text-xs text-slate-600 ml-2 whitespace-nowrap">{node.lines} L</span>
            </div>
        );
    }

    return (
        <div>
            <div
                className="flex items-center justify-between py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-slate-200 select-none group"
                style={{ paddingLeft: `${depth * 20}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Folder size={14} className="text-amber-500" />
                    <span className="font-semibold truncate">{node.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 ml-2 whitespace-nowrap">
                    {node.lines !== undefined && <span className="text-emerald-500/70">{node.lines.toLocaleString()} L</span>}
                </div>
            </div>
            {expanded && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileTree key={child.path} node={child} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />
                    ))}
                </div>
            )}
        </div>
    );
}
