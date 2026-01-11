
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDeveloper } from './DeveloperContext.tsx';
import { Folder, File, ChevronRight, ChevronDown, Search, BarChart2, AlertCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: FileNode[];
    lines?: number;
    fileCount?: number;
}

interface SearchResult {
    file: string;
    matches: { line: number, content: string }[];
}

export function DeveloperExplorer() {
    const { token } = useAuth();
    const { excludedFolders, refreshTrigger } = useDeveloper();
    const [structure, setStructure] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // File Viewer State
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [loadingFile, setLoadingFile] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const query = new URLSearchParams({ excluded: excludedFolders.join(',') }).toString();

    // Fetch structure when 'showStats' changes
    useEffect(() => {
        setLoading(true);
        fetch(`/api/developer/structure?stats=${showStats}&${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setStructure(data.structure))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [token, showStats, refreshTrigger, query]);

    // Fetch file content when selectedFile changes
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

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Code Explorer</h1>
                <div className="flex items-center gap-4">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search codebase..."
                            className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-64 transition-all focus:w-80"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </form>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showStats ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                        <BarChart2 size={16} />
                        {showStats ? 'Hide Stats' : 'Show Stats'}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Tree / Search Results */}
                <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 font-mono text-sm overflow-auto lg:col-span-1">
                    {isSearching ? (
                        <div className="text-slate-400 animate-pulse">Searching...</div>
                    ) : searchResults ? (
                         <div className="space-y-4">
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
                                    {res.matches.length > 3 && <div className="text-xs text-slate-600 pl-4 italic">+{res.matches.length - 3} more</div>}
                                </div>
                            ))}
                            {searchResults.length === 0 && <div className="text-slate-500 italic">No matches found.</div>}
                        </div>
                    ) : loading ? (
                        <div className="text-slate-400 animate-pulse">Mapping file system...</div>
                    ) : structure ? (
                        <FileTree node={structure} depth={0} showStats={showStats} onSelect={setSelectedFile} selectedPath={selectedFile} />
                    ) : (
                        <div className="text-red-400">Failed to load structure.</div>
                    )}
                </div>

                {/* Right: File Viewer */}
                <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 p-0 overflow-hidden flex flex-col h-full">
                   <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                        <span className="font-mono text-sm text-slate-300">
                            {selectedFile || 'No file selected'}
                        </span>
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

function FileTree({ node, depth, showStats, onSelect, selectedPath }: { node: FileNode; depth: number, showStats: boolean, onSelect: (path: string) => void, selectedPath: string | null }) {
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
                {showStats && node.lines !== undefined && (
                    <span className="text-xs text-slate-600 ml-2 whitespace-nowrap">{node.lines} L</span>
                )}
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
                {showStats && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 ml-2 whitespace-nowrap">
                        {node.fileCount !== undefined && <span>{node.fileCount} files</span>}
                        {node.lines !== undefined && <span className="text-emerald-500/70">{node.lines.toLocaleString()} L</span>}
                    </div>
                )}
            </div>
            {expanded && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileTree key={child.path} node={child} depth={depth + 1} showStats={showStats} onSelect={onSelect} selectedPath={selectedPath} />
                    ))}
                </div>
            )}
        </div>
    );
}
