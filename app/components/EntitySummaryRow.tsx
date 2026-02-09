type EntitySummaryRowProps = {
  name: string;
  posKeywords?: string | null;
  negKeywords?: string | null;
  reviewCount?: number | null;
  score?: number | null;
};

function formatScore(value?: number | null) {
  if (value === null || value === undefined) return '-';
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(3);
}

export default function EntitySummaryRow({
  name,
  posKeywords,
  negKeywords,
  reviewCount,
  score
}: EntitySummaryRowProps) {
  const reviewCountLabel =
    reviewCount === null || reviewCount === undefined ? '-' : String(reviewCount);
  const positiveText = posKeywords?.trim() ?? '';
  const negativeText = negKeywords?.trim() ?? '';
  return (
    <>
      <div className="review-line">
        <span className="review-preview">
          <span className="badge badge--filter">{name}</span>{' '}
          {positiveText && (
            <span className="admin-cell-wrap admin-cell-wrap--muted">
              😊 {positiveText}
            </span>
          )}{' '}
          {negativeText && (
            <span className="admin-cell-wrap admin-cell-wrap--muted">
              ☹️ {negativeText}
            </span>
          )}
        </span>
      </div>
      <small className="review-meta">
        {reviewCountLabel} reviews · Score {formatScore(score)}
      </small>
    </>
  );
}
