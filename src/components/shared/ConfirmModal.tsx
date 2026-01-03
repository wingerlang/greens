import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Bekräfta',
    cancelText = 'Avbryt',
    variant = 'danger'
}: ConfirmModalProps) {
    // ESC key handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: 'text-red-400',
            iconBg: 'bg-red-500/20',
            button: 'bg-red-500 hover:bg-red-600 text-white'
        },
        warning: {
            icon: 'text-amber-400',
            iconBg: 'bg-amber-500/20',
            button: 'bg-amber-500 hover:bg-amber-600 text-white'
        },
        info: {
            icon: 'text-blue-400',
            iconBg: 'bg-blue-500/20',
            button: 'bg-blue-500 hover:bg-blue-600 text-white'
        }
    }[variant];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${variantStyles.iconBg}`}>
                            <AlertTriangle size={20} className={variantStyles.icon} />
                        </div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <p className="text-slate-300 text-sm">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${variantStyles.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
