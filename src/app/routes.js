/**
 * ROUTES — the three pages the operator navigates between.
 *
 * Navigation lives in the URL rather than in a store, so a page survives a
 * refresh and can be linked to directly. That matters for the control room:
 * `/3d-twin` on a wall display and `/dashboard` on the desk is a normal setup.
 *
 * DEPLOYMENT NOTE — the host must serve index.html for unmatched paths, or a
 * refresh on /trends returns 404. On ASP.NET Core that is
 * `app.MapFallbackToFile("index.html")`. See docs/HANDOVER.md.
 */
export const ROUTES = {
    dashboard: '/dashboard',
    trends: '/trends',
    twin: '/3d-twin',
};
/**
 * Page title and subtitle, keyed by path. Previously a positional tuple record
 * indexed directly (`PAGE_COPY[tab][0]`), which threw on an unknown key; the
 * lookup is now total.
 */
export const PAGE_COPY = {
    [ROUTES.dashboard]: {
        title: 'Mill overview',
        subtitle: 'Live process state, KPIs and alarms — what is happening right now.',
    },
    [ROUTES.trends]: {
        title: 'Real-time trends',
        subtitle: 'How every process parameter is behaving over time.',
    },
    [ROUTES.twin]: {
        title: '3D digital twin',
        subtitle: 'The live mill model. The simulation keeps running behind it.',
    },
};
export function pageCopy(pathname) {
    return PAGE_COPY[pathname] ?? PAGE_COPY[ROUTES.dashboard];
}
