import React, { useState } from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { X, Shield, MessageSquare, FileText } from 'lucide-react';

interface SupportTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
    const { createSupportChat } = useMessages();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Title defaults to "Support Ärende" if empty in backend, but we can send explicit title or let backend handle it.
            // Let's send what user typed or undefined.
            createSupportChat(title.trim() || undefined, description.trim() || undefined);
            onClose();
            setTitle('');
            setDescription('');
        } catch (error) {
            console.error("Failed to create support chat", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="text-amber-500" size={20} />
                        Nytt Supportärende
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 text-sm text-amber-800 dark:text-amber-200">
                        Beskriv ditt ärende så hjälper vårt supportteam dig (eller admin) så fort som möjligt.
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-1">
                            <MessageSquare size={12} /> Titel (Valfritt)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="T.ex. Problem med inloggning..."
                            className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-medium placeholder:text-slate-400"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-1">
                            <FileText size={12} /> Beskrivning (Valfritt)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Berätta mer om vad du behöver hjälp med..."
                            className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-medium placeholder:text-slate-400 min-h-[120px] resize-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? 'Skapar...' : 'Starta Ärende'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
