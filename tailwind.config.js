export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                // We can extend specific colors here if we need custom brand colors later
                // For now, we'll rely on Slate and Emerald from standard Tailwind
            },
            keyframes: {
                'fade-slide-in': {
                    '0%': { opacity: '0', transform: 'translateX(-20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                }
            },
            animation: {
                'fade-slide-in': 'fade-slide-in 1s ease-out forwards',
            }
        },
    },
    plugins: [],
}
