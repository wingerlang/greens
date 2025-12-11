import { defineConfig } from "npm:vite@^5.4.0";
import react from "npm:@vitejs/plugin-react@^4.3.4";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true
    }
});
