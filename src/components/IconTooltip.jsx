/** Hover/focus tooltip wrapper for icon buttons. */
export function IconTooltip({ tip, children }) {
  if (!tip) return children
  return (
    <span className="icon-tooltip-wrap">
      {children}
      <span className="icon-tooltip" role="tooltip">
        {tip}
      </span>
    </span>
  )
}
