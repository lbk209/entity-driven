export type ReviewScope = 'my' | 'all';

export type ReviewFilterParams = {
  scope: ReviewScope | null;
  label: string | null;
  nodeId: number | null;
  nodeName: string;
  nodeNameTerms: string[];
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
  const nodeId = normalizeNodeId(searchParams.get('node') ?? searchParams.get('node_id'));
  const nodeName = normalizeNodeName(searchParams.get('node_name'));
  const nodeNameTerms = buildNodeNameTerms(nodeName);
  return { scope, label, nodeId, nodeName, nodeNameTerms };
}
