
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: FileNode[];
}

export function DeveloperExplorer() {
    const { token } = useAuth();
    const [structure, setStructure] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/developer/structure', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setStructure(data.structure))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="p-8 text-slate-400 animate-pulse">Mapping file system...</div>;
    if (!structure) return <div className="p-8 text-red-400">Failed to load structure.</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Code Explorer</h1>
            <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 font-mono text-sm overflow-auto max-h-[80vh]">
                <FileTree node={structure} depth={0} />
            </div>
        </div>
    );
}

function FileTree({ node, depth }: { node: FileNode; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 2); // Auto-expand top levels
    const isDir = node.type === 'dir';

    if (!isDir) {
        return (
            <div
                className="flex items-center gap-2 py-1 px-2 hover:bg-slate-800 rounded cursor-default text-slate-400"
                style={{ paddingLeft: `${depth * 20}px` }}
            >
                <File size={14} className="text-slate-500" />
                <span>{node.name}</span>
            </div>
        );
    }

    return (
        <div>
            <div
                className="flex items-center gap-2 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-slate-200 select-none"
                style={{ paddingLeft: `${depth * 20}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className="text-amber-500" />
                <span className="font-semibold">{node.name}</span>
            </div>
            {expanded && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileTree key={child.path} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
