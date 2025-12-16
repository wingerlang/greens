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
            }
        },
    },
    plugins: [],
}
