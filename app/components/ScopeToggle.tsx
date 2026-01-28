'use client';

type ScopeToggleProps = {
  value: 'my' | 'all';
  onChange: (next: 'my' | 'all') => void;
  disabled?: boolean;
};

export default function ScopeToggle({
  value,
  onChange,
  disabled = false
}: ScopeToggleProps) {
  return (
    <div
      className="scope-toggle"
      role="radiogroup"
      aria-label="Filter review scope"
      aria-disabled={disabled}
    >
      <button
        type="button"
        className={`scope-toggle__button ${
          value === 'my' ? 'scope-toggle__button--active' : ''
        }`}
        role="radio"
        aria-checked={value === 'my'}
        onClick={() => onChange('my')}
        disabled={disabled}
      >
        My
      </button>
      <button
        type="button"
        className={`scope-toggle__button ${
          value === 'all' ? 'scope-toggle__button--active' : ''
        }`}
        role="radio"
        aria-checked={value === 'all'}
        onClick={() => onChange('all')}
        disabled={disabled}
      >
        All
      </button>
    </div>
  );
}
