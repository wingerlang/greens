import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    private cleanStackTrace(stack: string | null | undefined): string {
        if (!stack) return "No stack trace available";

        const lines = stack.split('\n');
        const cleanLines = lines.filter(line => {
            // Always keep the first line (error message usually)
            if (!line.trim().startsWith('at ')) return true;
            // Keep lines that reference our src directory
            if (line.includes('/src/')) return true;
            // Filter out node_modules and vite internals
            if (line.includes('node_modules') || line.includes('/.vite/')) return false;
            // Keep others as fallback (e.g. unknown scripts)
            return true;
        });

        // If we filtered everything out (unlikely), fall back to original but truncated
        if (cleanLines.length === 0) return stack.split('\n').slice(0, 5).join('\n');

        return cleanLines.join('\n');
    }

    private handleCopyError = () => {
        const { error, errorInfo } = this.state;
        const cleanStack = this.cleanStackTrace(errorInfo?.componentStack || error?.stack);

        const errorText = `
Error: ${error?.toString()}

Stack Trace (Application):
${cleanStack}

Full Stack Trace:
${error?.stack || errorInfo?.componentStack || "N/A"}

Location: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();

        navigator.clipboard.writeText(errorText).then(() => {
            alert("Error details copied to clipboard!");
        }).catch(err => {
            console.error("Failed to copy error details: ", err);
        });
    };

    public render() {
        if (this.state.hasError) {
            const cleanedComponentStack = this.cleanStackTrace(this.state.errorInfo?.componentStack);
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-white p-6">
                    <div className="max-w-3xl w-full bg-slate-800 rounded-lg shadow-2xl overflow-hidden border border-slate-700">
                        <div className="bg-red-600 p-4 flex items-center justify-between">
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <span>⚠️</span> Application Error
                            </h1>
                            <span className="text-xs bg-red-800 px-2 py-1 rounded text-red-200">
                                CRITICAL FAILURE
                            </span>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <p className="text-slate-300">
                                    The application has encountered an unexpected error and cannot continue.
                                    Please copy the error details below and send them to the developer.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-md font-mono text-sm overflow-auto max-h-[60vh] border border-slate-800 relative group">
                                <div className="text-red-400 font-bold mb-2">
                                    {this.state.error?.toString()}
                                </div>
                                <div className="text-slate-500 whitespace-pre-wrap">
                                    {this.state.errorInfo?.componentStack}
                                </div>

                                {/* Floating copy button inside the code block */}
                                <button
                                    onClick={this.handleCopyError}
                                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-xs transition-colors backdrop-blur-sm flex items-center gap-2 border border-white/10"
                                >
                                    <span>📋</span> Copy Details
                                </button>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors border border-slate-600"
                                >
                                    Reload Application
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
