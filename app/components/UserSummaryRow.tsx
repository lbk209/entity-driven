type UserSummaryEntity = {
  name: string;
  review_count: number;
};

type UserSummaryRowProps = {
  displayName: string;
  reviewCount: number | null;
  entityReviewCount?: number | null;
  keyEntities?: UserSummaryEntity[];
  entityContextName?: string | null;
};

export default function UserSummaryRow({
  displayName,
  reviewCount,
  entityReviewCount,
  keyEntities,
  entityContextName
}: UserSummaryRowProps) {
  const totalLabel = reviewCount === null || reviewCount === undefined ? '-' : String(reviewCount);
  const entityScopedLabel =
    entityReviewCount === null || entityReviewCount === undefined
      ? null
      : `${entityReviewCount} on ${entityContextName ?? 'selected entity'}`;

  return (
    <>
      <div className="review-line">
        <span className="review-preview">
          <span className="badge badge--filter">{displayName}</span>{' '}
          {keyEntities && keyEntities.length > 0 ? (
            <span className="admin-cell-wrap admin-cell-wrap--muted">
              {keyEntities.map((entity) => entity.name).join(', ')}
            </span>
          ) : (
            <span className="admin-cell-wrap admin-cell-wrap--muted">No key entities yet.</span>
          )}
        </span>
      </div>
      <small className="review-meta">
        {totalLabel} reviews
        {entityScopedLabel ? ` · ${entityScopedLabel}` : ''}
      </small>
    </>
  );
}
