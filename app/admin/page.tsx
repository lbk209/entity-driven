'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  is_transitive: number | null;
  default_weight: number | null;
  description: string | null;
  allowed_parent_types: string[];
  allowed_child_types: string[];
};

type NodeTypePrior = {
  node_type: string;
  base_prior: number | null;
  description: string | null;
  updated_at: string | null;
};

type AliasRow = {
  id: number;
  alias: string;
  node_id: number;
  review_id: number;
  review_content?: string | null;
  node_name?: string;
  node_type?: string;
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
  is_transitive: boolean;
  default_weight: string;
  allowed_parent_types: string;
  allowed_child_types: string;
};
type DraftNodeTypePrior = {
  draftId: string;
  node_type: string;
  base_prior: string;
  description: string;
};
type EditNode = NodeOption & { original_id: number };
type EditEdge = Edge & {
  original_parent_id: number;
  original_child_id: number;
  original_relation: string;
};
type EditAlias = AliasRow;
type EditEdgeRelation = {
  relation: string;
  original_relation: string;
  is_transitive: number | null;
  default_weight: number | null;
  description: string;
  allowed_parent_types: string;
  allowed_child_types: string;
};
type EditNodeTypePrior = NodeTypePrior & { original_node_type: string };
type SortDirection = 'asc' | 'desc';
type SortState<T extends string> = { key: T; direction: SortDirection };

