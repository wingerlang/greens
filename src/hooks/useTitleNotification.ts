import { useEffect, useRef } from 'react';

export function useTitleNotification(count: number) {
    const originalTitle = useRef(document.title);

    useEffect(() => {
        // Update the ref if the title changes externally (e.g. navigation),
        // but try to avoid capturing the notification title itself.
        // This is tricky if other things change title.
        // Ideally we assume 'Guardian' or check if it starts with '('.
        if (!document.title.startsWith('(')) {
            originalTitle.current = document.title;
        }
    }, []);

    useEffect(() => {
        if (count > 0) {
            document.title = `(${count}) ${originalTitle.current}`;
        } else {
            document.title = originalTitle.current;
        }

        return () => {
            document.title = originalTitle.current;
        };
    }, [count]);
}
