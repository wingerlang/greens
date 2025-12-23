// Inline editable text input that toggles between display and edit mode

import React, { useRef, useEffect } from 'react';

interface InlineEditProps {
    value: string;
    isEditing: boolean;
    onEdit: () => void;
    onBlur: () => void;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

export function InlineEdit({
    value,
    isEditing,
    onEdit,
    onBlur,
    onChange,
    className = '',
    placeholder = ''
}: InlineEditProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                onKeyDown={e => e.key === 'Enter' && onBlur()}
                placeholder={placeholder}
                className={`bg-transparent border-b border-emerald-500 outline-none ${className}`}
            />
        );
    }

    return (
        <span onClick={onEdit} className={`cursor-pointer hover:opacity-80 ${className}`}>
            {value || placeholder}
        </span>
    );
}
