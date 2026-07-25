import { useState } from 'react'
import { Eye, EyeOff, Lock } from './icons'

/**
 * Password field with show/hide toggle.
 * Use variant="auth" inside auth pages (icon + wrapper), or "plain" for form pages.
 */
export default function PasswordInput({
  value,
  onChange,
  name = 'password',
  autoComplete = 'current-password',
  placeholder = '••••••••',
  required = false,
  minLength,
  disabled = false,
  variant = 'auth',
  className = 'form-input',
  id,
  style,
}) {
  const [visible, setVisible] = useState(false)
  const inputType = visible ? 'text' : 'password'

  const toggle = (
    <button
      type="button"
      className="password-toggle"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      tabIndex={0}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      <span className="password-toggle-label">{visible ? 'Hide' : 'Show'}</span>
    </button>
  )

  const input = (
    <input
      id={id}
      className={className}
      type={inputType}
      name={name}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      minLength={minLength}
      disabled={disabled}
      style={style}
    />
  )

  if (variant === 'plain') {
    return (
      <div className="password-field password-field--plain">
        {input}
        {toggle}
      </div>
    )
  }

  return (
    <div className="auth-input-wrapper password-field">
      <Lock size={16} aria-hidden />
      {input}
      {toggle}
    </div>
  )
}
