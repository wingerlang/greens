// Inline editable textarea that toggles between display and edit mode

import React, { useRef, useEffect } from 'react';

interface InlineTextAreaProps {
    value: string;
    isEditing: boolean;
    onEdit: () => void;
    onBlur: () => void;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function InlineTextArea({
    value,
    isEditing,
    onEdit,
    onBlur,
    onChange,
    placeholder = '',
    className = ''
}: InlineTextAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                className={`bg-slate-800 rounded p-2 w-full outline-none border border-emerald-500 text-slate-300 text-sm resize-none ${className}`}
                rows={3}
            />
        );
    }

    return (
        <p
            onClick={onEdit}
            className={`text-slate-400 text-sm cursor-pointer hover:text-slate-300 ${className}`}
        >
            {value || placeholder}
        </p>
    );
}
