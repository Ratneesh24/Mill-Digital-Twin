import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Application root.
 *
 * Owns exactly one thing beyond rendering: connecting the data source on mount
 * and releasing it on unmount. The twin starts in SIMULATION — never in LIVE —
 * so it can never come up claiming a plant connection it does not have.
 */
import { useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { WorkspaceLayout } from '../components/dashboard/WorkspaceLayout';
import { DashboardPage } from '../components/pages/DashboardPage';
import { TrendsPage } from '../components/pages/TrendsPage';
import { TwinPage } from '../components/pages/TwinPage';
import { useMachineStore } from '../store/machineStore';
import { useUiStore } from '../store/uiStore';
import { ErrorBoundary } from './ErrorBoundary';
import { ROUTES } from './routes';
export function App() {
    const connect = useMachineStore((s) => s.connect);
    const disconnect = useMachineStore((s) => s.disconnect);
    const theme = useUiStore((s) => s.theme);
    useEffect(() => {
        void connect('SIMULATION');
        return () => {
            void disconnect();
        };
    }, [connect, disconnect]);
    return (_jsxs(ErrorBoundary, { children: [_jsx(Tooltip.Provider, { delayDuration: 250, skipDelayDuration: 400, children: _jsx(BrowserRouter, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(WorkspaceLayout, {}), children: [_jsx(Route, { path: ROUTES.dashboard, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: ROUTES.trends, element: _jsx(TrendsPage, {}) }), _jsx(Route, { path: ROUTES.twin, element: _jsx(TwinPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: ROUTES.dashboard, replace: true }) })] }) }) }) }), _jsx(Toaster, { theme: theme, position: "bottom-right", closeButton: true, toastOptions: {
                    style: {
                        background: 'var(--color-base-900)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-line)',
                    },
                } })] }));
}
