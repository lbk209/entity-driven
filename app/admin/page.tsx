'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

type NodeOption = {
  id: number;
  name: string;
  type: string;
  review_count?: number;
  edge_count?: number;
};

type Edge = {
  parent_id: number;
  child_id: number;
  relation: string;
  parent_review_count?: number;
  child_review_count?: number;
};

type EdgeRelation = {
  relation: string;
  description: string | null;
  ui_priority: number | null;
  max_suggestions: number | null;
  allowed_parent_types: string[];
  allowed_child_types: string[];
};

type NodeType = {
  node_type: string;
  description: string | null;
};
type Taxonomy = {
  id: number;
  key: string;
  value: string;
  node_type: string;
  label: string;
  description: string | null;
};
type NodeTaxonomy = {
  node_id: number;
  taxonomy_id: number;
  node_name: string;
  node_type: string;
  taxonomy_key: string;
  taxonomy_value: string;
  taxonomy_label: string;
};
type ReviewAdmin = {
  id: number;
  entity_id: number | null;
  entity_name: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
};

type DraftEdge = {
  draftId: string;
  parent_id: number | null;
  child_id: number | null;
  relation: string;
};
type DraftNode = { draftId: string; name: string; type: string };
type DraftEdgeRelation = {
  draftId: string;
  relation: string;
  ui_priority: string;
  max_suggestions: string;
  allowed_parent_types: string;
  allowed_child_types: string;
  description: string;
};
type DraftNodeType = {
  draftId: string;
  node_type: string;
  description: string;
};
type DraftTaxonomy = {
  draftId: string;
  key: string;
  value: string;
  node_type: string;
  label: string;
  description: string;
};
type DraftNodeTaxonomy = {
  draftId: string;
  node_id: number | null;
  taxonomy_id: number | null;
};
type EditNode = NodeOption & { original_id: number };
type EditEdge = Edge & {
  original_parent_id: number;
  original_child_id: number;
  original_relation: string;
};
type EditEdgeRelation = {
  relation: string;
  original_relation: string;
  description: string;
  ui_priority: number | null;
  max_suggestions: number | null;
  allowed_parent_types: string;
  allowed_child_types: string;
};
type EditNodeType = NodeType & { original_node_type: string };
type EditTaxonomy = {
  id: number;
  key: string;
  value: string;
  node_type: string;
  label: string;
  description: string;
};
type EditNodeTaxonomy = {
  node_id: number;
  taxonomy_id: number;
  original_node_id: number;
  original_taxonomy_id: number;
};
type SortDirection = 'asc' | 'desc';
type SortState<T extends string> = { key: T; direction: SortDirection };

function listToString(list: string[]) {
  return list.join(', ');
}

function formatNodeLabel(name: string, type: string) {
  return `${name} (${type})`;
}

function formatTaxonomyLabel(key: string, value: string) {
  return `${key} = ${value}`;
}

function getNodeTypeById(nodes: NodeOption[], nodeId: number | null) {
  if (!nodeId) return null;
  return nodes.find((node) => node.id === nodeId)?.type ?? null;
}

function highlightText(text: string, term: string) {
  if (!term) return text;
  const parts: Array<string | React.JSX.Element> = [];
  let startIndex = 0;
  let matchIndex = 0;
  while (true) {
    const index = text.indexOf(term, startIndex);
    if (index === -1) break;
    if (index > startIndex) {
      parts.push(text.slice(startIndex, index));
    }
    parts.push(
      <mark className="admin-review-highlight" key={`match-${matchIndex}`}>
        {term}
      </mark>
    );
    matchIndex += 1;
    startIndex = index + term.length;
  }
  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }
  return parts.length > 0 ? parts : text;
}

function getNodeOptionsForSelection(
  nodes: NodeOption[],
  filtered: NodeOption[],
  selectedId: number | null
) {
  if (!selectedId) return filtered;
  if (filtered.some((node) => node.id === selectedId)) return filtered;
  const selectedNode = nodes.find((node) => node.id === selectedId);
  return selectedNode ? [selectedNode, ...filtered] : filtered;
}

