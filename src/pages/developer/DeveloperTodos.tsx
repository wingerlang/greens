
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useDeveloper } from './DeveloperContext.tsx';
import { Check, Trash2, Plus, Clock, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';

interface RefactorTodo {
    id: string;
    description: string;
    file?: string;
    type: 'duplicate' | 'unused' | 'comment' | 'other';
    status: 'active' | 'fixed';
    createdAt: number;
    resolvedAt?: number;
}

export function DeveloperTodos() {
    const { token } = useAuth();
    const { refreshTrigger, triggerRefresh } = useDeveloper();
    const [todos, setTodos] = useState<RefactorTodo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTodo, setNewTodo] = useState({ description: '', file: '', type: 'other' });

    useEffect(() => {
        fetchTodos();
    }, [token, refreshTrigger]);

    const fetchTodos = () => {
        fetch('/api/developer/todos', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setTodos(data.todos || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    const handleStatusUpdate = async (id: string, status: 'active' | 'fixed') => {
        await fetch(`/api/developer/todos/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        fetchTodos();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await fetch(`/api/developer/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchTodos();
    };

    const handleAdd = async () => {
        if (!newTodo.description) return;
        await fetch('/api/developer/todos', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(newTodo)
        });
        setIsAddModalOpen(false);
        setNewTodo({ description: '', file: '', type: 'other' });
        fetchTodos();
        triggerRefresh();
    };

    if (loading) return <div className="p-8 text-slate-400">Loading todos...</div>;

    const active = todos.filter(t => t.status === 'active');
    const fixed = todos.filter(t => t.status === 'fixed');

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Refactoring Plan</h1>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium"
                >
                    <Plus size={16} />
                    Add Task
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Active Column */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Active Issues ({active.length})
                    </h2>
                    <div className="space-y-3">
                        {active.map(todo => (
                            <TodoCard
                                key={todo.id}
                                todo={todo}
                                onToggle={() => handleStatusUpdate(todo.id, 'fixed')}
                                onDelete={() => handleDelete(todo.id)}
                            />
                        ))}
                        {active.length === 0 && <div className="p-4 text-slate-500 italic bg-slate-800/50 rounded">No active issues. Great job!</div>}
                    </div>
                </div>

                {/* Fixed Column */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                        <Check size={18} />
                        Resolved History ({fixed.length})
                    </h2>
                    <div className="space-y-3 opacity-75">
                         {fixed.map(todo => (
                            <TodoCard
                                key={todo.id}
                                todo={todo}
                                onToggle={() => handleStatusUpdate(todo.id, 'active')}
                                onDelete={() => handleDelete(todo.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Refactor Task">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                        <input
                            value={newTodo.description}
                            onChange={e => setNewTodo({ ...newTodo, description: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                            placeholder="What needs to be fixed?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">File (Optional)</label>
                        <input
                            value={newTodo.file}
                            onChange={e => setNewTodo({ ...newTodo, file: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono text-sm"
                            placeholder="src/..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                        <select
                            value={newTodo.type}
                            onChange={e => setNewTodo({ ...newTodo, type: e.target.value as any })}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                        >
                            <option value="other">General</option>
                            <option value="duplicate">Duplicate Code</option>
                            <option value="unused">Unused Code</option>
                            <option value="comment">Comments/Docs</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                        <button onClick={handleAdd} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500">Create</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function TodoCard({ todo, onToggle, onDelete }: { todo: RefactorTodo, onToggle: () => void, onDelete: () => void }) {
    const isFixed = todo.status === 'fixed';
    return (
        <div className={`p-4 rounded-lg border transition-all ${isFixed ? 'bg-slate-800/50 border-emerald-900/50' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                            todo.type === 'duplicate' ? 'bg-orange-500/20 text-orange-400' :
                            todo.type === 'unused' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                        }`}>
                            {todo.type}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(todo.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p className={`text-sm ${isFixed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {todo.description}
                    </p>
                    {todo.file && (
                        <p className="text-xs font-mono text-slate-500 mt-2 truncate">
                            {todo.file}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onToggle}
                        className={`p-2 rounded-full transition-colors ${
                            isFixed ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                        }`}
                    >
                        <Check size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 rounded-full text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
