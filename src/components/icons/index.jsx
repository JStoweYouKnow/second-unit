// Custom icon library — consistent 24×24 viewBox, 1.5px stroke, rounded caps/joins

function Svg({ size, color, className, style, children, fill = 'none' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      {children}
    </svg>
  )
}

const p = (size, color, className, style) => ({ size, color, className, style })

export function LayoutDashboard({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="4" rx="1.5" />
      <rect x="13" y="9" width="8" height="4" rx="1.5" />
      <rect x="3" y="15" width="18" height="6" rx="1.5" />
    </Svg>
  )
}

export function Trophy({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M6 3h12v7a6 6 0 01-12 0V3z" />
      <path d="M6 7H4a2 2 0 000 4c.4 1.6 1.6 3 3 3.7" />
      <path d="M18 7h2a2 2 0 010 4c-.4 1.6-1.6 3-3 3.7" />
      <path d="M9 21h6" />
      <path d="M12 17v4" />
      <path d="M9 17c0-1 1-2 3-2s3 1 3 2" />
    </Svg>
  )
}

export function MessageSquare({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M21 14a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v9z" />
      <path d="M8 10h8M8 13h5" />
    </Svg>
  )
}

export function Calendar({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 9h18" />
      <rect x="7" y="13" width="2" height="2" rx=".5" fill="currentColor" stroke="none" />
      <rect x="11" y="13" width="2" height="2" rx=".5" fill="currentColor" stroke="none" />
      <rect x="15" y="13" width="2" height="2" rx=".5" fill="currentColor" stroke="none" />
      <rect x="7" y="17" width="2" height="2" rx=".5" fill="currentColor" stroke="none" />
      <rect x="11" y="17" width="2" height="2" rx=".5" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function FileText({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </Svg>
  )
}

export function CreditCard({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
      <rect x="5" y="13" width="4" height="3" rx="1" fill="currentColor" stroke="none" opacity=".35" />
      <path d="M16 14h2M19 14h1" strokeWidth="1.5" />
    </Svg>
  )
}

export function LogOut({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  )
}

export function Loader2({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M21 12a9 9 0 11-6.22-8.56" />
    </Svg>
  )
}

export function Heart({ size = 24, color = 'currentColor', fill = 'none', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={fill} />
    </Svg>
  )
}

export function Star({ size = 24, color = 'currentColor', fill = 'none', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M12 2l2.83 6.26 6.67.99-4.83 4.87 1.14 6.88L12 17.77l-5.81 3.23 1.14-6.88L2.5 9.25l6.67-.99L12 2z" fill={fill} />
    </Svg>
  )
}

export function TrendingUp({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 1 17" />
      <polyline points="15 7 22 7 22 14" />
    </Svg>
  )
}

export function Users({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Svg>
  )
}

export function DollarSign({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </Svg>
  )
}

export function ArrowUpRight({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M7 17L17 7" />
      <path d="M7 7h10v10" />
    </Svg>
  )
}

export function ArrowDownRight({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M7 7l10 10" />
      <path d="M17 7v10H7" />
    </Svg>
  )
}

export function BarChart3({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="2" y="14" width="4" height="8" rx="1" />
      <rect x="9" y="9" width="4" height="13" rx="1" />
      <rect x="16" y="4" width="4" height="18" rx="1" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </Svg>
  )
}

export function PieChart({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M21.21 15.89A10 10 0 118 2.83" />
      <path d="M22 12A10 10 0 0012 2v10z" />
    </Svg>
  )
}

export function Activity({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
  )
}

export function Eye({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  )
}

export function Search({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="10.5" cy="10.5" r="7" />
      <line x1="21" y1="21" x2="15.8" y2="15.8" />
    </Svg>
  )
}

export function Play({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function ExternalLink({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </Svg>
  )
}

export function Filter({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </Svg>
  )
}

export function ArrowLeft({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Svg>
  )
}

export function MapPin({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  )
}

export function Globe({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
    </Svg>
  )
}

export function AtSign({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
    </Svg>
  )
}

export function Camera({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  )
}

export function Briefcase({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <line x1="2" y1="14" x2="22" y2="14" />
    </Svg>
  )
}

export function Mail({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </Svg>
  )
}

export function Send({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  )
}

export function Check({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

export function HelpCircle({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" />
    </Svg>
  )
}

export function Wifi({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M5 12.55a11 11 0 0114.08 0" />
      <path d="M1.42 9a16 16 0 0121.16 0" />
      <path d="M8.53 16.11a6 6 0 016.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" />
    </Svg>
  )
}

export function WifiOff({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
      <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0122.56 9" />
      <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
      <path d="M8.53 16.11a6 6 0 016.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" />
    </Svg>
  )
}

export function Clock({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16.5 14.5" />
    </Svg>
  )
}

export function Plus({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}

export function CheckCircle({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  )
}

export function AlertCircle({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
    </Svg>
  )
}

export function Menu({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Svg>
  )
}

export function X({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}

export function ArrowRight({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Svg>
  )
}

export function Download({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  )
}

export function Archive({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </Svg>
  )
}

export function PenTool({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.59 7.59" />
      <circle cx="11" cy="11" r="2" />
    </Svg>
  )
}

export function Shield({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

export function Copy({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </Svg>
  )
}

export function Receipt({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </Svg>
  )
}

export function Lock({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </Svg>
  )
}

export function LogIn({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </Svg>
  )
}

export function User({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

export function UserPlus({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </Svg>
  )
}

export function Palette({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.4c2.9 0 5.1-2.2 5.1-5 0-4.9-4.9-8.6-10.5-8.6z" />
      <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function FileQuestion({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M9.5 13a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
    </Svg>
  )
}

export function ChevronLeft({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

export function ChevronRight({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  )
}

export function Bell({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  )
}

export function CheckCheck({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M2 12l5 5L15 7" />
      <path d="M9 12l5 5 8-10" />
    </Svg>
  )
}

export function AlertTriangle({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" />
    </Svg>
  )
}

export function RefreshCw({ size = 24, color = 'currentColor', className = '', style } = {}) {
  return (
    <Svg {...p(size, color, className, style)}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </Svg>
  )
}

// Rank medal icons — replaces 🥇🥈🥉 emoji
export function MedalGold({ size = 24, color = '#f5c542', className = '', style } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="14" r="7" fill="#f5c542" fillOpacity=".15" stroke="#f5c542" strokeWidth="1.5" />
      <path d="M9 5l-2-3h10l-2 3" stroke="#f5c542" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#f5c542" fontFamily="system-ui">1</text>
    </svg>
  )
}

export function MedalSilver({ size = 24, color = '#adb5bd', className = '', style } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="14" r="7" fill="#adb5bd" fillOpacity=".15" stroke="#adb5bd" strokeWidth="1.5" />
      <path d="M9 5l-2-3h10l-2 3" stroke="#adb5bd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#adb5bd" fontFamily="system-ui">2</text>
    </svg>
  )
}

export function MedalBronze({ size = 24, color = '#cd7f32', className = '', style } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="14" r="7" fill="#cd7f32" fillOpacity=".15" stroke="#cd7f32" strokeWidth="1.5" />
      <path d="M9 5l-2-3h10l-2 3" stroke="#cd7f32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#cd7f32" fontFamily="system-ui">3</text>
    </svg>
  )
}