function listToString(list: string[]) {
  return list.join(', ');
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
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [edgeRelations, setEdgeRelations] = useState<EdgeRelation[]>([]);
  const [nodeTypePriors, setNodeTypePriors] = useState<NodeTypePrior[]>([]);
  const [drafts, setDrafts] = useState<DraftEdge[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<DraftNode[]>([]);
  const [edgeRelationDrafts, setEdgeRelationDrafts] = useState<DraftEdgeRelation[]>([]);
  const [nodeTypeDrafts, setNodeTypeDrafts] = useState<DraftNodeTypePrior[]>([]);
  const [editNode, setEditNode] = useState<EditNode | null>(null);
  const [editEdge, setEditEdge] = useState<EditEdge | null>(null);
  const [editAlias, setEditAlias] = useState<EditAlias | null>(null);
  const [editEdgeRelation, setEditEdgeRelation] = useState<EditEdgeRelation | null>(null);
  const [editNodeTypePrior, setEditNodeTypePrior] = useState<EditNodeTypePrior | null>(
    null
  );
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<
    'nodes' | 'edges' | 'aliases' | 'reference'
  >('nodes');
  const [referenceView, setReferenceView] = useState<'relations' | 'priors'>(
    'relations'
  );
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeSearchField, setNodeSearchField] = useState<'name' | 'type'>('name');
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeSearchField, setEdgeSearchField] = useState<
    'parent' | 'child' | 'relation' | 'related'
  >('parent');
  const [aliasSearch, setAliasSearch] = useState('');
  const [aliasSearchField, setAliasSearchField] = useState<'alias' | 'node'>('alias');
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [nodeTypeSuggestTarget, setNodeTypeSuggestTarget] = useState<'edit' | 'draft' | null>(
    null
  );
  const [nodeTypeFilterActive, setNodeTypeFilterActive] = useState(false);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const [nodeSort, setNodeSort] = useState<SortState<'id' | 'name' | 'type'>>({
    key: 'name',
    direction: 'asc'
  });
  const [aliasSort, setAliasSort] = useState<
    SortState<'alias' | 'node' | 'review_id'>
  >({
    key: 'alias',
    direction: 'asc'
  });
  const [edgeSort, setEdgeSort] = useState<
    SortState<'parent' | 'relation' | 'child'>
  >({
    key: 'parent',
    direction: 'asc'
  });
  const [relationSort, setRelationSort] = useState<
    SortState<'parent_types' | 'relation' | 'child_types' | 'default_weight' | 'transitive'>
  >({
    key: 'relation',
    direction: 'asc'
  });
  const [priorSort, setPriorSort] = useState<
    SortState<'node_type' | 'base_prior' | 'updated_at'>
  >({
    key: 'node_type',
    direction: 'asc'
  });

  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeOption>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const nodeTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const node of nodes) {
      const value = node.type.trim();
      if (value) seen.add(value);
    }
    for (const nodeType of nodeTypePriors) {
      const value = nodeType.node_type.trim();
      if (value) seen.add(value);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [nodes, nodeTypePriors]);

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
      const matchedByName = nodes.filter((node) =>
        node.name.toLowerCase().includes(term)
      );
      const seedIds = new Set(matchedByName.map((node) => node.id));
      const parsedId = Number(term);
      if (Number.isFinite(parsedId)) {
        const matchById = nodes.find((node) => node.id === parsedId);
        if (matchById) seedIds.add(matchById.id);
      }
      if (seedIds.size === 0) {
        return {
          edges: [],
          indirectKeys: new Set<string>(),
          edgeSourceNodeId: new Map<string, number>(),
          searchLabel: edgeSearch.trim()
        };
      }

      const transitiveRelations = new Set(
        edgeRelations
          .filter((relation) => relation.is_transitive)
          .map((relation) => relation.relation)
      );
      const edgesByNode = new Map<number, Edge[]>();
      for (const edge of edges) {
        const parentEdges = edgesByNode.get(edge.parent_id) ?? [];
        parentEdges.push(edge);
        edgesByNode.set(edge.parent_id, parentEdges);
        const childEdges = edgesByNode.get(edge.child_id) ?? [];
        childEdges.push(edge);
        edgesByNode.set(edge.child_id, childEdges);
      }

      const resultKeys = new Set<string>();
      const indirectKeys = new Set<string>();
      const edgeSourceNodeId = new Map<string, number>();

      for (const seedId of seedIds) {
        const connectedEdges = edgesByNode.get(seedId) ?? [];
        for (const edge of connectedEdges) {
          const key = edgeKey(edge);
          resultKeys.add(key);
          if (!edgeSourceNodeId.has(key)) {
            edgeSourceNodeId.set(key, seedId);
          }
        }
      }

      for (const relation of transitiveRelations) {
        const forwardVisited = new Set<number>(seedIds);
        const forwardQueue = Array.from(seedIds);
        while (forwardQueue.length > 0) {
          const nodeId = forwardQueue.shift();
          if (nodeId === undefined) break;
          const connectedEdges = edgesByNode.get(nodeId) ?? [];
          for (const edge of connectedEdges) {
            if (edge.relation !== relation) continue;
            if (edge.parent_id !== nodeId) continue;
            const key = edgeKey(edge);
            const isDirect =
              seedIds.has(edge.parent_id) || seedIds.has(edge.child_id);
            resultKeys.add(key);
            if (!edgeSourceNodeId.has(key)) {
              edgeSourceNodeId.set(key, nodeId);
            }
            if (!isDirect) {
              indirectKeys.add(key);
            }
            const nextNodeId = edge.child_id;
            if (!forwardVisited.has(nextNodeId)) {
              forwardVisited.add(nextNodeId);
              forwardQueue.push(nextNodeId);
            }
          }
        }

        const reverseVisited = new Set<number>(seedIds);
        const reverseQueue = Array.from(seedIds);
        while (reverseQueue.length > 0) {
          const nodeId = reverseQueue.shift();
          if (nodeId === undefined) break;
          const connectedEdges = edgesByNode.get(nodeId) ?? [];
          for (const edge of connectedEdges) {
            if (edge.relation !== relation) continue;
            if (edge.child_id !== nodeId) continue;
            const key = edgeKey(edge);
            const isDirect =
              seedIds.has(edge.parent_id) || seedIds.has(edge.child_id);
            resultKeys.add(key);
            if (!edgeSourceNodeId.has(key)) {
              edgeSourceNodeId.set(key, nodeId);
            }
            if (!isDirect) {
              indirectKeys.add(key);
            }
            const nextNodeId = edge.parent_id;
            if (!reverseVisited.has(nextNodeId)) {
              reverseVisited.add(nextNodeId);
              reverseQueue.push(nextNodeId);
            }
          }
        }
      }

      return {
        edges: edges.filter((edge) => resultKeys.has(edgeKey(edge))),
        indirectKeys,
        edgeSourceNodeId,
        searchLabel:
          seedIds.size === 1
            ? (() => {
                const seedId = Array.from(seedIds)[0];
                const node = nodeMap.get(seedId);
                return node ? `${node.name} (${node.type})` : String(seedId);
              })()
            : edgeSearch.trim()
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
      if (relationSort.key === 'default_weight') {
        if (a.default_weight === null && b.default_weight === null) return 0;
        if (a.default_weight === null) return 1;
        if (b.default_weight === null) return -1;
        return compareNumber(a.default_weight, b.default_weight) * dir;
      }
      if (relationSort.key === 'transitive') {
        const aValue = a.is_transitive ? 1 : 0;
        const bValue = b.is_transitive ? 1 : 0;
        return compareNumber(aValue, bValue) * dir;
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

  const sortedNodeTypePriors = useMemo(() => {
    const list = [...nodeTypePriors];
    const dir = priorSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (priorSort.key === 'base_prior') {
        if (a.base_prior === null && b.base_prior === null) return 0;
        if (a.base_prior === null) return 1;
        if (b.base_prior === null) return -1;
        return compareNumber(a.base_prior, b.base_prior) * dir;
      }
      if (priorSort.key === 'updated_at') {
        if (!a.updated_at && !b.updated_at) return 0;
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        return compareText(a.updated_at, b.updated_at) * dir;
      }
      return compareText(a.node_type.toLowerCase(), b.node_type.toLowerCase()) * dir;
    });
    return list;
  }, [nodeTypePriors, priorSort]);

  const filteredAliases = useMemo(() => {
    const term = aliasSearch.trim().toLowerCase();
    if (!term) return aliases;
    return aliases.filter((alias) => {
      const node = nodeMap.get(alias.node_id);
      const nodeName = node?.name.toLowerCase() ?? '';
      if (aliasSearchField === 'node') return nodeName.includes(term);
      return alias.alias.toLowerCase().includes(term);
    });
  }, [aliases, aliasSearch, aliasSearchField, nodeMap]);

  const sortedAliases = useMemo(() => {
    const list = [...filteredAliases];
    const dir = aliasSort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (aliasSort.key === 'review_id') {
        return compareNumber(a.review_id, b.review_id) * dir;
      }
      if (aliasSort.key === 'node') {
        const aName = nodeMap.get(a.node_id)?.name.toLowerCase() ?? '';
        const bName = nodeMap.get(b.node_id)?.name.toLowerCase() ?? '';
        return compareText(aName, bName) * dir;
      }
      return compareText(a.alias.toLowerCase(), b.alias.toLowerCase()) * dir;
    });
    return list;
  }, [filteredAliases, aliasSort, nodeMap]);

  async function loadNodes() {
    const res = await fetch('/api/nodes');
    const data = await res.json().catch(() => ({}));
    setNodes(data.nodes || []);
  }

  useEffect(() => {
    loadNodes().catch(() => setNodes([]));
  }, []);

  async function loadEdges() {
    const res = await fetch('/api/edges');
    const data = await res.json().catch(() => ({}));
    setEdges(data.edges || []);
  }

  useEffect(() => {
    loadEdges().catch(() => setEdges([]));
  }, []);

  async function loadAliases() {
    const res = await fetch('/api/aliases');
    const data = await res.json().catch(() => ({}));
    setAliases(data.aliases || []);
  }

  useEffect(() => {
    loadAliases().catch(() => setAliases([]));
  }, []);

  async function loadEdgeRelations() {
    const res = await fetch('/api/edge-relations');
    const data = await res.json().catch(() => ({}));
    setEdgeRelations(data.relations || []);
  }

  useEffect(() => {
    loadEdgeRelations().catch(() => setEdgeRelations([]));
  }, []);

  async function loadNodeTypePriors() {
    const res = await fetch('/api/node-type-prior');
    const data = await res.json().catch(() => ({}));
    setNodeTypePriors(data.node_types || []);
  }

  useEffect(() => {
    loadNodeTypePriors().catch(() => setNodeTypePriors([]));
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
      is_transitive: false,
      default_weight: '1',
      allowed_parent_types: '',
      allowed_child_types: ''
    };
    setEdgeRelationDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addNodeTypeDraft() {
    if (nodeTypeDrafts.length > 0 || editNodeTypePrior) return;
    const draft: DraftNodeTypePrior = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      node_type: '',
      base_prior: '',
      description: ''
    };
    setNodeTypeDrafts((prev) => [...prev, draft]);
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

  function updateNodeTypeDraft(draftId: string, next: Partial<DraftNodeTypePrior>) {
    setNodeTypeDrafts((prev) =>
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

  function updateEditAlias(next: Partial<AliasRow>) {
    setEditAlias((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditEdgeRelation(next: Partial<EditEdgeRelation>) {
    setEditEdgeRelation((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function updateEditNodeTypePrior(next: Partial<NodeTypePrior>) {
    setEditNodeTypePrior((prev) => (prev ? { ...prev, ...next } : prev));
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
    await loadNodeTypePriors();
    await loadAliases();
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
    const weightValue = draft.default_weight.trim()
      ? Number(draft.default_weight)
      : null;
    if (weightValue !== null && !Number.isFinite(weightValue)) {
      setStatus('Default weight must be a number.');
      return;
    }
    const res = await fetch('/api/edge-relations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relation: draft.relation,
        is_transitive: draft.is_transitive ? 1 : 0,
        default_weight: weightValue,
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
              is_transitive: false,
              default_weight: '',
              allowed_parent_types: '',
              allowed_child_types: ''
            }
          : item
      )
    );
    await loadEdgeRelations();
  }

  async function saveNodeTypeDraft(draft: DraftNodeTypePrior) {
    setStatus('');
    if (!draft.node_type.trim()) {
      setStatus('Node type is required.');
      return;
    }
    const basePriorValue = draft.base_prior.trim()
      ? Number(draft.base_prior)
      : null;
    if (basePriorValue !== null && !Number.isFinite(basePriorValue)) {
      setStatus('Base prior must be a number.');
      return;
    }
    const res = await fetch('/api/node-type-prior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: draft.node_type,
        base_prior: basePriorValue,
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
          ? { ...item, node_type: '', base_prior: '', description: '' }
          : item
      )
    );
    await loadNodeTypePriors();
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
    await loadNodeTypePriors();
    await loadEdges();
    await loadAliases();
  }

  async function saveEditAlias(alias: EditAlias) {
    setStatus('');
    const res = await fetch('/api/aliases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: alias.id,
        node_id: alias.node_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update alias.');
      return;
    }
    setEditAlias(null);
    await loadAliases();
  }

  async function saveEditEdgeRelation(relation: EditEdgeRelation) {
    setStatus('');
    const allowedParentTypes = parseTypeList(relation.allowed_parent_types);
    const allowedChildTypes = parseTypeList(relation.allowed_child_types);
    if (allowedParentTypes.length === 0 || allowedChildTypes.length === 0) {
      setStatus('Provide allowed parent and child types.');
      return;
    }
    const weightValue =
      relation.default_weight === null
        ? null
        : Number(relation.default_weight);
    if (weightValue !== null && !Number.isFinite(weightValue)) {
      setStatus('Default weight must be a number.');
      return;
    }
    const res = await fetch('/api/edge-relations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relation: relation.relation,
        is_transitive: relation.is_transitive ? 1 : 0,
        default_weight: weightValue,
        description: relation.description,
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

  async function saveEditNodeTypePrior(nodeType: EditNodeTypePrior) {
    setStatus('');
    const basePriorValue =
      nodeType.base_prior === null ? null : Number(nodeType.base_prior);
    if (basePriorValue !== null && !Number.isFinite(basePriorValue)) {
      setStatus('Base prior must be a number.');
      return;
    }
    const res = await fetch('/api/node-type-prior', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: nodeType.node_type,
        base_prior: basePriorValue,
        description: nodeType.description,
        original_node_type: nodeType.original_node_type
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to update node type.');
      return;
    }
    setEditNodeTypePrior(null);
    await loadNodeTypePriors();
    await loadNodes();
    await loadEdges();
    await loadAliases();
  }

  async function deleteNode(node: NodeOption) {
    setStatus('');
    const reviewCount = node.review_count ?? 0;
    const edgeCount = node.edge_count ?? 0;
    const message =
      reviewCount > 0 || edgeCount > 0
        ? `This node is referenced by ${reviewCount} review link(s) and ${edgeCount} edge(s). Delete anyway?`
        : 'Delete this node?';
    if (!window.confirm(message)) return;
    const res = await fetch('/api/nodes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...node, force: reviewCount > 0 || edgeCount > 0 })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete node.');
      return;
    }
    setEditNode(null);
    await loadNodes();
    await loadEdges();
    await loadAliases();
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
    const message = `Merge ${source?.name ?? sourceId} into ${target?.name ?? mergeTargetId}? This will move aliases, reviews, and edges to the target.`;
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
    await loadAliases();
  }

  function startEditAlias(alias: AliasRow) {
    setEditAlias(alias);
  }

  function cancelEditAlias() {
    setEditAlias(null);
  }

  function startEditEdgeRelation(relation: EdgeRelation) {
    if (edgeRelationDrafts.length > 0) return;
    setEditEdgeRelation({
      relation: relation.relation,
      original_relation: relation.relation,
      is_transitive: relation.is_transitive,
      default_weight: relation.default_weight,
      allowed_parent_types: listToString(relation.allowed_parent_types),
      allowed_child_types: listToString(relation.allowed_child_types),
      description: relation.description ?? ''
    });
  }

  function cancelEditEdgeRelation() {
    setEditEdgeRelation(null);
  }

  function startEditNodeTypePrior(nodeType: NodeTypePrior) {
    if (nodeTypeDrafts.length > 0) return;
    setEditNodeTypePrior({
      ...nodeType,
      description: nodeType.description ?? '',
      original_node_type: nodeType.node_type
    });
  }

  function cancelEditNodeTypePrior() {
    setEditNodeTypePrior(null);
  }

  async function deleteAlias(alias: AliasRow) {
    setStatus('');
    if (!window.confirm('Delete this alias?')) return;
    const res = await fetch('/api/aliases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alias.id })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete alias.');
      return;
    }
    setEditAlias(null);
    await loadAliases();
  }

  async function deleteEdgeRelation(relation: EdgeRelation) {
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

  async function deleteNodeTypePrior(nodeType: NodeTypePrior) {
    setStatus('');
    if (!window.confirm('Delete this node type?')) return;
    const res = await fetch('/api/node-type-prior', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_type: nodeType.node_type })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete node type.');
      return;
    }
    setEditNodeTypePrior(null);
    await loadNodeTypePriors();
    await loadNodes();
    await loadEdges();
    await loadAliases();
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
            aria-selected={activeTab === 'aliases'}
            className={`admin-tab ${activeTab === 'aliases' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('aliases')}
          >
            <strong>Aliases</strong>
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
                    {nodeTypeSuggestTarget === 'edit' && nodeTypes.length > 0 && (
                      <div className="admin-type-suggestions">
                        {nodeTypes
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
                      {nodeTypeSuggestTarget === 'draft' && nodeTypes.length > 0 && (
                        <div className="admin-type-suggestions">
                          {nodeTypes
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
                  Insert node
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'aliases' && (
          <>
            {editAlias ? (
              <>
                <div className="row review-footer admin-row admin-row--form admin-row--form-alias admin-form">
                  <div>
                    <input
                      aria-label="Alias"
                      placeholder="Alias"
                      value={editAlias.alias}
                      readOnly
                    />
                  </div>
                  <div>
                    <select
                      aria-label="Canonical node"
                      value={editAlias.node_id}
                      onChange={(event) =>
                        updateEditAlias({
                          node_id: Number(event.target.value)
                        })
                      }
                    >
                      {!nodeMap.has(editAlias.node_id) && (
                        <option value={editAlias.node_id}>
                          {editAlias.node_id}
                        </option>
                      )}
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-row__actions admin-row__actions--form">
                    <div className="button-row">
                      <button type="button" onClick={() => saveEditAlias(editAlias)}>
                        Update
                      </button>
                      <button type="button" onClick={() => deleteAlias(editAlias)}>
                        Delete
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--ghost"
                        onClick={cancelEditAlias}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
                <div className="admin-form">
                  <textarea
                    className="admin-textarea--compact"
                    aria-label="Review content"
                    placeholder="Review content"
                    rows={2}
                    readOnly
                    value={editAlias.review_content ?? ''}
                  />
                </div>
              </>
            ) : (
              <div className="admin-toolbar">
                <select
                  className="admin-toolbar__select"
                  aria-label="Filter alias search field"
                  value={aliasSearchField}
                  onChange={(event) =>
                    setAliasSearchField(event.target.value as 'alias' | 'node')
                  }
                >
                  <option value="alias">Alias</option>
                  <option value="node">Node</option>
                </select>
                <input
                  placeholder="Search aliases"
                  value={aliasSearch}
                  onChange={(event) => setAliasSearch(event.target.value)}
                />
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
                <input
                  placeholder="Search edges"
                  value={edgeSearch}
                  onChange={(event) => setEdgeSearch(event.target.value)}
                />
                <button
                  type="button"
                  onClick={addDraftRow}
                  disabled={drafts.length > 0 || !!editEdge}
                >
                  Insert edge
                </button>
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
                  checked={referenceView === 'relations'}
                  onChange={() => setReferenceView('relations')}
                />
                <span>Edge relations</span>
              </label>
              <label className="admin-radio-label">
                <input
                  type="radio"
                  name="reference-view"
                  checked={referenceView === 'priors'}
                  onChange={() => setReferenceView('priors')}
                />
                <span>Node type priors</span>
              </label>
            </div>

            {referenceView === 'relations' && (
              <>
                {editEdgeRelation ? (
                  <>
                    <div className="row review-footer admin-row admin-row--form admin-row--form-relation admin-form">
                      <div>
                        <TypeMultiSelect
                          ariaLabel="Allowed parent types"
                          placeholder="Select parent types"
                          options={nodeTypes}
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
                          options={nodeTypes}
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
                          aria-label="Default weight"
                          placeholder="Default weight"
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={editEdgeRelation.default_weight ?? ''}
                          onChange={(event) =>
                            updateEditEdgeRelation({
                              default_weight: event.target.value
                                ? Number(event.target.value)
                                : null
                            })
                          }
                        />
                      </div>
                      <div className="admin-checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(editEdgeRelation.is_transitive)}
                            onChange={(event) =>
                              updateEditEdgeRelation({
                                is_transitive: event.target.checked ? 1 : 0
                              })
                            }
                          />
                          <span>Transitive</span>
                        </label>
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
                    <div
                      className="row review-footer admin-row admin-row--form admin-row--form-relation admin-form"
                      key={draft.draftId}
                    >
                      <div>
                        <TypeMultiSelect
                          ariaLabel="Allowed parent types"
                          placeholder="Select parent types"
                          options={nodeTypes}
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
                          options={nodeTypes}
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
                          aria-label="Default weight"
                          placeholder="Default weight"
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={draft.default_weight}
                          onChange={(event) =>
                            updateEdgeRelationDraft(draft.draftId, {
                              default_weight: event.target.value
                            })
                          }
                        />
                      </div>
                      <div className="admin-checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={draft.is_transitive}
                            onChange={(event) =>
                              updateEdgeRelationDraft(draft.draftId, {
                                is_transitive: event.target.checked
                              })
                            }
                          />
                          <span>Transitive</span>
                        </label>
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
                  ))
                ) : (
                  <div className="admin-toolbar">
                    <button
                      type="button"
                      onClick={addEdgeRelationDraft}
                      disabled={edgeRelationDrafts.length > 0 || !!editEdgeRelation}
                    >
                      Insert relation
                    </button>
                  </div>
                )}
              </>
            )}

            {referenceView === 'priors' && (
              <>
                {editNodeTypePrior ? (
                  <>
                    <div className="row review-footer admin-row admin-row--form admin-row--form-node-type admin-form">
                      <div>
                        <input
                          aria-label="Node type"
                          placeholder="Node type"
                          value={editNodeTypePrior.node_type}
                          onChange={(event) =>
                            updateEditNodeTypePrior({ node_type: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <input
                          aria-label="Base prior"
                          placeholder="Base prior"
                          type="number"
                          step="0.01"
                          value={editNodeTypePrior.base_prior ?? ''}
                          onChange={(event) =>
                            updateEditNodeTypePrior({
                              base_prior: event.target.value
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
                            onClick={() => saveEditNodeTypePrior(editNodeTypePrior)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNodeTypePrior(editNodeTypePrior)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="button-link button-link--ghost"
                            onClick={cancelEditNodeTypePrior}
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
                        value={editNodeTypePrior.description ?? ''}
                        onChange={(event) =>
                          updateEditNodeTypePrior({ description: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : nodeTypeDrafts.length > 0 ? (
                  nodeTypeDrafts.map((draft) => (
                    <div key={draft.draftId}>
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
                        <div>
                          <input
                            aria-label="Base prior"
                            placeholder="Base prior"
                            type="number"
                            step="0.01"
                            value={draft.base_prior}
                            onChange={(event) =>
                              updateNodeTypeDraft(draft.draftId, {
                                base_prior: event.target.value
                              })
                            }
                          />
                        </div>
                        <div className="admin-row__actions admin-row__actions--form">
                          <div className="button-row">
                            <button
                              type="button"
                              onClick={() => saveNodeTypeDraft(draft)}
                            >
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
                    </div>
                  ))
                ) : (
                  <div className="admin-toolbar">
                    <button
                      type="button"
                      onClick={addNodeTypeDraft}
                      disabled={nodeTypeDrafts.length > 0 || !!editNodeTypePrior}
                    >
                      Insert node type
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {status && <small>{status}</small>}
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
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'aliases' && (
          <>
            <div className="admin-scroll">
              {sortedAliases.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data-alias">
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setAliasSort((prev) => nextSort(prev, 'alias'))}
                    >
                      Alias
                      <span className="admin-sort__indicator">
                        {sortIndicator(aliasSort, 'alias')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setAliasSort((prev) => nextSort(prev, 'node'))}
                    >
                      Node
                      <span className="admin-sort__indicator">
                        {sortIndicator(aliasSort, 'node')}
                      </span>
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="admin-sort"
                      onClick={() => setAliasSort((prev) => nextSort(prev, 'review_id'))}
                    >
                      Review
                      <span className="admin-sort__indicator">
                        {sortIndicator(aliasSort, 'review_id')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {sortedAliases.length === 0 && <small>No aliases found.</small>}
              {sortedAliases.map((alias) => {
                const node = nodeMap.get(alias.node_id);
                const nodeLabel = node ? node.name : alias.node_id;
                return (
                  <div
                    className="row review-footer admin-row admin-row--data admin-row--data-alias admin-row--clickable"
                    key={alias.id}
                    onClick={() => startEditAlias(alias)}
                  >
                    <div>{alias.alias}</div>
                    <div>{nodeLabel}</div>
                    <div>{alias.review_id}</div>
                  </div>
                );
              })}
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

        {activeTab === 'reference' && (
          <>
            <div className="admin-scroll">
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
                          setRelationSort((prev) => nextSort(prev, 'default_weight'))
                        }
                      >
                        Default weight
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'default_weight')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setRelationSort((prev) => nextSort(prev, 'transitive'))
                        }
                      >
                        Transitive
                        <span className="admin-sort__indicator">
                          {sortIndicator(relationSort, 'transitive')}
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
                        {relation.default_weight === null ? '-' : relation.default_weight}
                      </div>
                      <div>{relation.is_transitive ? 'Yes' : 'No'}</div>
                      <div></div>
                    </div>
                  ))}
                </div>
              )}

              {referenceView === 'priors' && (
                <div className="admin-group">
                  <div className="row review-footer admin-row admin-row--header admin-row--data-node-type">
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setPriorSort((prev) => nextSort(prev, 'node_type'))
                        }
                      >
                        Node type
                        <span className="admin-sort__indicator">
                          {sortIndicator(priorSort, 'node_type')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setPriorSort((prev) => nextSort(prev, 'base_prior'))
                        }
                      >
                        Base prior
                        <span className="admin-sort__indicator">
                          {sortIndicator(priorSort, 'base_prior')}
                        </span>
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="admin-sort"
                        onClick={() =>
                          setPriorSort((prev) => nextSort(prev, 'updated_at'))
                        }
                      >
                        Updated
                        <span className="admin-sort__indicator">
                          {sortIndicator(priorSort, 'updated_at')}
                        </span>
                      </button>
                    </div>
                  </div>
                  {sortedNodeTypePriors.length === 0 && (
                    <small>No node types found.</small>
                  )}
                  {sortedNodeTypePriors.map((nodeType) => (
                    <div
                      className="row review-footer admin-row admin-row--data admin-row--data-node-type admin-row--clickable"
                      key={nodeType.node_type}
                      onClick={() => startEditNodeTypePrior(nodeType)}
                    >
                      <div>{nodeType.node_type}</div>
                      <div>{nodeType.base_prior ?? '-'}</div>
                      <div>{nodeType.updated_at ?? '-'}</div>
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
