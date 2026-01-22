'use client';

type ScopeToggleProps = {
  value: 'my' | 'all';
  onChange: (next: 'my' | 'all') => void;
};

export default function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  return (
    <div className="scope-toggle" role="radiogroup" aria-label="Filter review scope">
      <button
        type="button"
        className={`scope-toggle__button ${
          value === 'my' ? 'scope-toggle__button--active' : ''
        }`}
        role="radio"
        aria-checked={value === 'my'}
        onClick={() => onChange('my')}
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
      >
        All
      </button>
    </div>
  );
}
