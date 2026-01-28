export type ReviewScope = 'my' | 'all';

export type ReviewFilterParams = {
  scope: ReviewScope;
  label: string | null;
  nodeId: number | null;
  nodeName: string;
  nodeNameTerms: string[];
  userId: string | null;
};

export function normalizeScope(
  scopeParam: string | null,
  isLoggedIn: boolean,
  isAdmin = false
): ReviewScope {
  if (scopeParam === 'my') {
    return isLoggedIn && !isAdmin ? 'my' : 'all';
  }
  if (scopeParam === 'all') {
    return 'all';
  }
  if (isAdmin) return 'all';
  return isLoggedIn ? 'my' : 'all';
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

export function buildNodeNameTerms(nodeName: string) {
  if (!nodeName) return [];
  return nodeName
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function normalizeUserId(userIdParam: string | null) {
  if (!userIdParam) return null;
  const trimmed = userIdParam.trim();
  return trimmed ? trimmed : null;
}

export function parseReviewFilters(
  searchParams: { get: (key: string) => string | null },
  options: { isLoggedIn: boolean; isAdmin: boolean }
): ReviewFilterParams {
  const scope = normalizeScope(searchParams.get('scope'), options.isLoggedIn, options.isAdmin);
  const label = normalizeLabel(searchParams.get('label'));
  const nodeId = normalizeNodeId(searchParams.get('node') ?? searchParams.get('node_id'));
  const nodeName = normalizeNodeName(searchParams.get('node_name'));
  const nodeNameTerms = buildNodeNameTerms(nodeName);
  const userId = normalizeUserId(searchParams.get('user_id'));
  return { scope, label, nodeId, nodeName, nodeNameTerms, userId };
}
