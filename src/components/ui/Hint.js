import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Tooltip from '@radix-ui/react-tooltip';
export function Hint({ label, children, side = 'top', }) {
    if (!label)
        return children;
    return (_jsxs(Tooltip.Root, { children: [_jsx(Tooltip.Trigger, { asChild: true, children: children }), _jsx(Tooltip.Portal, { children: _jsxs(Tooltip.Content, { side: side, sideOffset: 6, collisionPadding: 12, className: "border-line bg-base-900 text-text-dim text-meta z-50 max-w-[280px] rounded-[10px] border px-2.5 py-2 leading-relaxed shadow-[var(--shadow-pop)]", children: [label, _jsx(Tooltip.Arrow, { className: "fill-[var(--color-line)]" })] }) })] }));
}