function DeleteNodeDialog({
  node,
  onCancel,
  onConfirm
}: {
  node: NodeOption;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reviewCount = Number(node.review_count ?? 0);
  const edgeCount = Number(node.edge_count ?? 0);
  const blocked = reviewCount > 0 || edgeCount > 0;
  let message = 'Delete this node?';
  if (reviewCount > 0 && edgeCount > 0) {
    message = `Cannot delete: this node has ${reviewCount} review link(s) and ${edgeCount} edge(s).`;
  } else if (reviewCount > 0) {
    message = `Cannot delete: this node has ${reviewCount} review link(s).`;
  } else if (edgeCount > 0) {
    message = `Cannot delete: this node has ${edgeCount} edge(s).`;
  }
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <div className="admin-dialog" role="dialog" aria-modal="true">
        <h3>Delete node</h3>
        <p>{message}</p>
        <div className="button-row">
          <button type="button" onClick={onConfirm} disabled={blocked}>
            Delete
          </button>
          <button type="button" className="button-link button-link--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function parseTypeList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item);
}

function compareText(a: string, b: string) {
  return a.localeCompare(b);
}

function compareNumber(a: number, b: number) {
  return a === b ? 0 : a > b ? 1 : -1;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function nextSort<T extends string>(current: SortState<T>, key: T): SortState<T> {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

function sortIndicator<T extends string>(current: SortState<T>, key: T) {
  if (current.key !== key) return '';
  return current.direction === 'asc' ? 'asc' : 'desc';
}

function edgeKey(edge: Edge) {
  return `${edge.parent_id}-${edge.child_id}-${edge.relation}`;
}

function TypeMultiSelect({
  ariaLabel,
  placeholder,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDetailsElement | null>(null);
  const selected = new Set(parseTypeList(value));
  const selectedList = options.filter((option) => selected.has(option));
  const summaryLabel = selectedList.length > 0 ? selectedList.join(', ') : placeholder;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) return;
      if (!containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  function toggleOption(option: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(option);
    } else {
      next.delete(option);
    }
    const nextList = options.filter((item) => next.has(item));
    onChange(listToString(nextList));
  }

  return (
    <details className="admin-multiselect" open={isOpen} ref={containerRef}>
      <summary
        aria-label={ariaLabel}
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((prev) => !prev);
        }}
      >
        <span className={selectedList.length > 0 ? '' : 'admin-multiselect__placeholder'}>
          {summaryLabel}
        </span>
      </summary>
      <div className="admin-multiselect__panel">
        {options.length === 0 ? (
          <div className="admin-multiselect__empty">No node types available.</div>
        ) : (
          options.map((option) => (
            <label className="admin-multiselect__option" key={option}>
              <input
                type="checkbox"
                checked={selected.has(option)}
                onChange={(event) => toggleOption(option, event.target.checked)}
              />
              <span>{option}</span>
            </label>
          ))
        )}
      </div>
    </details>
  );
}

export default function EdgesAdminPage() {
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeRelations, setEdgeRelations] = useState<EdgeRelation[]>([]);
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([]);
  const [nodeTaxonomy, setNodeTaxonomy] = useState<NodeTaxonomy[]>([]);
  const [reviews, setReviews] = useState<ReviewAdmin[]>([]);
  const [drafts, setDrafts] = useState<DraftEdge[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<DraftNode[]>([]);
  const [edgeRelationDrafts, setEdgeRelationDrafts] = useState<DraftEdgeRelation[]>([]);
  const [nodeTypeDrafts, setNodeTypeDrafts] = useState<DraftNodeType[]>([]);
  const [taxonomyDrafts, setTaxonomyDrafts] = useState<DraftTaxonomy[]>([]);
  const [nodeTaxonomyDrafts, setNodeTaxonomyDrafts] = useState<DraftNodeTaxonomy[]>([]);
  const [editNode, setEditNode] = useState<EditNode | null>(null);
  const [editEdge, setEditEdge] = useState<EditEdge | null>(null);
  const [editEdgeRelation, setEditEdgeRelation] = useState<EditEdgeRelation | null>(null);
  const [editNodeType, setEditNodeType] = useState<EditNodeType | null>(
    null
  );
  const [editTaxonomy, setEditTaxonomy] = useState<EditTaxonomy | null>(null);
  const [editNodeTaxonomy, setEditNodeTaxonomy] = useState<EditNodeTaxonomy | null>(
    null
  );
  const [editReview, setEditReview] = useState<ReviewAdmin | null>(null);
  const [status, setStatus] = useState('');
  const [deleteNodeTarget, setDeleteNodeTarget] = useState<NodeOption | null>(null);
  const [activeTab, setActiveTab] = useState<
    'nodes' | 'edges' | 'taxonomy' | 'reviews' | 'reference'
  >('nodes');
  const [referenceView, setReferenceView] = useState<
    'relations' | 'types' | 'taxonomy'
  >('relations');
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeSearchField, setNodeSearchField] = useState<'name' | 'type'>('name');
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeSearchField, setEdgeSearchField] = useState<
    'parent' | 'child' | 'relation' | 'related'
  >('parent');
  const [nodeTaxonomySearch, setNodeTaxonomySearch] = useState('');
  const [nodeTaxonomySearchField, setNodeTaxonomySearchField] = useState<
    'node' | 'taxonomy' | 'node_type'
  >('node');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSearchField, setReviewSearchField] = useState<
    'node' | 'entity' | 'user' | 'review'
  >('node');
  const [nodeTaxonomyNodeTypeFilter, setNodeTaxonomyNodeTypeFilter] = useState('');
  const [edgeRelatedSuggestOpen, setEdgeRelatedSuggestOpen] = useState(false);
  const [edgeRelatedSelectedId, setEdgeRelatedSelectedId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [nodeTypeSuggestTarget, setNodeTypeSuggestTarget] = useState<'edit' | 'draft' | null>(
    null
  );
  const [nodeTypeFilterActive, setNodeTypeFilterActive] = useState(false);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const [nodeSort, setNodeSort] = useState<
    SortState<'id' | 'name' | 'type' | 'edges' | 'reviews'>
  >({ key: 'name', direction: 'asc' });
  const [edgeSort, setEdgeSort] = useState<
    SortState<'parent' | 'relation' | 'child'>
  >({
    key: 'parent',
    direction: 'asc'
  });
  const [relationSort, setRelationSort] = useState<
    SortState<'parent_types' | 'relation' | 'child_types' | 'ui_priority' | 'max_suggestions'>
  >({
    key: 'relation',
    direction: 'asc'
  });
  const [nodeTypeSort, setNodeTypeSort] = useState<
    SortState<'node_type'>
  >({
    key: 'node_type',
    direction: 'asc'
  });
  const [taxonomySort, setTaxonomySort] = useState<
    SortState<'node_type' | 'key' | 'value' | 'label'>
  >({
    key: 'key',
    direction: 'asc'
  });
  const [nodeTaxonomySort, setNodeTaxonomySort] = useState<
    SortState<'node' | 'taxonomy' | 'label'>
  >({
    key: 'node',
    direction: 'asc'
  });
  const [reviewSort, setReviewSort] = useState<
    SortState<'node' | 'entity' | 'user'>
  >({
    key: 'node',
    direction: 'asc'
  });

  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeOption>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const nodeTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const node of nodes) {
      const value = node.type.trim();
      if (value) seen.add(value);
    }
    for (const nodeType of nodeTypes) {
      const value = nodeType.node_type.trim();
      if (value) seen.add(value);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [nodes, nodeTypes]);

  const nodeOptions = useMemo(() => {
    const list = [...nodes];
    list.sort((a, b) => compareText(a.name.toLowerCase(), b.name.toLowerCase()));
    return list;
  }, [nodes]);

  const filteredNodeOptions = useMemo(() => {
    if (!nodeTaxonomyNodeTypeFilter) return nodeOptions;
    return nodeOptions.filter((node) => node.type === nodeTaxonomyNodeTypeFilter);
  }, [nodeOptions, nodeTaxonomyNodeTypeFilter]);

  const taxonomyOptions = useMemo(() => {
    const list = [...taxonomy];
    list.sort((a, b) => {
      const labelCompare = compareText(
        formatTaxonomyLabel(a.key, a.value).toLowerCase(),
        formatTaxonomyLabel(b.key, b.value).toLowerCase()
      );
      if (labelCompare !== 0) return labelCompare;
      return compareText(a.node_type.toLowerCase(), b.node_type.toLowerCase());
    });
    return list;
  }, [taxonomy]);

  const relationOptions = useMemo(() => {
    return edgeRelations
      .map((relation) => relation.relation)
      .sort((a, b) => a.localeCompare(b));
  }, [edgeRelations]);

  const edgeRelationLookup = useMemo(() => {
    const map = new Map<string, EdgeRelation>();
    for (const relation of edgeRelations) {
      map.set(relation.relation, relation);
    }
    return map;
  }, [edgeRelations]);

  function getNodeType(nodeId: number | null) {
    if (!nodeId) return null;
    return nodeMap.get(nodeId)?.type ?? null;
  }

  function getAllowedRelations(parentId: number | null, childId: number | null) {
    const parentType = getNodeType(parentId);
    const childType = getNodeType(childId);
    if (!parentType && !childType) return relationOptions;
    return relationOptions.filter((relationName) => {
      const relation = edgeRelationLookup.get(relationName);
      if (!relation) return false;
      if (parentType) {
        if (
          relation.allowed_parent_types.length === 0 ||
          !relation.allowed_parent_types.includes(parentType)
        ) {
          return false;
        }
      }
      if (childType) {
        if (
          relation.allowed_child_types.length === 0 ||
          !relation.allowed_child_types.includes(childType)
        ) {
          return false;
        }
      }
      return true;
    });
  }

  function isNodeAllowedForRelation(
    relationName: string,
    kind: 'parent' | 'child',
    nodeId: number | null
  ) {
    if (!relationName || !nodeId) return true;
    const relation = edgeRelationLookup.get(relationName);
    if (!relation) return false;
    const nodeType = getNodeType(nodeId);
    if (!nodeType) return false;
    const allowedTypes =
      kind === 'parent'
        ? relation.allowed_parent_types
        : relation.allowed_child_types;
    if (allowedTypes.length === 0) return false;
    return allowedTypes.includes(nodeType);
  }

  function getAllowedNodes(relationName: string, kind: 'parent' | 'child') {
    if (!relationName) return nodes;
    const relation = edgeRelationLookup.get(relationName);
    const allowedTypes =
      kind === 'parent'
        ? relation?.allowed_parent_types
        : relation?.allowed_child_types;
    if (!allowedTypes || allowedTypes.length === 0) return [];
    const allowedSet = new Set(allowedTypes);
    return nodes.filter((node) => allowedSet.has(node.type));
  }

  const filteredNodes = useMemo(() => {
    const term = nodeSearch.trim().toLowerCase();
    if (!term) return nodes;
    return nodes.filter((node) => {
      const nameMatch = node.name.toLowerCase().includes(term);
      const typeMatch = node.type.toLowerCase().includes(term);
      if (nodeSearchField === 'type') return typeMatch;
      return nameMatch;
    });
  }, [nodes, nodeSearch, nodeSearchField]);

  const sortedNodes = useMemo(() => {
    const list = [...filteredNodes];
    const dir = nodeSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (nodeSort.key === 'id') return compareNumber(a.id, b.id) * dir;
      if (nodeSort.key === 'edges') {
        return compareNumber(a.edge_count ?? 0, b.edge_count ?? 0) * dir;
      }
      if (nodeSort.key === 'reviews') {
        return compareNumber(a.review_count ?? 0, b.review_count ?? 0) * dir;
      }
      if (nodeSort.key === 'type') {
        return compareText(a.type.toLowerCase(), b.type.toLowerCase()) * dir;
      }
      return compareText(a.name.toLowerCase(), b.name.toLowerCase()) * dir;
    });
    return list;
  }, [filteredNodes, nodeSort]);

  const filteredEdgesResult = useMemo(() => {
    const term = edgeSearch.trim().toLowerCase();
    if (edgeSearchField === 'related') {
      if (!term) {
        return {
          edges,
          indirectKeys: new Set<string>(),
          edgeSourceNodeId: new Map<string, number>(),
          searchLabel: edgeSearch.trim()
        };
      }
      const exactMatches = nodes.filter(
        (node) => node.name.toLowerCase() === term
      );
      const exactId = exactMatches.length === 1 ? exactMatches[0].id : null;
      const selectedId = edgeRelatedSelectedId ?? exactId;
      if (!selectedId) {
        return {
          edges: [],
          indirectKeys: new Set<string>(),
          edgeSourceNodeId: new Map<string, number>(),
          searchLabel: edgeSearch.trim()
        };
      }
      const seedIds = new Set([selectedId]);

      const edgeSourceNodeId = new Map<string, number>();
      const directEdges = edges.filter(
        (edge) => edge.parent_id === selectedId || edge.child_id === selectedId
      );
      for (const edge of directEdges) {
        edgeSourceNodeId.set(edgeKey(edge), selectedId);
      }
      return {
        edges: directEdges,
        indirectKeys: new Set<string>(),
        edgeSourceNodeId,
        searchLabel: (() => {
          const seedId = Array.from(seedIds)[0];
          const node = nodeMap.get(seedId);
          return node ? node.name : String(seedId);
        })()
      };
    }

    if (!term) {
      return {
        edges,
        indirectKeys: new Set<string>(),
        edgeSourceNodeId: new Map<string, number>(),
        searchLabel: edgeSearch.trim()
      };
    }
    return {
      edges: edges.filter((edge) => {
        const parent = nodeMap.get(edge.parent_id);
        const child = nodeMap.get(edge.child_id);
        const parentName = parent?.name.toLowerCase() ?? '';
        const childName = child?.name.toLowerCase() ?? '';
        if (edgeSearchField === 'parent') return parentName.includes(term);
        if (edgeSearchField === 'child') return childName.includes(term);
        return edge.relation.toLowerCase().includes(term);
      }),
      indirectKeys: new Set<string>(),
      edgeSourceNodeId: new Map<string, number>(),
      searchLabel: edgeSearch.trim()
    };
  }, [edgeRelations, edges, edgeSearch, edgeSearchField, nodeMap, nodes]);

  const sortedEdges = useMemo(() => {
    const list = [...filteredEdgesResult.edges];
    const dir = edgeSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (edgeSort.key === 'relation') {
        return compareText(a.relation.toLowerCase(), b.relation.toLowerCase()) * dir;
      }
      if (edgeSort.key === 'child') {
        const aName = nodeMap.get(a.child_id)?.name ?? String(a.child_id);
        const bName = nodeMap.get(b.child_id)?.name ?? String(b.child_id);
        return compareText(aName.toLowerCase(), bName.toLowerCase()) * dir;
      }
      const aName = nodeMap.get(a.parent_id)?.name ?? String(a.parent_id);
      const bName = nodeMap.get(b.parent_id)?.name ?? String(b.parent_id);
      return compareText(aName.toLowerCase(), bName.toLowerCase()) * dir;
    });
    return list;
  }, [edgeSort, filteredEdgesResult.edges, nodeMap]);

  const sortedEdgeRelations = useMemo(() => {
    const list = [...edgeRelations];
    const dir = relationSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (relationSort.key === 'ui_priority') {
        if (a.ui_priority === null && b.ui_priority === null) return 0;
        if (a.ui_priority === null) return 1;
        if (b.ui_priority === null) return -1;
        return compareNumber(a.ui_priority, b.ui_priority) * dir;
      }
      if (relationSort.key === 'max_suggestions') {
        if (a.max_suggestions === null && b.max_suggestions === null) return 0;
        if (a.max_suggestions === null) return 1;
        if (b.max_suggestions === null) return -1;
        return compareNumber(a.max_suggestions, b.max_suggestions) * dir;
      }
      if (relationSort.key === 'parent_types') {
        const aLabel = listToString(a.allowed_parent_types).toLowerCase();
        const bLabel = listToString(b.allowed_parent_types).toLowerCase();
        return compareText(aLabel, bLabel) * dir;
      }
      if (relationSort.key === 'child_types') {
        const aLabel = listToString(a.allowed_child_types).toLowerCase();
        const bLabel = listToString(b.allowed_child_types).toLowerCase();
        return compareText(aLabel, bLabel) * dir;
      }
      return compareText(a.relation.toLowerCase(), b.relation.toLowerCase()) * dir;
    });
    return list;
  }, [edgeRelations, relationSort]);

  const sortedNodeTypes = useMemo(() => {
    const list = [...nodeTypes];
    const dir = nodeTypeSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => compareText(a.node_type.toLowerCase(), b.node_type.toLowerCase()) * dir);
    return list;
  }, [nodeTypes, nodeTypeSort]);

  const sortedTaxonomy = useMemo(() => {
    const list = [...taxonomy];
    const dir = taxonomySort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (taxonomySort.key === 'node_type') {
        const nodeTypeCompare =
          compareText(a.node_type.toLowerCase(), b.node_type.toLowerCase()) * dir;
        if (nodeTypeCompare !== 0) return nodeTypeCompare;
      }
      if (taxonomySort.key === 'label') {
        const labelCompare =
          compareText(a.label.toLowerCase(), b.label.toLowerCase()) * dir;
        if (labelCompare !== 0) return labelCompare;
      }
      if (taxonomySort.key === 'value') {
        const valueCompare =
          compareText(a.value.toLowerCase(), b.value.toLowerCase()) * dir;
        if (valueCompare !== 0) return valueCompare;
      }
      const keyCompare = compareText(a.key.toLowerCase(), b.key.toLowerCase()) * dir;
      if (keyCompare !== 0) return keyCompare;
      const nodeTypeCompare =
        compareText(a.node_type.toLowerCase(), b.node_type.toLowerCase()) * dir;
      if (nodeTypeCompare !== 0) return nodeTypeCompare;
      return compareText(a.value.toLowerCase(), b.value.toLowerCase()) * dir;
    });
    return list;
  }, [taxonomy, taxonomySort]);

  const filteredReviews = useMemo(() => {
    const term = reviewSearch.trim().toLowerCase();
    if (!term) return reviews;
    return reviews.filter((review) => {
      if (reviewSearchField === 'entity') {
        return review.entity_name.toLowerCase().includes(term);
      }
      if (reviewSearchField === 'user') {
        return review.user_id.toLowerCase().includes(term);
      }
      if (reviewSearchField === 'review') {
        return review.content.toLowerCase().includes(term);
      }
      const entityLabel = review.entity_id ? nodeMap.get(review.entity_id)?.name ?? '' : '';
      return entityLabel.toLowerCase().includes(term);
    });
  }, [nodeMap, reviewSearch, reviewSearchField, reviews]);

  const sortedReviews = useMemo(() => {
    const list = [...filteredReviews];
    const dir = reviewSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (reviewSort.key === 'entity') {
        return compareText(a.entity_name.toLowerCase(), b.entity_name.toLowerCase()) * dir;
      }
      if (reviewSort.key === 'user') {
        return compareText(a.user_id.toLowerCase(), b.user_id.toLowerCase()) * dir;
      }
      const aEntity = a.entity_id ? nodeMap.get(a.entity_id)?.name ?? '' : '';
      const bEntity = b.entity_id ? nodeMap.get(b.entity_id)?.name ?? '' : '';
      return compareText(aEntity.toLowerCase(), bEntity.toLowerCase()) * dir;
    });
    return list;
  }, [filteredReviews, nodeMap, reviewSort]);

  const filteredNodeTaxonomy = useMemo(() => {
    const term = nodeTaxonomySearch.trim().toLowerCase();
    if (!term) return nodeTaxonomy;
    return nodeTaxonomy.filter((entry) => {
      if (nodeTaxonomySearchField === 'taxonomy') {
        return formatTaxonomyLabel(entry.taxonomy_key, entry.taxonomy_value)
          .toLowerCase()
          .includes(term);
      }
      if (nodeTaxonomySearchField === 'node_type') {
        return entry.node_type.toLowerCase().includes(term);
      }
      return formatNodeLabel(entry.node_name, entry.node_type)
        .toLowerCase()
        .includes(term);
    });
  }, [nodeTaxonomy, nodeTaxonomySearch, nodeTaxonomySearchField]);

  const sortedNodeTaxonomy = useMemo(() => {
    const list = [...filteredNodeTaxonomy];
    const dir = nodeTaxonomySort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (nodeTaxonomySort.key === 'label') {
        return compareText(a.taxonomy_label.toLowerCase(), b.taxonomy_label.toLowerCase()) * dir;
      }
      if (nodeTaxonomySort.key === 'taxonomy') {
        return (
          compareText(
            formatTaxonomyLabel(a.taxonomy_key, a.taxonomy_value).toLowerCase(),
            formatTaxonomyLabel(b.taxonomy_key, b.taxonomy_value).toLowerCase()
          ) * dir
        );
      }
      return (
        compareText(
          formatNodeLabel(a.node_name, a.node_type).toLowerCase(),
          formatNodeLabel(b.node_name, b.node_type).toLowerCase()
        ) * dir
      );
    });
    return list;
  }, [filteredNodeTaxonomy, nodeTaxonomySort]);

  async function loadReviews() {
    const res = await fetch('/api/admin/reviews');
    const data = await res.json().catch(() => ({}));
    setReviews(data.reviews || []);
  }

  async function loadNodes() {
    const res = await fetch('/api/nodes');
    const data = await res.json().catch(() => ({}));
    setNodes(data.nodes || []);
  }

  useEffect(() => {
    loadNodes().catch(() => setNodes([]));
  }, []);

  useEffect(() => {
    loadReviews().catch(() => setReviews([]));
  }, []);

  async function loadEdges() {
    const res = await fetch('/api/edges');
    const data = await res.json().catch(() => ({}));
    setEdges(data.edges || []);
  }

  useEffect(() => {
    loadEdges().catch(() => setEdges([]));
  }, []);

  async function loadEdgeRelations() {
    const res = await fetch('/api/edge-relations');
    const data = await res.json().catch(() => ({}));
    setEdgeRelations(data.relations || []);
  }

  useEffect(() => {
    loadEdgeRelations().catch(() => setEdgeRelations([]));
  }, []);

  async function loadNodeTypes() {
    const res = await fetch('/api/node-type');
    const data = await res.json().catch(() => ({}));
    setNodeTypes(data.node_types || []);
  }

  useEffect(() => {
    loadNodeTypes().catch(() => setNodeTypes([]));
  }, []);

  async function loadTaxonomy() {
    const res = await fetch('/api/taxonomy');
    const data = await res.json().catch(() => ({}));
    setTaxonomy(data.taxonomy || []);
  }

  useEffect(() => {
    loadTaxonomy().catch(() => setTaxonomy([]));
  }, []);

  async function loadNodeTaxonomy() {
    const res = await fetch('/api/node-taxonomy');
    const data = await res.json().catch(() => ({}));
    setNodeTaxonomy(data.node_taxonomy || []);
  }

  useEffect(() => {
    loadNodeTaxonomy().catch(() => setNodeTaxonomy([]));
  }, []);

  useEffect(() => {
    const stickyNode = stickyRef.current;
    if (!stickyNode) return;
    const updateHeight = () => {
      const nextHeight = stickyNode.offsetHeight;
      setStickyHeight(nextHeight);
    };
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(stickyNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setStatus('');
  }, [activeTab]);

  useEffect(() => {
    if (edgeSearchField !== 'related') {
      setEdgeRelatedSelectedId(null);
      setEdgeRelatedSuggestOpen(false);
    }
  }, [edgeSearchField]);

  function addNodeDraft() {
    if (nodeDrafts.length > 0 || editNode) return;
    const draft: DraftNode = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: '',
      type: ''
    };
    setNodeDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addEdgeRelationDraft() {
    if (edgeRelationDrafts.length > 0 || editEdgeRelation) return;
    const draft: DraftEdgeRelation = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      relation: '',
      ui_priority: '',
      max_suggestions: '',
      allowed_parent_types: '',
      allowed_child_types: '',
      description: ''
    };
    setEdgeRelationDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addNodeTypeDraft() {
    if (nodeTypeDrafts.length > 0 || editNodeType) return;
    const draft: DraftNodeType = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      node_type: '',
      description: ''
    };
    setNodeTypeDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addTaxonomyDraft() {
    if (taxonomyDrafts.length > 0 || editTaxonomy) return;
    const draft: DraftTaxonomy = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key: '',
      value: '',
      node_type: '',
      label: '',
      description: ''
    };
    setTaxonomyDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addNodeTaxonomyDraft() {
    if (nodeTaxonomyDrafts.length > 0 || editNodeTaxonomy) return;
    if (nodes.length === 0) {
      setStatus('Add nodes first so taxonomy links can reference them.');
      return;
    }
    if (taxonomy.length === 0) {
      setStatus('Add taxonomy entries first so links can reference them.');
      return;
    }
    const draft: DraftNodeTaxonomy = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      node_id: null,
      taxonomy_id: null
    };
    setNodeTaxonomyDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addDraftRow() {
    if (drafts.length > 0 || editEdge) return;
    if (nodes.length === 0) {
      setStatus('Add nodes first so edges can reference them.');
      return;
    }
    if (edgeRelations.length === 0) {
      setStatus('Add edge relations first so edges can reference them.');
      return;
    }
    const draft: DraftEdge = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parent_id: null,
      child_id: null,
      relation: ''
    };
    setDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function updateDraft(draftId: string, next: Partial<DraftEdge>) {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateNodeDraft(draftId: string, next: Partial<DraftNode>) {
    setNodeDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateEdgeRelationDraft(
    draftId: string,
    next: Partial<DraftEdgeRelation>
  ) {
    setEdgeRelationDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateNodeTypeDraft(draftId: string, next: Partial<DraftNodeType>) {
    setNodeTypeDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateTaxonomyDraft(draftId: string, next: Partial<DraftTaxonomy>) {
    setTaxonomyDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateNodeTaxonomyDraft(
    draftId: string,
    next: Partial<DraftNodeTaxonomy>
  ) {
    setNodeTaxonomyDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateEditNode(next: Partial<NodeOption>) {
    setEditNode((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditEdge(next: Partial<Edge>) {
    setEditEdge((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditEdgeRelation(next: Partial<EditEdgeRelation>) {
    setEditEdgeRelation((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditNodeType(next: Partial<NodeType>) {
    setEditNodeType((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditTaxonomy(next: Partial<EditTaxonomy>) {
    setEditTaxonomy((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditNodeTaxonomy(next: Partial<EditNodeTaxonomy>) {
    setEditNodeTaxonomy((prev) => (prev ? { ...prev, ...next } : prev));
  }

  async function saveNodeDraft(draft: DraftNode) {
    setStatus('');
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        type: draft.type
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || 'Failed to insert node.';
      setStatus(message);
      return;
    }
    setNodeDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId ? { ...item, name: '', type: '' } : item
      )
    );
    await loadNodes();
    await loadNodeTypes();
  }

  async function saveEdgeRelationDraft(draft: DraftEdgeRelation) {
    setStatus('');
    if (!draft.relation.trim()) {
      setStatus('Relation is required.');
      return;
    }
    const allowedParentTypes = parseTypeList(draft.allowed_parent_types);
    const allowedChildTypes = parseTypeList(draft.allowed_child_types);
    if (allowedParentTypes.length === 0 || allowedChildTypes.length === 0) {
      setStatus('Provide allowed parent and child types.');
      return;
    }
    const uiPriorityValue = draft.ui_priority.trim() ? Number(draft.ui_priority) : null;
    if (uiPriorityValue !== null && !Number.isFinite(uiPriorityValue)) {
      setStatus('UI priority must be a number.');
      return;
    }
    const maxSuggestionsValue = draft.max_suggestions.trim()
      ? Number(draft.max_suggestions)
      : null;
    if (maxSuggestionsValue !== null && !Number.isFinite(maxSuggestionsValue)) {
      setStatus('Max suggestions must be a number.');
      return;
    }
    const res = await fetch('/api/edge-relations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relation: draft.relation,
        description: draft.description,
        ui_priority: uiPriorityValue,
        max_suggestions: maxSuggestionsValue,
        allowed_parent_types: allowedParentTypes,
        allowed_child_types: allowedChildTypes
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert relation.');
      return;
    }
    setEdgeRelationDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? {
              ...item,
              relation: '',
              description: '',
              ui_priority: '',
              max_suggestions: '',
              allowed_parent_types: '',
              allowed_child_types: ''
            }
          : item
      )
    );
    await loadEdgeRelations();
  }

  async function saveNodeTypeDraft(draft: DraftNodeType) {
    setStatus('');
    if (!draft.node_type.trim()) {
      setStatus('Node type is required.');
      return;
    }
    const res = await fetch('/api/node-type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: draft.node_type,
        description: draft.description
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert node type.');
      return;
    }
    setNodeTypeDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? { ...item, node_type: '', description: '' }
          : item
      )
    );
    await loadNodeTypes();
  }

  async function saveTaxonomyDraft(draft: DraftTaxonomy) {
    setStatus('');
    if (!draft.node_type.trim()) {
      setStatus('Node type is required.');
      return;
    }
    if (!draft.key.trim() || !draft.value.trim()) {
      setStatus('Key and value are required.');
      return;
    }
    if (!draft.label.trim()) {
      setStatus('Label is required.');
      return;
    }
    const res = await fetch('/api/taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: draft.key,
        value: draft.value,
        node_type: draft.node_type,
        label: draft.label,
        description: draft.description
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert taxonomy.');
      return;
    }
    setTaxonomyDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? { ...item, key: '', value: '', node_type: '', label: '', description: '' }
          : item
      )
    );
    await loadTaxonomy();
  }

  async function saveNodeTaxonomyDraft(draft: DraftNodeTaxonomy) {
    setStatus('');
    if (!draft.node_id || !draft.taxonomy_id) {
      setStatus('Select a node and taxonomy entry.');
      return;
    }
    const res = await fetch('/api/node-taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: draft.node_id,
        taxonomy_id: draft.taxonomy_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert taxonomy link.');
      return;
    }
    setNodeTaxonomyDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? { ...item, node_id: null, taxonomy_id: null }
          : item
      )
    );
    await loadNodeTaxonomy();
  }

  async function saveEditNode(node: EditNode) {
    setStatus('');
    const res = await fetch('/api/nodes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: node.id,
        name: node.name,
        type: node.type,
        original_id: node.original_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update node.');
      return;
    }
    setEditNode(null);
    await loadNodes();
    await loadNodeTypes();
    await loadEdges();
    await loadNodeTaxonomy();
  }

  async function saveEditEdgeRelation(relation: EditEdgeRelation) {
    setStatus('');
    const allowedParentTypes = parseTypeList(relation.allowed_parent_types);
    const allowedChildTypes = parseTypeList(relation.allowed_child_types);
    if (allowedParentTypes.length === 0 || allowedChildTypes.length === 0) {
      setStatus('Provide allowed parent and child types.');
      return;
    }
    const uiPriorityValue =
      relation.ui_priority === null ? null : Number(relation.ui_priority);
    if (uiPriorityValue !== null && !Number.isFinite(uiPriorityValue)) {
      setStatus('UI priority must be a number.');
      return;
    }
    const maxSuggestionsValue =
      relation.max_suggestions === null ? null : Number(relation.max_suggestions);
    if (maxSuggestionsValue !== null && !Number.isFinite(maxSuggestionsValue)) {
      setStatus('Max suggestions must be a number.');
      return;
    }
    const res = await fetch('/api/edge-relations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relation: relation.relation,
        description: relation.description,
        ui_priority: uiPriorityValue,
        max_suggestions: maxSuggestionsValue,
        allowed_parent_types: allowedParentTypes,
        allowed_child_types: allowedChildTypes,
        original_relation: relation.original_relation
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update relation.');
      return;
    }
    setEditEdgeRelation(null);
    await loadEdgeRelations();
    await loadEdges();
  }

  async function saveEditNodeType(nodeType: EditNodeType) {
    setStatus('');
    const res = await fetch('/api/node-type', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: nodeType.node_type,
        description: nodeType.description,
        original_node_type: nodeType.original_node_type
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update node type.');
      return;
    }
    setEditNodeType(null);
    await loadNodeTypes();
    await loadNodes();
    await loadEdges();
  }

  async function saveEditTaxonomy(entry: EditTaxonomy) {
    setStatus('');
    if (!entry.node_type.trim()) {
      setStatus('Node type is required.');
      return;
    }
    if (!entry.key.trim() || !entry.value.trim()) {
      setStatus('Key and value are required.');
      return;
    }
    if (!entry.label.trim()) {
      setStatus('Label is required.');
      return;
    }
    const res = await fetch('/api/taxonomy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        key: entry.key,
        value: entry.value,
        node_type: entry.node_type,
        label: entry.label,
        description: entry.description
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update taxonomy.');
      return;
    }
    setEditTaxonomy(null);
    await loadTaxonomy();
    await loadNodeTaxonomy();
  }

  async function saveEditNodeTaxonomy(entry: EditNodeTaxonomy) {
    setStatus('');
    if (!entry.node_id || !entry.taxonomy_id) {
      setStatus('Select a node and taxonomy entry.');
      return;
    }
    const res = await fetch('/api/node-taxonomy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: entry.node_id,
        taxonomy_id: entry.taxonomy_id,
        original_node_id: entry.original_node_id,
        original_taxonomy_id: entry.original_taxonomy_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update taxonomy link.');
      return;
    }
    setEditNodeTaxonomy(null);
    await loadNodeTaxonomy();
  }

  async function saveEditReview(review: ReviewAdmin) {
    setStatus('');
    const res = await fetch('/api/admin/reviews', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: review.id,
        entity_id: review.entity_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update review.');
      return;
    }
    setEditReview(null);
    await loadReviews();
  }

  function startEditReview(review: ReviewAdmin) {
    setEditReview({ ...review });
  }

  function cancelEditReview() {
    setEditReview(null);
  }

  async function deleteNode(node: NodeOption) {
    setStatus('');
    setDeleteNodeTarget(node);
  }

  async function confirmDeleteNode() {
    if (!deleteNodeTarget) return;
    const reviewCount = Number(deleteNodeTarget.review_count ?? 0);
    const edgeCount = Number(deleteNodeTarget.edge_count ?? 0);
    if (reviewCount > 0 || edgeCount > 0) {
      return;
    }
    const res = await fetch('/api/nodes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...deleteNodeTarget, force: false })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete node.');
      return;
    }
    setEditNode(null);
    setDeleteNodeTarget(null);
    await loadNodes();
    await loadEdges();
    await loadNodeTaxonomy();
  }

  async function saveDraft(draft: DraftEdge) {
    setStatus('');
    if (!draft.parent_id || !draft.child_id || !draft.relation) {
      setStatus('Select parent, child, and relation.');
      return;
    }
    const res = await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: draft.parent_id,
        child_id: draft.child_id,
        relation: draft.relation
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || 'Failed to insert edge.';
      setStatus(message);
      return;
    }
    setDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? { ...item, parent_id: null, child_id: null, relation: '' }
          : item
      )
    );
    await loadEdges();
  }

  function removeDraft(draftId: string) {
    setDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeNodeDraft(draftId: string) {
    setNodeDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeEdgeRelationDraft(draftId: string) {
    setEdgeRelationDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeNodeTypeDraft(draftId: string) {
    setNodeTypeDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeTaxonomyDraft(draftId: string) {
    setTaxonomyDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeNodeTaxonomyDraft(draftId: string) {
    setNodeTaxonomyDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function startEditNode(node: NodeOption) {
    if (nodeDrafts.length > 0) return;
    setMergeTargetId(null);
    setEditNode({
      ...node,
      original_id: node.id
    });
  }

  function cancelEditNode() {
    setEditNode(null);
    setMergeTargetId(null);
  }

  async function mergeNode(sourceId: number) {
    if (!mergeTargetId) {
      setStatus('Select a merge target.');
      return;
    }
    if (mergeTargetId === sourceId) {
      setStatus('Merge target must be different from source.');
      return;
    }
    const source = nodes.find((node) => node.id === sourceId);
    const target = nodes.find((node) => node.id === mergeTargetId);
    const message = `Merge ${source?.name ?? sourceId} into ${target?.name ?? mergeTargetId}? This will move reviews and edges to the target.`;
    if (!window.confirm(message)) return;
    setStatus('');
    const res = await fetch('/api/nodes/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, target_id: mergeTargetId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to merge node.');
      return;
    }
    setEditNode(null);
    setMergeTargetId(null);
    await loadNodes();
    await loadEdges();
  }

  function startEditEdgeRelation(relation: EdgeRelation) {
    if (edgeRelationDrafts.length > 0) return;
    setEditEdgeRelation({
      relation: relation.relation,
      original_relation: relation.relation,
      ui_priority: relation.ui_priority,
      max_suggestions: relation.max_suggestions,
      allowed_parent_types: listToString(relation.allowed_parent_types),
      allowed_child_types: listToString(relation.allowed_child_types),
      description: relation.description ?? ''
    });
  }

  function cancelEditEdgeRelation() {
    setEditEdgeRelation(null);
  }

  function startEditNodeType(nodeType: NodeType) {
    if (nodeTypeDrafts.length > 0) return;
    setEditNodeType({
      ...nodeType,
      description: nodeType.description ?? '',
      original_node_type: nodeType.node_type
    });
  }

  function startEditTaxonomy(entry: Taxonomy) {
    if (taxonomyDrafts.length > 0) return;
    setEditTaxonomy({
      id: entry.id,
      key: entry.key,
      value: entry.value,
      node_type: entry.node_type,
      label: entry.label,
      description: entry.description ?? ''
    });
  }

  function startEditNodeTaxonomy(entry: NodeTaxonomy) {
    if (nodeTaxonomyDrafts.length > 0) return;
    setEditNodeTaxonomy({
      node_id: entry.node_id,
      taxonomy_id: entry.taxonomy_id,
      original_node_id: entry.node_id,
      original_taxonomy_id: entry.taxonomy_id
    });
  }

  function cancelEditNodeType() {
    setEditNodeType(null);
  }

  function cancelEditTaxonomy() {
    setEditTaxonomy(null);
  }

  function cancelEditNodeTaxonomy() {
    setEditNodeTaxonomy(null);
  }

  async function deleteEdgeRelation(relation: { relation: string }) {
    setStatus('');
    if (!window.confirm('Delete this relation?')) return;
    const res = await fetch('/api/edge-relations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relation: relation.relation })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete relation.');
      return;
    }
    setEditEdgeRelation(null);
    await loadEdgeRelations();
    await loadEdges();
  }

  async function deleteNodeType(nodeType: NodeType) {
    setStatus('');
    if (!window.confirm('Delete this node type?')) return;
    const res = await fetch('/api/node-type', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_type: nodeType.node_type })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete node type.');
      return;
    }
    setEditNodeType(null);
    await loadNodeTypes();
    await loadNodes();
    await loadEdges();
  }

  async function deleteTaxonomy(entry: { id: number }) {
    setStatus('');
    if (!window.confirm('Delete this taxonomy entry?')) return;
    const res = await fetch('/api/taxonomy', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete taxonomy.');
      return;
    }
    setEditTaxonomy(null);
    await loadTaxonomy();
  }

  async function deleteNodeTaxonomy(entry: { node_id: number; taxonomy_id: number }) {
    setStatus('');
    if (!window.confirm('Delete this taxonomy link?')) return;
    const res = await fetch('/api/node-taxonomy', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: entry.node_id,
        taxonomy_id: entry.taxonomy_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete taxonomy link.');
      return;
    }
    setEditNodeTaxonomy(null);
    await loadNodeTaxonomy();
  }

  async function saveEditEdge(edge: EditEdge) {
    setStatus('');
    const res = await fetch('/api/edges', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: edge.parent_id,
        child_id: edge.child_id,
        relation: edge.relation,
        original_parent_id: edge.original_parent_id,
        original_child_id: edge.original_child_id,
        original_relation: edge.original_relation
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update edge.');
      return;
    }
    setEditEdge(null);
    await loadEdges();
  }

  async function deleteEdge(edge: Edge) {
    setStatus('');
    const parentCount = edge.parent_review_count ?? 0;
    const childCount = edge.child_review_count ?? 0;
    const message =
      parentCount > 0 || childCount > 0
        ? `This edge touches ${parentCount + childCount} reviewed node link(s). Delete anyway?`
        : 'Delete this edge?';
    if (!window.confirm(message)) return;
    const res = await fetch('/api/edges', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: edge.parent_id,
        child_id: edge.child_id,
        relation: edge.relation,
        force: parentCount > 0 || childCount > 0
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete edge.');
      return;
    }
    setEditEdge(null);
    await loadEdges();
  }

  function startEditEdge(edge: Edge) {
    if (drafts.length > 0) return;
    setEditEdge({
      ...edge,
      original_parent_id: edge.parent_id,
      original_child_id: edge.child_id,
      original_relation: edge.relation
    });
  }

  function cancelEditEdge() {
    setEditEdge(null);
  }

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Admin</h1>
            <small>Manage nodes and relationships.</small>
          </div>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'nodes'}
            className={`admin-tab ${activeTab === 'nodes' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('nodes')}
          >
            <strong>Nodes</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edges'}
            className={`admin-tab ${activeTab === 'edges' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('edges')}
          >
            <strong>Edges</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'taxonomy'}
            className={`admin-tab ${activeTab === 'taxonomy' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('taxonomy')}
          >
            <strong>Taxonomy</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            className={`admin-tab ${activeTab === 'reviews' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <strong>Reviews</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reference'}
            className={`admin-tab ${activeTab === 'reference' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('reference')}
          >
            <strong>Reference</strong>
          </button>
        </div>

        {activeTab === 'nodes' && (
          <>
            {editNode ? (
              <div className="row review-footer admin-row admin-row--form admin-row--form-node admin-form">
                <div>
                  <input
                    aria-label="Node name"
                    placeholder="Name"
                    value={editNode.name}
                    onChange={(event) =>
                      updateEditNode({ name: event.target.value })
                    }
                  />
                </div>
                <div>
                  <div className="admin-type-input">
                    <input
                      aria-label="Node type"
                      placeholder="Type"
                      value={editNode.type}
                      onChange={(event) => {
                        updateEditNode({ type: event.target.value });
                        setNodeTypeSuggestTarget('edit');
                        setNodeTypeFilterActive(true);
                      }}
                      onFocus={() => {
                        setNodeTypeSuggestTarget('edit');
                        setNodeTypeFilterActive(false);
                      }}
                      onBlur={() => {
                        setNodeTypeSuggestTarget(null);
                        setNodeTypeFilterActive(false);
                      }}
                    />
                    {nodeTypeSuggestTarget === 'edit' && nodeTypeOptions.length > 0 && (
                      <div className="admin-type-suggestions">
                        {nodeTypeOptions
                          .filter((type) => {
                            const term = editNode.type.trim().toLowerCase();
                            if (!nodeTypeFilterActive || !term) return true;
                            return type.toLowerCase().includes(term);
                          })
                          .map((type) => (
                            <button
                              type="button"
                              key={type}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                updateEditNode({ type });
                                setNodeTypeSuggestTarget(null);
                              }}
                            >
                              {type}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="admin-row__actions admin-row__actions--form admin-row__actions--node">
                  <div className="button-row button-row--node-actions">
                    <button type="button" onClick={() => saveEditNode(editNode)}>
                      Update
                    </button>
                    <button type="button" onClick={() => deleteNode(editNode)}>
                      Delete
                    </button>
                    {nodes.length > 1 && (
                      <span className="merge-controls">
                        <button type="button" onClick={() => mergeNode(editNode.id)}>
                          Merge into
                        </button>
                        <select
                          aria-label="Merge target"
                          className="merge-target-select"
                          value={mergeTargetId ?? ''}
                          onChange={(event) =>
                            setMergeTargetId(
                              event.target.value ? Number(event.target.value) : null
                            )
                          }
                        >
                          <option value=""></option>
                          {nodes
                            .filter((node) => node.id !== editNode.id)
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.name} ({node.type})
                              </option>
                            ))}
                        </select>
                      </span>
                    )}
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={cancelEditNode}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : nodeDrafts.length > 0 ? (
              nodeDrafts.map((draft) => (
                <div
                  className="row review-footer admin-row admin-row--form admin-row--form-node admin-form"
                  key={draft.draftId}
                >
                  <div>
                    <input
                      aria-label="Node name"
                      placeholder="Name"
                      value={draft.name}
                      onChange={(event) =>
                        updateNodeDraft(draft.draftId, { name: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <div className="admin-type-input">
                      <input
                        aria-label="Node type"
                        placeholder="Type"
                        value={draft.type}
                        onChange={(event) => {
                          updateNodeDraft(draft.draftId, { type: event.target.value });
                          setNodeTypeSuggestTarget('draft');
                          setNodeTypeFilterActive(true);
                        }}
                        onFocus={() => {
                          setNodeTypeSuggestTarget('draft');
                          setNodeTypeFilterActive(false);
                        }}
                        onBlur={() => {
                          setNodeTypeSuggestTarget(null);
                          setNodeTypeFilterActive(false);
                        }}
                      />
                      {nodeTypeSuggestTarget === 'draft' && nodeTypeOptions.length > 0 && (
                        <div className="admin-type-suggestions">
                          {nodeTypeOptions
                            .filter((type) => {
                              const term = draft.type.trim().toLowerCase();
                              if (!nodeTypeFilterActive || !term) return true;
                              return type.toLowerCase().includes(term);
                            })
                            .map((type) => (
                              <button
                                type="button"
                                key={type}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  updateNodeDraft(draft.draftId, { type });
                                  setNodeTypeSuggestTarget(null);
                                }}
                              >
                                {type}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="admin-row__actions admin-row__actions--form">
                    <div className="button-row">
                      <button type="button" onClick={() => saveNodeDraft(draft)}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--ghost"
                        onClick={() => removeNodeDraft(draft.draftId)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-toolbar">
                <select
                  className="admin-toolbar__select"
                  aria-label="Filter node search field"
                  value={nodeSearchField}
                  onChange={(event) =>
                    setNodeSearchField(event.target.value as 'name' | 'type')
                  }
                >
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                </select>
                <input
                  placeholder="Search nodes"
                  value={nodeSearch}
                  onChange={(event) => setNodeSearch(event.target.value)}
                />
                <button
                  type="button"
                  onClick={addNodeDraft}
                  disabled={nodeDrafts.length > 0 || !!editNode}
                >
                  Insert new
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'edges' && (
          <>
            {editEdge ? (
              <div className="row review-footer admin-row admin-row--form admin-row--form-edge admin-form">
                <div>
                  <select
                    aria-label="Parent node"
                    value={editEdge.parent_id}
                    onChange={(event) =>
                      (() => {
                        const nextParentId = Number(event.target.value);
                        const nextRelations = getAllowedRelations(
                          nextParentId,
                          editEdge.child_id
                        );
                        updateEditEdge({
                          parent_id: nextParentId,
                          relation: nextRelations.includes(editEdge.relation)
                            ? editEdge.relation
                            : ''
                        });
                      })()
                    }
                  >
                    {getAllowedNodes(editEdge.relation, 'parent').map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    aria-label="Relation"
                    value={editEdge.relation}
                    onChange={(event) =>
                      updateEditEdge({
                        relation: event.target.value
                      })
                    }
                  >
                    <option value="">Select relation</option>
                    {getAllowedRelations(editEdge.parent_id, editEdge.child_id).map(
                      (relation) => (
                        <option key={relation} value={relation}>
                          {relation}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <select
                    aria-label="Child node"
                    value={editEdge.child_id}
                    onChange={(event) =>
                      (() => {
                        const nextChildId = Number(event.target.value);
                        const nextRelations = getAllowedRelations(
                          editEdge.parent_id,
                          nextChildId
                        );
                        updateEditEdge({
                          child_id: nextChildId,
                          relation: nextRelations.includes(editEdge.relation)
                            ? editEdge.relation
                            : ''
                        });
                      })()
                    }
                  >
                    {getAllowedNodes(editEdge.relation, 'child').map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-row__actions admin-row__actions--form">
                  <div className="button-row">
                    <button type="button" onClick={() => saveEditEdge(editEdge)}>
                      Update
                    </button>
                    <button type="button" onClick={() => deleteEdge(editEdge)}>
                      Delete
                    </button>
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={cancelEditEdge}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : drafts.length > 0 ? (
              drafts.map((draft) => (
                <div
                  className="row review-footer admin-row admin-row--form admin-row--form-edge admin-form"
                  key={draft.draftId}
                >
                <div>
                  <select
                    className={draft.parent_id ? '' : 'admin-select--placeholder'}
                    aria-label="Parent node"
                    value={draft.parent_id ?? ''}
                    onChange={(event) =>
                      (() => {
                        const nextParentId = event.target.value
                          ? Number(event.target.value)
                          : null;
                        const nextRelations = getAllowedRelations(
                          nextParentId,
                          draft.child_id
                        );
                        updateDraft(draft.draftId, {
                          parent_id: nextParentId,
                          relation: nextRelations.includes(draft.relation)
                            ? draft.relation
                            : ''
                        });
                      })()
                    }
                  >
                    <option value="">Select parent</option>
                    {getAllowedNodes(draft.relation, 'parent').map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    className={draft.relation ? '' : 'admin-select--placeholder'}
                    aria-label="Relation"
                    value={draft.relation}
                    onChange={(event) =>
                      (() => {
                        const nextRelation = event.target.value;
                        let nextParentId = draft.parent_id;
                        let nextChildId = draft.child_id;
                        if (nextRelation) {
                          if (
                            !isNodeAllowedForRelation(
                              nextRelation,
                              'parent',
                              nextParentId
                            )
                          ) {
                            nextParentId = null;
                          }
                          if (
                            !isNodeAllowedForRelation(
                              nextRelation,
                              'child',
                              nextChildId
                            )
                          ) {
                            nextChildId = null;
                          }
                        }
                        updateDraft(draft.draftId, {
                          relation: nextRelation,
                          parent_id: nextParentId,
                          child_id: nextChildId
                        });
                      })()
                    }
                  >
                    <option value="">Select relation</option>
                    {getAllowedRelations(draft.parent_id, draft.child_id).map(
                      (relation) => (
                      <option key={relation} value={relation}>
                        {relation}
                      </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <select
                    className={draft.child_id ? '' : 'admin-select--placeholder'}
                    aria-label="Child node"
                    value={draft.child_id ?? ''}
                    onChange={(event) =>
                      (() => {
                        const nextChildId = event.target.value
                          ? Number(event.target.value)
                          : null;
                        const nextRelations = getAllowedRelations(
                          draft.parent_id,
                          nextChildId
                        );
                        updateDraft(draft.draftId, {
                          child_id: nextChildId,
                          relation: nextRelations.includes(draft.relation)
                            ? draft.relation
                            : ''
                        });
                      })()
                    }
                  >
                    <option value="">Select child</option>
                    {getAllowedNodes(draft.relation, 'child').map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.type})
                      </option>
                    ))}
                  </select>
                  </div>
                <div className="admin-row__actions admin-row__actions--form">
                  <div className="button-row">
                    <button type="button" onClick={() => saveDraft(draft)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={() => removeDraft(draft.draftId)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="admin-toolbar">
                <select
                  className="admin-toolbar__select"
                  aria-label="Filter edge search field"
                  value={edgeSearchField}
                  onChange={(event) =>
                    setEdgeSearchField(
                      event.target.value as 'parent' | 'child' | 'relation' | 'related'
                    )
                  }
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="relation">Relation</option>
                  <option value="related">Related</option>
                </select>
                <div className="admin-type-input">
                  <input
                    placeholder="Search edges"
                    value={edgeSearch}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setEdgeSearch(nextValue);
                      if (edgeSearchField === 'related' && edgeRelatedSelectedId) {
                        const selectedName =
                          nodeMap.get(edgeRelatedSelectedId)?.name ?? '';
                        if (nextValue.trim() !== selectedName) {
                          setEdgeRelatedSelectedId(null);
                        }
                      }
                    }}
                    onFocus={() => {
                      if (edgeSearchField === 'related') {
                        setEdgeRelatedSuggestOpen(true);
                      }
                    }}
                    onBlur={() => {
                      setEdgeRelatedSuggestOpen(false);
                    }}
                  />
                  {edgeSearchField === 'related' && edgeRelatedSuggestOpen && (
                    <div className="admin-type-suggestions">
                      {nodes
                        .filter((node) => {
                          const term = edgeSearch.trim().toLowerCase();
                          if (!term) return true;
                          return node.name.toLowerCase().includes(term);
                        })
                        .map((node) => (
                          <button
                            type="button"
                            key={node.id}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setEdgeSearch(node.name);
                              setEdgeRelatedSelectedId(node.id);
                              setEdgeRelatedSuggestOpen(false);
                            }}
                          >
                            {node.name} ({node.type})
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addDraftRow}
                  disabled={drafts.length > 0 || !!editEdge}
                >
                  Insert new
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'taxonomy' && (
          <>
            {editNodeTaxonomy ? (
              <div className="admin-toolbar">
                  <select
                    className="admin-toolbar__select"
                    aria-label="Filter nodes by type"
                    value={nodeTaxonomyNodeTypeFilter}
                    onChange={(event) =>
                      setNodeTaxonomyNodeTypeFilter(event.target.value)
                    }
                  >
                    <option value="">All node types</option>
                    {nodeTypeOptions.map((nodeType) => (
                      <option key={nodeType} value={nodeType}>
                        {nodeType}
                      </option>
                    ))}
                  </select>
                <div className="row review-footer admin-row admin-row--form admin-row--form-node-taxonomy admin-form">
                <div>
                  <select
                    aria-label="Node"
                    value={editNodeTaxonomy.node_id}
                    onChange={(event) =>
                      (() => {
                        const nextNodeId = Number(event.target.value);
                        const nextNodeType = getNodeTypeById(nodes, nextNodeId);
                        const currentTaxonomy = taxonomy.find(
                          (entry) => entry.id === editNodeTaxonomy.taxonomy_id
                        );
                        updateEditNodeTaxonomy({
                          node_id: nextNodeId,
                          taxonomy_id:
                            currentTaxonomy && currentTaxonomy.node_type === nextNodeType
                              ? editNodeTaxonomy.taxonomy_id
                              : 0
                        });
                      })()
                    }
                  >
                    {getNodeOptionsForSelection(
                      nodes,
                      filteredNodeOptions,
                      editNodeTaxonomy.node_id
                    ).map((node) => (
                      <option key={node.id} value={node.id}>
                        {formatNodeLabel(node.name, node.type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    aria-label="Taxonomy"
                    className={editNodeTaxonomy.taxonomy_id ? '' : 'admin-select--placeholder'}
                    value={editNodeTaxonomy.taxonomy_id}
                    onChange={(event) =>
                      updateEditNodeTaxonomy({
                        taxonomy_id: Number(event.target.value)
                      })
                    }
                  >
                    <option value={0} disabled>
                      Select taxonomy
                    </option>
                    {taxonomyOptions
                      .filter((entry) => {
                        const nodeType = getNodeTypeById(
                          nodes,
                          editNodeTaxonomy.node_id
                        );
                        return nodeType ? entry.node_type === nodeType : false;
                      })
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {formatTaxonomyLabel(entry.key, entry.value)}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="admin-row__actions admin-row__actions--form">
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => saveEditNodeTaxonomy(editNodeTaxonomy)}
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNodeTaxonomy(editNodeTaxonomy)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={cancelEditNodeTaxonomy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
              </div>
            ) : nodeTaxonomyDrafts.length > 0 ? (
              nodeTaxonomyDrafts.map((draft) => (
                <div className="admin-toolbar" key={draft.draftId}>
                    <select
                      className="admin-toolbar__select"
                      aria-label="Filter nodes by type"
                      value={nodeTaxonomyNodeTypeFilter}
                      onChange={(event) =>
                        setNodeTaxonomyNodeTypeFilter(event.target.value)
                      }
                    >
                      <option value="">All node types</option>
                      {nodeTypeOptions.map((nodeType) => (
                        <option key={nodeType} value={nodeType}>
                          {nodeType}
                        </option>
                      ))}
                    </select>
                <div
                  className="row review-footer admin-row admin-row--form admin-row--form-node-taxonomy admin-form"
                >
                  <div>
                    <select
                      className={draft.node_id ? '' : 'admin-select--placeholder'}
                      aria-label="Node"
                      value={draft.node_id ?? ''}
                      onChange={(event) =>
                        (() => {
                          const nextNodeId = event.target.value
                            ? Number(event.target.value)
                            : null;
                          const nextNodeType = getNodeTypeById(nodes, nextNodeId);
                          const currentTaxonomy = taxonomy.find(
                            (entry) => entry.id === draft.taxonomy_id
                          );
                          updateNodeTaxonomyDraft(draft.draftId, {
                            node_id: nextNodeId,
                            taxonomy_id:
                              currentTaxonomy && currentTaxonomy.node_type === nextNodeType
                                ? draft.taxonomy_id
                                : null
                          });
                        })()
                      }
                    >
                      <option value="">Select node</option>
                      {getNodeOptionsForSelection(
                        nodes,
                        filteredNodeOptions,
                        draft.node_id
                      ).map((node) => (
                        <option key={node.id} value={node.id}>
                          {formatNodeLabel(node.name, node.type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      className={draft.taxonomy_id ? '' : 'admin-select--placeholder'}
                      aria-label="Taxonomy"
                      value={draft.taxonomy_id ?? ''}
                      onChange={(event) =>
                        updateNodeTaxonomyDraft(draft.draftId, {
                          taxonomy_id: event.target.value
                            ? Number(event.target.value)
                            : null
                        })
                      }
                    >
                      <option value="">Select taxonomy</option>
                      {taxonomyOptions
                        .filter((entry) => {
                          const nodeType = getNodeTypeById(nodes, draft.node_id);
                          return nodeType ? entry.node_type === nodeType : false;
                        })
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {formatTaxonomyLabel(entry.key, entry.value)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="admin-row__actions admin-row__actions--form">
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => saveNodeTaxonomyDraft(draft)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--ghost"
                        onClick={() => removeNodeTaxonomyDraft(draft.draftId)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
                </div>
              ))
            ) : (
              <div className="admin-toolbar">
                <select
                  className="admin-toolbar__select"
                  aria-label="Filter taxonomy search field"
                  value={nodeTaxonomySearchField}
                  onChange={(event) =>
                    setNodeTaxonomySearchField(
                      event.target.value as 'node' | 'taxonomy' | 'node_type'
                    )
                  }
                >
                  <option value="node">Node</option>
                  <option value="taxonomy">Taxonomy</option>
                  <option value="node_type">Node type</option>
                </select>
                <input
                  placeholder="Search taxonomy links"
                  value={nodeTaxonomySearch}
                  onChange={(event) => setNodeTaxonomySearch(event.target.value)}
                />
                <button
                  type="button"
                  onClick={addNodeTaxonomyDraft}
                  disabled={nodeTaxonomyDrafts.length > 0 || !!editNodeTaxonomy}
                >
                  Insert new
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'reviews' && (
          <>
            {editReview ? (
              <>
                <div className="row review-footer admin-row admin-row--form admin-row--form-review admin-form">
                  <div>
                    <select
                      className={editReview.entity_id ? '' : 'admin-select--placeholder'}
                      aria-label="Linked node"
                      value={editReview.entity_id ?? ''}
                      onChange={(event) =>
                        setEditReview((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            entity_id: event.target.value
                              ? Number(event.target.value)
                              : null
                          };
                        })
                      }
                    >
                      <option value="">Unlinked</option>
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      aria-label="Entity name"
                      value={editReview.entity_name}
                      disabled
                      className="admin-input--readonly"
                    />
                  </div>
                  <div>
                    <input
                      aria-label="User id"
                      value={editReview.user_id}
                      disabled
                      className="admin-input--readonly"
                    />
                  </div>
                  <div>
                    <input
                      aria-label="Updated at"
                      value={formatTimestamp(editReview.updated_at ?? editReview.created_at)}
                      disabled
                      className="admin-input--readonly"
                    />
                  </div>
                  <div className="admin-row__actions admin-row__actions--form">
                    <div className="button-row">
                      <button type="button" onClick={() => saveEditReview(editReview)}>
                        Update
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--ghost"
                        onClick={cancelEditReview}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
                <div className="admin-form">
                  <div
                    className="admin-review-content admin-textarea--compact admin-textarea--readonly"
                    aria-label="Review content"
                  >
                    {highlightText(editReview.content, reviewSearch.trim())}
                  </div>
                </div>
              </>
            ) : (
              <div className="admin-toolbar">
                <select
                  className="admin-toolbar__select"
                  aria-label="Filter review search field"
                  value={reviewSearchField}
                  onChange={(event) =>
                    setReviewSearchField(
                      event.target.value as 'node' | 'entity' | 'user' | 'review'
                    )
                  }
                >
                  <option value="node">Node</option>
                  <option value="entity">Entity</option>
                  <option value="user">User</option>
                  <option value="review">Review</option>
                </select>
                <input
                  placeholder="Search reviews"
                  value={reviewSearch}
                  onChange={(event) => setReviewSearch(event.target.value)}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'reference' && (
          <>
            <div className="admin-toolbar admin-toolbar--reference">
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="reference-view"
                  checked={referenceView === 'types'}
                  onChange={() => setReferenceView('types')}
                />
                <span>Node types</span>
              </label>
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="reference-view"
                  checked={referenceView === 'relations'}
                  onChange={() => setReferenceView('relations')}
                />
                <span>Edge relations</span>
              </label>
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="reference-view"
                  checked={referenceView === 'taxonomy'}
                  onChange={() => setReferenceView('taxonomy')}
                />
                <span>Taxonomy types</span>
              </label>
            </div>

            {referenceView === 'types' && (
              <>
                {editNodeType ? (
                  <>
                    <div className="row review-footer admin-row admin-row--form admin-row--form-node-type admin-form">
                      <div>
                        <input
                          aria-label="Node type"
                          placeholder="Node type"
                          value={editNodeType.node_type}
                          onChange={(event) =>
                            updateEditNodeType({ node_type: event.target.value })
                          }
                        />
                      </div>
                      <div className="admin-row__actions admin-row__actions--form">
                        <div className="button-row">
                          <button type="button" onClick={() => saveEditNodeType(editNodeType)}>
                            Update
                          </button>
                          <button type="button" onClick={() => deleteNodeType(editNodeType)}>
                            Delete
                          </button>
                          <button
                            type="button"
                            className="button-link button-link--ghost"
                            onClick={cancelEditNodeType}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="admin-form">
                      <textarea
                        className="admin-textarea--compact"
                        aria-label="Node type description"
                        placeholder="Description"
                        rows={2}
                        value={editNodeType.description ?? ''}
                        onChange={(event) =>
                          updateEditNodeType({ description: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : nodeTypeDrafts.length > 0 ? (
                  nodeTypeDrafts.map((draft) => (
                    <Fragment key={draft.draftId}>
                      <div className="row review-footer admin-row admin-row--form admin-row--form-node-type admin-form">
                        <div>
                          <input
                            aria-label="Node type"
                            placeholder="Node type"
                            value={draft.node_type}
                            onChange={(event) =>
                              updateNodeTypeDraft(draft.draftId, {
                                node_type: event.target.value
                              })
                            }
                          />
                        </div>
                        <div className="admin-row__actions admin-row__actions--form">
                          <div className="button-row">
                            <button type="button" onClick={() => saveNodeTypeDraft(draft)}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="button-link button-link--ghost"
                              onClick={() => removeNodeTypeDraft(draft.draftId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="admin-form">
                        <textarea
                          className="admin-textarea--compact"
                          aria-label="Node type description"
                          placeholder="Description"
                          rows={2}
                          value={draft.description}
                          onChange={(event) =>
                            updateNodeTypeDraft(draft.draftId, {
                              description: event.target.value
                            })
                          }
                        />
                      </div>
                    </Fragment>
                  ))
                ) : (
                  <div className="admin-toolbar">
                    <button
                      type="button"
                      onClick={addNodeTypeDraft}
                      disabled={nodeTypeDrafts.length > 0 || !!editNodeType}
                    >
                      Insert new
                    </button>
                  </div>
                )}
              </>
            )}

            {referenceView === 'relations' && (
              <>
                {editEdgeRelation ? (
                  <>
                    <div className="row review-footer admin-row admin-row--form admin-row--form-relation admin-form">
                      <div>
                        <TypeMultiSelect
                          ariaLabel="Allowed parent types"
                          placeholder="Select parent types"
                          options={nodeTypeOptions}
                          value={editEdgeRelation.allowed_parent_types}
                          onChange={(nextValue) =>
                            updateEditEdgeRelation({
                              allowed_parent_types: nextValue
                            })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="Relation"
                          placeholder="Relation"
                          value={editEdgeRelation.relation}
                          onChange={(event) =>
                            updateEditEdgeRelation({ relation: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <TypeMultiSelect
                          ariaLabel="Allowed child types"
                          placeholder="Select child types"
                          options={nodeTypeOptions}
                          value={editEdgeRelation.allowed_child_types}
                          onChange={(nextValue) =>
                            updateEditEdgeRelation({
                              allowed_child_types: nextValue
                            })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="UI priority"
                          placeholder="UI priority"
                          type="number"
                          step="1"
                          value={editEdgeRelation.ui_priority ?? ''}
                          onChange={(event) =>
                            updateEditEdgeRelation({
                              ui_priority: event.target.value
                                ? Number(event.target.value)
                                : null
                            })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="Max suggestions"
                          placeholder="Max suggestions"
                          type="number"
                          step="1"
                          value={editEdgeRelation.max_suggestions ?? ''}
                          onChange={(event) =>
                            updateEditEdgeRelation({
                              max_suggestions: event.target.value
                                ? Number(event.target.value)
                                : null
                            })
                          }
                        />
                      </div>
                      <div className="admin-row__actions admin-row__actions--form">
                        <div className="button-row">
                          <button
                            type="button"
                            onClick={() => saveEditEdgeRelation(editEdgeRelation)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEdgeRelation(editEdgeRelation)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="button-link button-link--ghost"
                            onClick={cancelEditEdgeRelation}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="admin-form">
                      <textarea
                        className="admin-textarea--compact"
                        aria-label="Relation description"
                        placeholder="Description"
                        rows={2}
                        value={editEdgeRelation.description}
                        onChange={(event) =>
                          updateEditEdgeRelation({ description: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : edgeRelationDrafts.length > 0 ? (
                  edgeRelationDrafts.map((draft) => (
                    <Fragment key={draft.draftId}>
                      <div className="row review-footer admin-row admin-row--form admin-row--form-relation admin-form">
                        <div>
                          <TypeMultiSelect
                            ariaLabel="Allowed parent types"
                            placeholder="Select parent types"
                            options={nodeTypeOptions}
                            value={draft.allowed_parent_types}
                            onChange={(nextValue) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                allowed_parent_types: nextValue
                              })
                            }
                          />
                        </div>
                        <div>
                          <input
                            aria-label="Relation"
                            placeholder="Relation"
                            value={draft.relation}
                            onChange={(event) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                relation: event.target.value
                              })
                            }
                          />
                        </div>
                        <div>
                          <TypeMultiSelect
                            ariaLabel="Allowed child types"
                            placeholder="Select child types"
                            options={nodeTypeOptions}
                            value={draft.allowed_child_types}
                            onChange={(nextValue) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                allowed_child_types: nextValue
                              })
                            }
                          />
                        </div>
                        <div>
                          <input
                            aria-label="UI priority"
                            placeholder="UI priority"
                            type="number"
                            step="1"
                            value={draft.ui_priority}
                            onChange={(event) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                ui_priority: event.target.value
                              })
                            }
                          />
                        </div>
                        <div>
                          <input
                            aria-label="Max suggestions"
                            placeholder="Max suggestions"
                            type="number"
                            step="1"
                            value={draft.max_suggestions}
                            onChange={(event) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                max_suggestions: event.target.value
                              })
                            }
                          />
                        </div>
                        <div className="admin-row__actions admin-row__actions--form">
                          <div className="button-row">
                            <button
                              type="button"
                              onClick={() => saveEdgeRelationDraft(draft)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="button-link button-link--ghost"
                              onClick={() => removeEdgeRelationDraft(draft.draftId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="admin-form">
                        <textarea
                          className="admin-textarea--compact"
                          aria-label="Relation description"
                          placeholder="Description"
                          rows={2}
                          value={draft.description}
                          onChange={(event) =>
                            updateEdgeRelationDraft(draft.draftId, {
                              description: event.target.value
                            })
                          }
                        />
                      </div>
                    </Fragment>
                  ))
                ) : (
                  <div className="admin-toolbar">
                    <button
                      type="button"
                      onClick={addEdgeRelationDraft}
                      disabled={edgeRelationDrafts.length > 0 || !!editEdgeRelation}
                    >
                      Insert new
                    </button>
                  </div>
                )}
              </>
            )}

            {referenceView === 'taxonomy' && (
              <>
                {editTaxonomy ? (
                  <>
                    <div className="row review-footer admin-row admin-row--form admin-row--form-taxonomy admin-form">
                      <div>
                        <select
                          aria-label="Node type"
                          className={
                            editTaxonomy.node_type ? '' : 'admin-select--placeholder'
                          }
                          value={editTaxonomy.node_type}
                          onChange={(event) =>
                            updateEditTaxonomy({ node_type: event.target.value })
                          }
                        >
                          <option value="" disabled>
                            Node type
                          </option>
                          {nodeTypeOptions.map((nodeType) => (
                            <option key={nodeType} value={nodeType}>
                              {nodeType}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          aria-label="Taxonomy key"
                          placeholder="Key"
                          value={editTaxonomy.key}
                          onChange={(event) =>
                            updateEditTaxonomy({ key: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="Taxonomy value"
                          placeholder="Value"
                          value={editTaxonomy.value}
                          onChange={(event) =>
                            updateEditTaxonomy({ value: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="Taxonomy label"
                          placeholder="Label"
                          value={editTaxonomy.label}
                          onChange={(event) =>
                            updateEditTaxonomy({ label: event.target.value })
                          }
                        />
                      </div>
                      <div className="admin-row__actions admin-row__actions--form">
                        <div className="button-row">
                          <button
                            type="button"
                            onClick={() => saveEditTaxonomy(editTaxonomy)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTaxonomy(editTaxonomy)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="button-link button-link--ghost"
                            onClick={cancelEditTaxonomy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="admin-form">
                      <textarea
                        className="admin-textarea--compact"
                        aria-label="Taxonomy description"
                        placeholder="Description"
                        rows={2}
                        value={editTaxonomy.description}
                        onChange={(event) =>
                          updateEditTaxonomy({ description: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : taxonomyDrafts.length > 0 ? (
                  taxonomyDrafts.map((draft) => (
                    <Fragment key={draft.draftId}>
                      <div className="row review-footer admin-row admin-row--form admin-row--form-taxonomy admin-form">
                        <div>
                          <select
                            aria-label="Node type"
                            className={draft.node_type ? '' : 'admin-select--placeholder'}
                            value={draft.node_type}
                            onChange={(event) =>
                              updateTaxonomyDraft(draft.draftId, {
                                node_type: event.target.value
                              })
                            }
                          >
                            <option value="" disabled>
                              Node type
                            </option>
                            {nodeTypeOptions.map((nodeType) => (
                              <option key={nodeType} value={nodeType}>
                                {nodeType}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <input
                            aria-label="Taxonomy key"
                            placeholder="Key"
                            value={draft.key}
                            onChange={(event) =>
                              updateTaxonomyDraft(draft.draftId, {
                                key: event.target.value
                              })
                            }
                          />
                        </div>
                        <div>
                          <input
                            aria-label="Taxonomy value"
                            placeholder="Value"
                            value={draft.value}
                            onChange={(event) =>
                              updateTaxonomyDraft(draft.draftId, {
                                value: event.target.value
                              })
                            }
                          />
                        </div>
                        <div>
                          <input
                            aria-label="Taxonomy label"
                            placeholder="Label"
                            value={draft.label}
                            onChange={(event) =>
                              updateTaxonomyDraft(draft.draftId, {
                                label: event.target.value
                              })
                            }
                          />
                        </div>
                        <div className="admin-row__actions admin-row__actions--form">
                          <div className="button-row">
                            <button
                              type="button"
                              onClick={() => saveTaxonomyDraft(draft)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="button-link button-link--ghost"
                              onClick={() => removeTaxonomyDraft(draft.draftId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="admin-form">
                        <textarea
                          className="admin-textarea--compact"
                          aria-label="Taxonomy description"
                          placeholder="Description"
                          rows={2}
                          value={draft.description}
                          onChange={(event) =>
                            updateTaxonomyDraft(draft.draftId, {
                              description: event.target.value
                            })
                          }
                        />
                      </div>
                    </Fragment>
                  ))
                ) : (
                  <div className="admin-toolbar">
                    <button
                      type="button"
                      onClick={addTaxonomyDraft}
                      disabled={taxonomyDrafts.length > 0 || !!editTaxonomy}
                    >
                      Insert new
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {status && <small>{status}</small>}
        {deleteNodeTarget && (
          <DeleteNodeDialog
            node={deleteNodeTarget}
            onCancel={() => setDeleteNodeTarget(null)}
            onConfirm={confirmDeleteNode}
          />
        )}
      </div>
      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />

      <section
        className="section section--admin"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        {activeTab === 'nodes' && (
          <>
            <div className="admin-scroll">
              {sortedNodes.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data">
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setNodeSort((prev) => nextSort(prev, 'id'))}
                    >
                      Id
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeSort, 'id')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setNodeSort((prev) => nextSort(prev, 'name'))}
                    >
                      Name
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeSort, 'name')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setNodeSort((prev) => nextSort(prev, 'type'))}
                    >
                      Type
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeSort, 'type')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setNodeSort((prev) => nextSort(prev, 'edges'))}
                    >
                      Edges
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeSort, 'edges')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setNodeSort((prev) => nextSort(prev, 'reviews'))}
                    >
                      Reviews
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeSort, 'reviews')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {sortedNodes.length === 0 && <small>No nodes found.</small>}
              {sortedNodes.map((node) => (
                <div
                  className="row review-footer admin-row admin-row--data admin-row--clickable"
                  key={`${node.id}-${node.name}-${node.type}`}
                  onClick={() => startEditNode(node)}
                >
                  <div>{node.id}</div>
                  <div>{node.name}</div>
                  <div>{node.type}</div>
                  <div>{node.edge_count ?? 0}</div>
                  <div>{node.review_count ?? 0}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'edges' && (
          <>
            <div className="admin-scroll">
              {sortedEdges.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data-edge">
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setEdgeSort((prev) => nextSort(prev, 'parent'))}
                    >
                      Parent
                      <span className="admin-sort__indicator">
                        {sortIndicator(edgeSort, 'parent')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setEdgeSort((prev) => nextSort(prev, 'relation'))}
                    >
                      Relation
                      <span className="admin-sort__indicator">
                        {sortIndicator(edgeSort, 'relation')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setEdgeSort((prev) => nextSort(prev, 'child'))}
                    >
                      Child
                      <span className="admin-sort__indicator">
                        {sortIndicator(edgeSort, 'child')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {sortedEdges.length === 0 && <small>No edges found.</small>}
              {sortedEdges.map((edge, index) => {
                const parent = nodeMap.get(edge.parent_id);
                const child = nodeMap.get(edge.child_id);
                const isIndirect =
                  edgeSearchField === 'related' &&
                  filteredEdgesResult.indirectKeys.has(edgeKey(edge));
                let parentLabel = parent
                  ? `${parent.name} (${parent.type})`
                  : String(edge.parent_id);
                let childLabel = child
                  ? `${child.name} (${child.type})`
                  : String(edge.child_id);
                if (isIndirect) {
                  const sourceNodeId = filteredEdgesResult.edgeSourceNodeId.get(
                    edgeKey(edge)
                  );
                  const searchLabel =
                    filteredEdgesResult.searchLabel || 'Search';
                  if (sourceNodeId === edge.parent_id) {
                    parentLabel = searchLabel;
                  } else if (sourceNodeId === edge.child_id) {
                    childLabel = searchLabel;
                  }
                }
                return (
                  <div
                    className={`row review-footer admin-row admin-row--data admin-row--data-edge admin-row--clickable${isIndirect ? ' admin-row--deemphasized' : ''}`}
                    key={`${edge.parent_id}-${edge.child_id}-${edge.relation}-${index}`}
                    onClick={() => startEditEdge(edge)}
                  >
                    <div>{parentLabel}</div>
                    <div>
                      {edge.relation}
                    </div>
                    <div>{childLabel}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'taxonomy' && (
          <>
            <div className="admin-scroll">
              <div className="admin-group">
                <div className="row review-footer admin-row admin-row--header admin-row--data-node-taxonomy">
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() =>
                        setNodeTaxonomySort((prev) => nextSort(prev, 'node'))
                      }
                    >
                      Node
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeTaxonomySort, 'node')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() =>
                        setNodeTaxonomySort((prev) => nextSort(prev, 'taxonomy'))
                      }
                    >
                      Taxonomy
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeTaxonomySort, 'taxonomy')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() =>
                        setNodeTaxonomySort((prev) => nextSort(prev, 'label'))
                      }
                    >
                      Label
                      <span className="admin-sort__indicator">
                        {sortIndicator(nodeTaxonomySort, 'label')}
                      </span>
                    </button>
                  </div>
                  <div></div>
                </div>
                {sortedNodeTaxonomy.length === 0 && (
                  <small>No taxonomy links found.</small>
                )}
                {sortedNodeTaxonomy.map((entry) => (
                  <div
                    className="row review-footer admin-row admin-row--data admin-row--data-node-taxonomy admin-row--clickable"
                    key={`${entry.node_id}-${entry.taxonomy_id}`}
                    onClick={() => startEditNodeTaxonomy(entry)}
                  >
                    <div className="admin-cell-wrap">
                      {formatNodeLabel(entry.node_name, entry.node_type)}
                    </div>
                    <div className="admin-cell-wrap">
                      {formatTaxonomyLabel(entry.taxonomy_key, entry.taxonomy_value)}
                    </div>
                    <div className="admin-cell-wrap">{entry.taxonomy_label}</div>
                    <div></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'reviews' && (
          <>
            <div className="admin-scroll">
              {reviews.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data-review">
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setReviewSort((prev) => nextSort(prev, 'node'))}
                    >
                      Node
                      <span className="admin-sort__indicator">
                        {sortIndicator(reviewSort, 'node')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setReviewSort((prev) => nextSort(prev, 'entity'))}
                    >
                      Entity
                      <span className="admin-sort__indicator">
                        {sortIndicator(reviewSort, 'entity')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setReviewSort((prev) => nextSort(prev, 'user'))}
                    >
                      User
                      <span className="admin-sort__indicator">
                        {sortIndicator(reviewSort, 'user')}
                      </span>
                    </button>
                  </div>
                  <div>Updated</div>
                </div>
              )}
              {reviews.length === 0 && <small>No reviews found.</small>}
              {sortedReviews.map((review) => {
                const entityLabel = review.entity_id
                  ? nodeMap.get(review.entity_id)?.name ?? '-'
                  : '-';
                return (
                  <div
                    className="row review-footer admin-row admin-row--data admin-row--data-review admin-row--clickable"
                    key={review.id}
                    onClick={() => startEditReview(review)}
                  >
                    <div className="admin-cell-wrap">{entityLabel}</div>
                    <div className="admin-cell-wrap">{review.entity_name}</div>
                    <div>{review.user_id}</div>
                    <div>
                      {formatTimestamp(review.updated_at ?? review.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'reference' && (
          <>
            <div className="admin-scroll">
              {referenceView === 'types' && (
                <div className="admin-group">
                  <div className="row review-footer admin-row admin-row--header admin-row--data-node-type">
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setNodeTypeSort((prev) => nextSort(prev, 'node_type'))
                        }
                      >
                        Node type
                        <span className="admin-sort__indicator">
                          {sortIndicator(nodeTypeSort, 'node_type')}
                        </span>
                      </button>
                    </div>
                    <div>
                      Description
                    </div>
                  </div>
                  {sortedNodeTypes.length === 0 && (
                    <small>No node types found.</small>
                  )}
                  {sortedNodeTypes.map((nodeType) => (
                    <div
                      className="row review-footer admin-row admin-row--data admin-row--data-node-type admin-row--clickable"
                      key={nodeType.node_type}
                      onClick={() => startEditNodeType(nodeType)}
                    >
                      <div>{nodeType.node_type}</div>
                      <div>{nodeType.description ?? '-'}</div>
                    </div>
                  ))}
                </div>
              )}

              {referenceView === 'relations' && (
                <div className="admin-group">
                  <div className="row review-footer admin-row admin-row--header admin-row--data-relation">
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'parent_types'))
                        }
                      >
                        Parent types
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'parent_types')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'relation'))
                        }
                      >
                        Relation
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'relation')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'child_types'))
                        }
                      >
                        Child types
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'child_types')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'ui_priority'))
                        }
                      >
                        UI priority
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'ui_priority')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'max_suggestions'))
                        }
                      >
                        Max suggestions
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'max_suggestions')}
                        </span>
                      </button>
                    </div>
                    <div></div>
                  </div>
                  {sortedEdgeRelations.length === 0 && <small>No relations found.</small>}
                  {sortedEdgeRelations.map((relation) => (
                    <div
                      className="row review-footer admin-row admin-row--data admin-row--data-relation admin-row--clickable"
                      key={relation.relation}
                      onClick={() => startEditEdgeRelation(relation)}
                    >
                      <div className="admin-cell-wrap">
                        {listToString(relation.allowed_parent_types)}
                      </div>
                      <div>{relation.relation}</div>
                      <div className="admin-cell-wrap">
                        {listToString(relation.allowed_child_types)}
                      </div>
                      <div>
                        {relation.ui_priority === null ? '-' : relation.ui_priority}
                      </div>
                      <div>
                        {relation.max_suggestions === null ? '-' : relation.max_suggestions}
                      </div>
                      <div></div>
                    </div>
                  ))}
                </div>
              )}

              {referenceView === 'taxonomy' && (
                <div className="admin-group">
                  <div className="row review-footer admin-row admin-row--header admin-row--data-taxonomy">
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setTaxonomySort((prev) => nextSort(prev, 'node_type'))
                        }
                      >
                        Node type
                        <span className="admin-sort__indicator">
                          {sortIndicator(taxonomySort, 'node_type')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setTaxonomySort((prev) => nextSort(prev, 'key'))
                        }
                      >
                        Key
                        <span className="admin-sort__indicator">
                          {sortIndicator(taxonomySort, 'key')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setTaxonomySort((prev) => nextSort(prev, 'value'))
                        }
                      >
                        Value
                        <span className="admin-sort__indicator">
                          {sortIndicator(taxonomySort, 'value')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setTaxonomySort((prev) => nextSort(prev, 'label'))
                        }
                      >
                        Label
                        <span className="admin-sort__indicator">
                          {sortIndicator(taxonomySort, 'label')}
                        </span>
                      </button>
                    </div>
                  </div>
                  {sortedTaxonomy.length === 0 && (
                    <small>No taxonomy entries found.</small>
                  )}
                  {sortedTaxonomy.map((entry) => (
                    <div
                      className="row review-footer admin-row admin-row--data admin-row--data-taxonomy admin-row--clickable"
                      key={entry.id}
                      onClick={() => startEditTaxonomy(entry)}
                    >
                      <div>{entry.node_type}</div>
                      <div>{entry.key}</div>
                      <div>{entry.value}</div>
                      <div>{entry.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
