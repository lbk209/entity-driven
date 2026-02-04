export type ReviewScope = 'my' | 'all';

export type ReviewFilterParams = {
  scope: ReviewScope | null;
  label: string | null;
  /**
   * Canonical entity id derived from entity_* params.
   */
  nodeId: number | null;
  /**
   * Canonical entity name derived from entity_* params.
   */
  nodeName: string;
  nodeNameTerms: string[];
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

export function normalizeNodeName(nodeNameParam: string | null) {
  if (!nodeNameParam) return '';
  return nodeNameParam.trim();
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

export function buildNodeNameTerms(nodeName: string) {
  if (!nodeName) return [];
  return nodeName
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function parseReviewFilters(
  searchParams: { get: (key: string) => string | null }
): ReviewFilterParams {
  const scope = normalizeScope(searchParams.get('scope'));
  const label = normalizeLabel(searchParams.get('label'));
  const nodeId = normalizeNodeId(searchParams.get('entity_id') ?? searchParams.get('entity'));
  const nodeName = normalizeNodeName(searchParams.get('entity_name'));
  const nodeNameTerms = buildNodeNameTerms(nodeName);
  return { scope, label, nodeId, nodeName, nodeNameTerms };
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
  let specificUserId = normalizeSpecificUserId(params.headerUserId);
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
