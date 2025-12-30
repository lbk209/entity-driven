'use client';

import { useEffect, useMemo, useState } from 'react';

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

type DraftEdge = Edge & { draftId: string };
type DraftNode = NodeOption & { draftId: string };
type EditNode = NodeOption & { original_id: number };
type EditEdge = Edge & {
  original_parent_id: number;
  original_child_id: number;
  original_relation: Edge['relation'];
};

const relations: Array<Edge['relation']> = ['contains', 'sells'];

export default function EdgesAdminPage() {
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [drafts, setDrafts] = useState<DraftEdge[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<DraftNode[]>([]);
  const [editNode, setEditNode] = useState<EditNode | null>(null);
  const [editEdge, setEditEdge] = useState<EditEdge | null>(null);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');
  const [nodeSearch, setNodeSearch] = useState('');
  const [edgeSearch, setEdgeSearch] = useState('');

  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeOption>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const term = nodeSearch.trim().toLowerCase();
    if (!term) return nodes;
    return nodes.filter((node) => node.name.toLowerCase().includes(term));
  }, [nodes, nodeSearch]);

  const filteredEdges = useMemo(() => {
    const term = edgeSearch.trim().toLowerCase();
    if (!term) return edges;
    return edges.filter((edge) => {
      const parent = nodeMap.get(edge.parent_id);
      const child = nodeMap.get(edge.child_id);
      const parentName = parent?.name.toLowerCase() ?? '';
      const childName = child?.name.toLowerCase() ?? '';
      return parentName.includes(term) || childName.includes(term);
    });
  }, [edges, edgeSearch, nodeMap]);

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

  function addNodeDraft() {
    if (nodeDrafts.length > 0 || editNode) return;
    const nextId = nodes.reduce((maxId, node) => Math.max(maxId, node.id), 0) + 1;
    const draft: DraftNode = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      id: nextId,
      name: '',
      type: ''
    };
    setNodeDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function addDraftRow() {
    if (drafts.length > 0 || editEdge) return;
    if (nodes.length === 0) {
      setStatus('Add nodes first so edges can reference them.');
      return;
    }
    const parentId = nodes[0].id;
    const childId = nodes[0].id;
    const draft: DraftEdge = {
      draftId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parent_id: parentId,
      child_id: childId,
      relation: 'contains'
    };
    setDrafts((prev) => [...prev, draft]);
    setStatus('');
  }

  function updateDraft(draftId: string, next: Partial<Edge>) {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...next } : draft
      )
    );
  }

  function updateNodeDraft(draftId: string, next: Partial<NodeOption>) {
    setNodeDrafts((prev) =>
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

  async function saveNodeDraft(draft: DraftNode) {
    setStatus('');
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: draft.id,
        name: draft.name,
        type: draft.type
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to insert node.');
      return;
    }
    setNodeDrafts((prev) => prev.filter((item) => item.draftId !== draft.draftId));
    await loadNodes();
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
  }

  async function saveDraft(draft: DraftEdge) {
    setStatus('');
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
    setDrafts((prev) => prev.filter((item) => item.draftId !== draft.draftId));
    await loadEdges();
  }

  function removeDraft(draftId: string) {
    setDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function removeNodeDraft(draftId: string) {
    setNodeDrafts((prev) => prev.filter((item) => item.draftId !== draftId));
  }

  function startEditNode(node: NodeOption) {
    if (nodeDrafts.length > 0) return;
    setEditNode({
      ...node,
      original_id: node.id
    });
  }

  function cancelEditNode() {
    setEditNode(null);
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
    <section className="section">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <small>Manage nodes and relationships.</small>
        </div>
      </div>

      <div className="section">
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'nodes'}
            className={`admin-tab ${activeTab === 'nodes' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('nodes')}
          >
            <strong>Nodes</strong>
            <span>Manage node rows</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edges'}
            className={`admin-tab ${activeTab === 'edges' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('edges')}
          >
            <strong>Edges</strong>
            <span>Manage relationships</span>
          </button>
        </div>
      </div>

      {activeTab === 'nodes' && (
        <>
          <div className="section">
            <h2>Nodes</h2>
            <div className="admin-toolbar">
              <input
                placeholder="Search node name"
                value={nodeSearch}
                onChange={(event) => setNodeSearch(event.target.value)}
              />
              <button type="button" onClick={addNodeDraft} disabled={nodeDrafts.length > 0 || !!editNode}>
                Insert node
              </button>
            </div>
            {editNode && (
              <div className="row review-footer admin-row admin-row--form admin-form">
                <div>
                  <input
                    aria-label="Node id"
                    placeholder="Id"
                    value={editNode.id}
                    onChange={(event) =>
                      updateEditNode({ id: Number(event.target.value) })
                    }
                  />
                </div>
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
                  <input
                    aria-label="Node type"
                    placeholder="Type"
                    value={editNode.type}
                    onChange={(event) =>
                      updateEditNode({ type: event.target.value })
                    }
                  />
                </div>
                <div className="admin-row__actions admin-row__actions--form">
                  <div className="button-row">
                    <button type="button" onClick={() => saveEditNode(editNode)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={cancelEditNode}
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={() => deleteNode(editNode)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            {nodeDrafts.length === 0 && <small>No pending node inserts.</small>}
            {nodeDrafts.map((draft) => (
              <div
                className="row review-footer admin-row admin-row--form admin-form"
                key={draft.draftId}
              >
                <div>
                  <input
                    aria-label="Node id"
                    placeholder="Id"
                    value={draft.id}
                    onChange={(event) =>
                      updateNodeDraft(draft.draftId, { id: Number(event.target.value) })
                    }
                  />
                </div>
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
                  <input
                    aria-label="Node type"
                    placeholder="Type"
                    value={draft.type}
                    onChange={(event) =>
                      updateNodeDraft(draft.draftId, { type: event.target.value })
                    }
                  />
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
            ))}
          </div>

          <div className="section">
            <h2>Existing nodes</h2>
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

      {activeTab === 'edges' && (
        <>
          <div className="section">
            <h2>Edges</h2>
            <div className="admin-toolbar">
              <input
                placeholder="Search by parent/child name"
                value={edgeSearch}
                onChange={(event) => setEdgeSearch(event.target.value)}
              />
              <button type="button" onClick={addDraftRow} disabled={drafts.length > 0 || !!editEdge}>
                Insert edge
              </button>
            </div>
            {editEdge && (
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
                      Save
                    </button>
                    <button
                      type="button"
                      className="button-link button-link--ghost"
                      onClick={cancelEditEdge}
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={() => deleteEdge(editEdge)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            {drafts.length === 0 && <small>No pending inserts.</small>}
            {drafts.map((draft) => (
              <div
                className="row review-footer admin-row admin-row--form admin-form"
                key={draft.draftId}
              >
                <div>
                  <select
                    aria-label="Parent node"
                    value={draft.parent_id}
                    onChange={(event) =>
                      updateDraft(draft.draftId, { parent_id: Number(event.target.value) })
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
                    value={draft.child_id}
                    onChange={(event) =>
                      updateDraft(draft.draftId, { child_id: Number(event.target.value) })
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
                    value={draft.relation}
                    onChange={(event) =>
                      updateDraft(draft.draftId, {
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
            ))}
          </div>

          <div className="section">
            <h2>Existing edges</h2>
            {filteredEdges.length > 0 && (
              <div className="row review-footer admin-row admin-row--header">
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
                  className="row review-footer admin-row admin-row--data admin-row--clickable"
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

      {status && <small>{status}</small>}
    </section>
  );
}
