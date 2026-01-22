'use client';

type LabelRow = {
  label: string;
  node_count: number;
};

type Badge = {
  label: string;
  count: number | null;
};

type LabelBadgeRowProps = {
  badges: Badge[];
  selectedLabel: string;
  onSelect: (label: string) => void;
};

export function buildLabelBadges<T extends LabelRow>(labels: T[]): Badge[] {
  const list = labels.map((item) => ({
    label: item.label,
    count: item.node_count
  }));
  return [{ label: 'All', count: null }, ...list];
}

export default function LabelBadgeRow({
  badges,
  selectedLabel,
  onSelect
}: LabelBadgeRowProps) {
  return (
    <div className="badge-row" role="radiogroup" aria-label="Filter by taxonomy label">
      {badges.map((badge) => (
        <button
          key={badge.label}
          type="button"
          className={`badge badge--filter ${
            selectedLabel === badge.label ? 'badge--selected' : 'badge--muted'
          }`}
          role="radio"
          aria-checked={selectedLabel === badge.label}
          onClick={() => onSelect(badge.label)}
          title={badge.count === null ? 'All' : `${badge.label} (${badge.count})`}
        >
          {badge.count === null ? badge.label : `${badge.label} (${badge.count})`}
        </button>
      ))}
    </div>
  );
}
