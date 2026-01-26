'use client';

type LabelRow = {
  label: string;
  all_count: number;
  my_count: number;
};

type Badge = {
  label: string;
  count: number | null;
};

type LabelBadgeRowProps = {
  badges: Badge[];
  selectedLabel: string | null;
  onSelect: (label: string | null) => void;
};

export function buildLabelBadges<T extends LabelRow>(
  labels: T[],
  maxVisible: number,
  scope: 'all' | 'my'
): Badge[] {
  const list = labels.slice(0, maxVisible).map((item) => ({
    label: item.label,
    count: scope === 'my' ? item.my_count : item.all_count
  }));
  return list;
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
          onClick={() =>
            onSelect(selectedLabel === badge.label ? null : badge.label)
          }
          title={`${badge.label} (${badge.count ?? 0})`}
        >
          {`${badge.label} (${badge.count ?? 0})`}
        </button>
      ))}
    </div>
  );
}
