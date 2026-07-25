import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

const DOC_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
]

/**
 * Shared chrome for public info pages (About, Help, Terms, Privacy).
 */
export default function SiteDocLayout({ title, updated, children, currentPath }) {
  return (
    <div className="site-doc">
      <header className="site-doc__header">
        <Link to="/" className="site-doc__brand" aria-label="The Callsheet home">
          <BrandLogo />
        </Link>
        <nav className="site-doc__nav" aria-label="Site information">
          {DOC_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={currentPath === link.to ? 'is-active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <article className="site-doc__article">
        <h1 className="site-doc__title">{title}</h1>
        {updated && (
          <p className="site-doc__updated">Last updated: {updated}</p>
        )}
        <div className="site-doc__body">{children}</div>
      </article>

      <footer className="site-doc__footer">
        <Link to="/" className="btn btn-secondary">Return Home</Link>
        <div className="site-doc__footer-links">
          {DOC_LINKS.filter((l) => l.to !== currentPath).map((link) => (
            <Link key={link.to} to={link.to} className="btn btn-ghost btn-sm">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}
