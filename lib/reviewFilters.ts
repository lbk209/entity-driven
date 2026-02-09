export type ReviewScope = 'my' | 'all';

export type ReviewFilterParams = {
  scope: ReviewScope | null;
  label: string | null;
  /**
   * Canonical entity id derived from entity_* params.
   */
  nodeId: number | null;
  /**
   * Canonical specific user id derived from URL params.
   */
  specificUserId: string | null;
};

export type ReviewFilterConflictPolicy =
  | 'reject'
  | 'ignore_user_when_scope'
  | 'ignore_scope_when_user';

export type InterpretedReviewFilters = ReviewFilterParams & {
  reviewerUserId: number | null;
  specificUserId: string | null;
};

export function normalizeScope(
  scopeParam: string | null
): ReviewScope | null {
  if (scopeParam === 'my') {
    return 'my';
  }
  if (scopeParam === 'all') {
    return 'all';
  }
  return null;
}

export function normalizeLabel(labelParam: string | null) {
  if (!labelParam) return null;
  const trimmed = labelParam.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'all') return null;
  return trimmed;
}

export function normalizeNodeId(nodeIdParam: string | null) {
  if (!nodeIdParam) return null;
  const value = Number(nodeIdParam);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function normalizeSpecificUserId(headerUserId: string | null | undefined) {
  if (!headerUserId) return null;
  const trimmed = headerUserId.trim();
  return trimmed ? trimmed : null;
}

export function parseReviewFilters(
  searchParams: { get: (key: string) => string | null }
): ReviewFilterParams {
  const scope = normalizeScope(searchParams.get('scope'));
  const label = normalizeLabel(searchParams.get('label'));
  const nodeId = normalizeNodeId(searchParams.get('entity_id') ?? searchParams.get('entity'));
  const specificUserId = normalizeSpecificUserId(searchParams.get('user_id'));
  return { scope, label, nodeId, specificUserId };
}

export function deriveEffectiveUserId(params: {
  scope: ReviewScope | null;
  specificUserId: string | null;
  sessionUserId: string | null | undefined;
}) {
  if (params.scope === 'my') {
    return normalizeSpecificUserId(params.sessionUserId ?? null);
  }
  return normalizeSpecificUserId(params.specificUserId);
}

export function interpretReviewFilters(params: {
  searchParams: { get: (key: string) => string | null };
  headerUserId?: string | null;
  sessionUserId?: number | null;
  policy?: ReviewFilterConflictPolicy;
}): { filters: InterpretedReviewFilters; error?: string } {
  const base = parseReviewFilters(params.searchParams);
  const policy = params.policy ?? 'ignore_user_when_scope';
  let scope = base.scope;
  let specificUserId = base.specificUserId ?? normalizeSpecificUserId(params.headerUserId);
  let error: string | undefined;

  if (scope === 'my' && specificUserId) {
    if (policy === 'reject') {
      error = 'scope and specific user filters cannot be combined';
      specificUserId = null;
    } else if (policy === 'ignore_scope_when_user') {
      scope = null;
    } else {
      specificUserId = null;
    }
  }

  const reviewerUserId =
    scope === 'my' && params.sessionUserId ? params.sessionUserId : null;

  return {
    filters: {
      ...base,
      scope,
      reviewerUserId,
      specificUserId
    },
    error
  };
}
