import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Error boundary.
 *
 * A control-room screen runs unattended for days. A render error that blanks the
 * page with no explanation is worse than one that says what broke — an operator
 * needs to know immediately that the screen has stopped reflecting the mill.
 */
import { Component } from 'react';
export class ErrorBoundary extends Component {
    state = { error: null, info: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        this.setState({ info: info.componentStack ?? null });
        // Kept: on a 24/7 screen this is the only trace of what happened.
        console.error('[digital-twin] render error', error, info);
    }
    render() {
        const { error, info } = this.state;
        if (!error)
            return this.props.children;
        return (_jsx("div", { className: "bg-base-950 flex h-full items-center justify-center p-8", children: _jsxs("div", { className: "border-alarm/60 bg-base-900 max-w-[720px] border p-5", children: [_jsx("h1", { className: "text-alarm text-body font-semibold tracking-[0.12em]", children: "TWIN STOPPED \u2014 RENDER ERROR" }), _jsx("p", { className: "text-text-dim mt-2 text-meta leading-relaxed", children: "This screen is no longer reflecting the mill. Do not use it to judge machine state." }), _jsxs("pre", { className: "num text-text-faint border-line bg-base-950 mt-3 max-h-[300px] overflow-auto border p-2 text-micro leading-relaxed", children: [error.message, info ? `\n${info}` : ''] }), _jsx("button", { type: "button", onClick: () => window.location.reload(), className: "border-line text-text-dim hover:border-normal/50 hover:text-normal mt-3 border px-3 py-1.5 text-meta tracking-wider transition-colors", children: "RELOAD" })] }) }));
    }
}
