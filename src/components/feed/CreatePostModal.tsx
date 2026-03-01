import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    Bold,
    Italic,
    Underline,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Link as LinkIcon,
    Globe,
    Users,
    Lock,
    Send
} from 'lucide-react';
import type { VisibilityLevel } from '../../models/feedTypes.ts';

interface CreatePostModalProps {
    onClose: () => void;
    onPostCreated: () => void;
}

export function CreatePostModal({ onClose, onPostCreated }: CreatePostModalProps) {
    const [title, setTitle] = useState('');
    const [visibility, setVisibility] = useState<VisibilityLevel>('PUBLIC');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Draft Caching State & Timers
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);

    // Ensure editor commands work by preventing default focus loss on buttons
    const handleCommand = (e: React.MouseEvent, command: string, value?: string) => {
        e.preventDefault(); // Keep focus in editor

        if (command === 'createLink') {
            const url = prompt('Ange URL för länken:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else if (command === 'formatBlock') {
            document.execCommand(command, false, value);
        } else {
            document.execCommand(command, false);
        }

        // Refocus editor
        editorRef.current?.focus();
    };

    const handleSubmit = async () => {
        if (!title.trim() || !editorRef.current) return;

        const contentHtml = editorRef.current.innerHTML;
        // Don't submit if empty
        if (!contentHtml.trim() || contentHtml === '<br>') {
            alert('Inlägget kan inte vara tomt.');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/feed/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'SOCIAL_POST',
                    title: title.trim(),
                    visibility,
                    payload: {
                        type: 'SOCIAL_POST',
                        contentHtml: contentHtml
                    },
                    // Generate an excerpt for summary
                    summary: editorRef.current.innerText.slice(0, 100) + (editorRef.current.innerText.length > 100 ? '...' : '')
                })
            });

            if (res.ok) {
                // Clear the cache upon successful publish
                localStorage.removeItem('greens_post_draft');
                onPostCreated();
                onClose();
            } else {
                const data = await res.json();
                alert(`Kunde inte skapa inlägg: ${data.error || 'Okänt fel'}`);
            }
        } catch (err) {
            console.error('Failed to create post:', err);
            alert('Ett nätverksfel uppstod när inlägget skulle sparas.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Restore from cache and auto-focus on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem('greens_post_draft');
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.title) setTitle(parsed.title);
                if (parsed.visibility) setVisibility(parsed.visibility);
                if (parsed.contentHtml && editorRef.current) {
                    editorRef.current.innerHTML = parsed.contentHtml;
                }
            } catch (err) {
                console.error("Failed to parse post draft", err);
            }
        }
        document.getElementById('post-title-input')?.focus();
    }, []);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSubmitting, onClose]);

    // Save to cache 2 seconds after the last keystroke
    const queueDraftSave = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        saveTimerRef.current = setTimeout(() => {
            if (!editorRef.current) return;
            // Only save if we actually have some data
            const draft = {
                title,
                visibility,
                contentHtml: editorRef.current.innerHTML
            };
            if (draft.title.trim() || draft.contentHtml.trim() && draft.contentHtml !== '<br>') {
                localStorage.setItem('greens_post_draft', JSON.stringify(draft));
            }
        }, 2000);
    };

    // Trigger draft save whenever title or visibility changes
    useEffect(() => {
        queueDraftSave();
    }, [title, visibility]);

    // Handle clearing the draft
    const handleClearDraft = () => {
        if (confirm("Är du säker på att du vill rensa utkastet? Allt innehåll kommer att försvinna.")) {
            setTitle('');
            setVisibility('PUBLIC');
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
            localStorage.removeItem('greens_post_draft');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div
                className="absolute inset-0"
                onClick={!isSubmitting ? onClose : undefined}
            />

            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/50">
                    <h2 className="text-lg font-black text-white">Skapa inlägg</h2>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

                    {/* Title Input */}
                    <input
                        id="post-title-input"
                        type="text"
                        placeholder="Inläggets titel..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-2xl font-black text-white placeholder:text-slate-600 outline-none p-2 border-b border-white/5 focus:border-emerald-500/50 transition-colors"
                    />

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-950 rounded-xl border border-white/5">
                        <ToolbarButton icon={<Bold size={16} />} onMouseDown={(e) => handleCommand(e, 'bold')} title="Fet (Ctrl+B)" />
                        <ToolbarButton icon={<Italic size={16} />} onMouseDown={(e) => handleCommand(e, 'italic')} title="Kursiv (Ctrl+I)" />
                        <ToolbarButton icon={<Underline size={16} />} onMouseDown={(e) => handleCommand(e, 'underline')} title="Understruken (Ctrl+U)" />
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <ToolbarButton icon={<Heading2 size={16} />} onMouseDown={(e) => handleCommand(e, 'formatBlock', 'H2')} title="Rubrik 2" />
                        <ToolbarButton icon={<Heading3 size={16} />} onMouseDown={(e) => handleCommand(e, 'formatBlock', 'H3')} title="Rubrik 3" />
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <ToolbarButton icon={<List size={16} />} onMouseDown={(e) => handleCommand(e, 'insertUnorderedList')} title="Punktlista" />
                        <ToolbarButton icon={<ListOrdered size={16} />} onMouseDown={(e) => handleCommand(e, 'insertOrderedList')} title="Numrerad lista" />
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <ToolbarButton icon={<LinkIcon size={16} />} onMouseDown={(e) => handleCommand(e, 'createLink')} title="Länk" />
                    </div>

                    {/* Editor Area */}
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={queueDraftSave}
                        className="flex-1 min-h-[200px] bg-slate-950/50 rounded-xl border border-white/5 p-4 text-slate-300 outline-none focus:border-emerald-500/30 transition-colors wysiwyg-content max-w-none"
                        data-placeholder="Berätta hur träningen går..."
                        style={{ emptyCells: 'show' }}
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-white/5 bg-slate-950/50 flex items-center justify-between gap-4">

                    {/* Visibility Toggle */}
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-white/5">
                        <VisibilityButton
                            active={visibility === 'PUBLIC'}
                            onClick={() => setVisibility('PUBLIC')}
                            icon={<Globe size={14} />}
                            label="Publik"
                        />
                        <VisibilityButton
                            active={visibility === 'FRIENDS'}
                            onClick={() => setVisibility('FRIENDS')}
                            icon={<Users size={14} />}
                            label="Följare"
                        />
                        <VisibilityButton
                            active={visibility === 'PRIVATE'}
                            onClick={() => setVisibility('PRIVATE')}
                            icon={<Lock size={14} />}
                            label="Privat"
                        />
                    </div>

                    {/* Submit and Clear Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearDraft}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            Rensa
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!title.trim() || isSubmitting}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all
                                ${!title.trim() || isSubmitting
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95'
                                }
                            `}
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">Publicerar...</span>
                            ) : (
                                <>
                                    <span>Publicera</span>
                                    <Send size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Subcomponents for cleanliness
function ToolbarButton({ icon, onMouseDown, title }: { icon: React.ReactNode; onMouseDown: (e: React.MouseEvent) => void; title: string }) {
    return (
        <button
            onMouseDown={onMouseDown}
            title={title}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
            {icon}
        </button>
    );
}

function VisibilityButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${active
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }
            `}
        >
            {icon}
            {label}
        </button>
    );
}
