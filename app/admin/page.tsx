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
  relation: 'contains' | 'sells';
  parent_review_count?: number;
  child_review_count?: number;
};

type AliasRow = {
  alias: string;
  node_id: number;
  node_name?: string;
  node_type?: string;
};

type DraftEdge = {
  draftId: string;
  parent_id: number | null;
  child_id: number | null;
  relation: Edge['relation'] | '';
};
type DraftNode = { draftId: string; name: string; type: string };
type DraftAlias = { draftId: string; alias: string; node_id: number | null };
type EditNode = NodeOption & { original_id: number };
type EditEdge = Edge & {
  original_parent_id: number;
  original_child_id: number;
  original_relation: Edge['relation'];
};
type EditAlias = AliasRow & { original_alias: string };

const relations: Array<Edge['relation']> = ['contains', 'sells'];

export default function EdgesAdminPage() {
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [drafts, setDrafts] = useState<DraftEdge[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<DraftNode[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<DraftAlias[]>([]);
  const [editNode, setEditNode] = useState<EditNode | null>(null);
  const [editEdge, setEditEdge] = useState<EditEdge | null>(null);
  const [editAlias, setEditAlias] = useState<EditAlias | null>(null);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges' | 'aliases'>('nodes');
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeSearchField, setNodeSearchField] = useState<'name' | 'type'>('name');
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeSearchField, setEdgeSearchField] = useState<'parent' | 'child' | 'relation'>(
    'parent'
  );
  const [aliasSearch, setAliasSearch] = useState('');
  const [aliasSearchField, setAliasSearchField] = useState<'alias' | 'node'>('alias');
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [nodeTypeSuggestTarget, setNodeTypeSuggestTarget] = useState<'edit' | 'draft' | null>(
    null
  );
  const [nodeTypeFilterActive, setNodeTypeFilterActive] = useState(false);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);

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
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [nodes]);

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

  const filteredEdges = useMemo(() => {
    const term = edgeSearch.trim().toLowerCase();
    if (!term) return edges;
    return edges.filter((edge) => {
      const parent = nodeMap.get(edge.parent_id);
      const child = nodeMap.get(edge.child_id);
      const parentName = parent?.name.toLowerCase() ?? '';
      const childName = child?.name.toLowerCase() ?? '';
      if (edgeSearchField === 'parent') return parentName.includes(term);
      if (edgeSearchField === 'child') return childName.includes(term);
      return edge.relation.toLowerCase().includes(term);
    });
  }, [edges, edgeSearch, edgeSearchField, nodeMap]);

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

  function addAliasDraft() {
    if (aliasDrafts.length > 0 || editAlias) return;
    if (nodes.length === 0) {
      setStatus('Add nodes first so aliases can reference them.');
      return;
    }
    const draft: DraftAlias = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      alias: '',
      node_id: null
    };
    setAliasDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addDraftRow() {
    if (drafts.length > 0 || editEdge) return;
    if (nodes.length === 0) {
      setStatus('Add nodes first so edges can reference them.');
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

  function updateAliasDraft(draftId: string, next: Partial<DraftAlias>) {
    setAliasDrafts((prev) =>
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
      setStatus(data.error || 'Failed to insert node.');
      return;
    }
    setNodeDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId ? { ...item, name: '', type: '' } : item
      )
    );
    await loadNodes();
    await loadAliases();
  }

  async function saveAliasDraft(draft: DraftAlias) {
    setStatus('');
    if (!draft.alias.trim()) {
      setStatus('Alias is required.');
      return;
    }
    if (!draft.node_id) {
      setStatus('Select a canonical node.');
      return;
    }
    const res = await fetch('/api/aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: draft.alias,
        node_id: draft.node_id
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert alias.');
      return;
    }
    setAliasDrafts((prev) =>
      prev.map((item) =>
        item.draftId === draft.draftId
          ? { ...item, alias: '', node_id: null }
          : item
      )
    );
    await loadAliases();
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
    await loadEdges();
    await loadAliases();
  }

  async function saveEditAlias(alias: EditAlias) {
    setStatus('');
    const res = await fetch('/api/aliases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: alias.alias,
        node_id: alias.node_id,
        original_alias: alias.original_alias
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
      setStatus(data.error || 'Failed to insert edge.');
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

  function removeAliasDraft(draftId: string) {
    setAliasDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
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
    if (aliasDrafts.length > 0) return;
    setEditAlias({
      ...alias,
      original_alias: alias.alias
    });
  }

  function cancelEditAlias() {
    setEditAlias(null);
  }

  async function deleteAlias(alias: AliasRow) {
    setStatus('');
    if (!window.confirm('Delete this alias?')) return;
    const res = await fetch('/api/aliases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: alias.alias, node_id: alias.node_id })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete alias.');
      return;
    }
    setEditAlias(null);
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
              <div className="row review-footer admin-row admin-row--form admin-row--form-alias admin-form">
                <div>
                  <input
                    aria-label="Alias"
                    placeholder="Alias"
                    value={editAlias.alias}
                    onChange={(event) =>
                      updateEditAlias({ alias: event.target.value })
                    }
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
            ) : aliasDrafts.length > 0 ? (
              aliasDrafts.map((draft) => (
                <div
                  className="row review-footer admin-row admin-row--form admin-row--form-alias admin-form"
                  key={draft.draftId}
                >
                  <div>
                    <input
                      aria-label="Alias"
                      placeholder="Alias"
                      value={draft.alias}
                      onChange={(event) =>
                        updateAliasDraft(draft.draftId, { alias: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <select
                      className={draft.node_id ? '' : 'admin-select--placeholder'}
                      aria-label="Canonical node"
                      value={draft.node_id ?? ''}
                      onChange={(event) =>
                        updateAliasDraft(draft.draftId, {
                          node_id: event.target.value
                            ? Number(event.target.value)
                            : null
                        })
                      }
                    >
                      <option value="">Select node</option>
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-row__actions admin-row__actions--form">
                    <div className="button-row">
                      <button type="button" onClick={() => saveAliasDraft(draft)}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--ghost"
                        onClick={() => removeAliasDraft(draft.draftId)}
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
                <button
                  type="button"
                  onClick={addAliasDraft}
                  disabled={aliasDrafts.length > 0 || !!editAlias}
                >
                  Insert alias
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'edges' && (
          <>
            {editEdge ? (
              <div className="row review-footer admin-row admin-row--form admin-form">
                <div>
                  <select
                    aria-label="Parent node"
                    value={editEdge.parent_id}
                    onChange={(event) =>
                      updateEditEdge({
                        parent_id: Number(event.target.value)
                      })
                    }
                  >
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    aria-label="Child node"
                    value={editEdge.child_id}
                    onChange={(event) =>
                      updateEditEdge({
                        child_id: Number(event.target.value)
                      })
                    }
                  >
                    {nodes.map((node) => (
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
                        relation: event.target.value as Edge['relation']
                      })
                    }
                  >
                    {relations.map((relation) => (
                      <option key={relation} value={relation}>
                        {relation}
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
                  className="row review-footer admin-row admin-row--form admin-form"
                  key={draft.draftId}
                >
                  <div>
                    <select
                      className={draft.parent_id ? '' : 'admin-select--placeholder'}
                      aria-label="Parent node"
                      value={draft.parent_id ?? ''}
                      onChange={(event) =>
                        updateDraft(draft.draftId, {
                          parent_id: event.target.value
                            ? Number(event.target.value)
                            : null
                        })
                      }
                    >
                      <option value="">Select parent</option>
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      className={draft.child_id ? '' : 'admin-select--placeholder'}
                      aria-label="Child node"
                      value={draft.child_id ?? ''}
                      onChange={(event) =>
                        updateDraft(draft.draftId, {
                          child_id: event.target.value ? Number(event.target.value) : null
                        })
                      }
                    >
                      <option value="">Select child</option>
                      {nodes.map((node) => (
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
                        updateDraft(draft.draftId, {
                          relation: event.target.value as Edge['relation'] | ''
                        })
                      }
                    >
                      <option value="">Select relation</option>
                      {relations.map((relation) => (
                        <option key={relation} value={relation}>
                          {relation}
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
                      event.target.value as 'parent' | 'child' | 'relation'
                    )
                  }
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="relation">Relation</option>
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
              {filteredNodes.length > 0 && (
                <div className="row review-footer admin-row admin-row--header">
                  <div>Id</div>
                  <div>Name</div>
                  <div>Type</div>
                </div>
              )}
              {filteredNodes.length === 0 && <small>No nodes found.</small>}
              {filteredNodes.map((node) => (
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
              {filteredAliases.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data-alias">
                  <div>Alias</div>
                  <div>Canonical node</div>
                </div>
              )}
              {filteredAliases.length === 0 && <small>No aliases found.</small>}
              {filteredAliases.map((alias) => {
                const node = nodeMap.get(alias.node_id);
                const nodeLabel = node ? `${node.name} (${node.type})` : alias.node_id;
                return (
                  <div
                    className="row review-footer admin-row admin-row--data admin-row--data-alias admin-row--clickable"
                    key={alias.alias}
                    onClick={() => startEditAlias(alias)}
                  >
                    <div>{alias.alias}</div>
                    <div>{nodeLabel}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'edges' && (
          <>
            <div className="admin-scroll">
              {filteredEdges.length > 0 && (
                <div className="row review-footer admin-row admin-row--header admin-row--data-edge">
                  <div>Parent</div>
                  <div>Child</div>
                  <div>Relation</div>
                </div>
              )}
              {filteredEdges.length === 0 && <small>No edges found.</small>}
              {filteredEdges.map((edge, index) => {
                const parent = nodeMap.get(edge.parent_id);
                const child = nodeMap.get(edge.child_id);
                return (
                  <div
                    className="row review-footer admin-row admin-row--data admin-row--data-edge admin-row--clickable"
                    key={`${edge.parent_id}-${edge.child_id}-${edge.relation}-${index}`}
                    onClick={() => startEditEdge(edge)}
                  >
                    <div>
                      {parent ? `${parent.name} (${parent.type})` : edge.parent_id}
                    </div>
                    <div>
                      {child ? `${child.name} (${child.type})` : edge.child_id}
                    </div>
                    <div>{edge.relation}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
