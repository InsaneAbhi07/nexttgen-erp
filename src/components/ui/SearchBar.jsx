import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search…', className = '', autoFocus, style }) {
  return (
    <div className={`search-bar ${className}`} style={style}>
      <span className="search-icon">
        <Search size={15} />
      </span>
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
