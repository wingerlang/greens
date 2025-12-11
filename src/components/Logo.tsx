import React from 'react';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
}

const SIZES = {
    sm: { icon: 24, text: '1rem' },
    md: { icon: 32, text: '1.25rem' },
    lg: { icon: 48, text: '1.75rem' },
};

export function Logo({ size = 'md', showText = true }: LogoProps) {
    const { icon, text } = SIZES[size];

    return (
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg
                width={icon}
                height={icon}
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Leaf shape */}
                <path
                    d="M24 4C24 4 8 12 8 28C8 36 14 44 24 44C34 44 40 36 40 28C40 12 24 4 24 4Z"
                    fill="url(#leafGradient)"
                />
                {/* Stem */}
                <path
                    d="M24 44V28"
                    stroke="var(--accent-primary)"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                {/* Leaf veins */}
                <path
                    d="M24 28C18 24 14 20 14 16"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <path
                    d="M24 28C30 24 34 20 34 16"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <defs>
                    <linearGradient id="leafGradient" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#4ade80" />
                        <stop offset="1" stopColor="#22c55e" />
                    </linearGradient>
                </defs>
            </svg>
            {showText && (
                <span
                    style={{
                        fontSize: text,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                    }}
                >
                    Greens
                </span>
            )}
        </div>
    );
}
