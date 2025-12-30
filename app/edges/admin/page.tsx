'use client';

import { useEffect, useMemo, useState } from 'react';

type NodeOption = {
  id: number;
  name: string;
  type: string;
};

type Edge = {
  parent_id: number;
  child_id: number;
  relation: 'contains' | 'sells';
};

type DraftEdge = Edge & { draftId: string };
type DraftNode = NodeOption & { draftId: string };

const relations: Array<Edge['relation']> = ['contains', 'sells'];

export default function EdgesAdminPage() {
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [drafts, setDrafts] = useState<DraftEdge[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<DraftNode[]>([]);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');

  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeOption>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

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

  async function deleteNode(node: NodeOption) {
    setStatus('');
    const res = await fetch('/api/nodes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete node.');
      return;
    }
    await loadNodes();
    await loadEdges();
  }

  async function deleteEdge(edge: Edge) {
    setStatus('');
    const res = await fetch('/api/edges', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Failed to delete edge.');
      return;
    }
    await loadEdges();
  }

  return (
    <section className="section">
      <div className="page-header">
        <div>
          <h1>Edges Admin</h1>
          <small>Manage nodes and relationships.</small>
        </div>
      </div>

      <div className="section">
        <div className="button-row">
          <button
            type="button"
            className={activeTab === 'nodes' ? '' : 'button-link button-link--ghost'}
            onClick={() => setActiveTab('nodes')}
          >
            Nodes
          </button>
          <button
            type="button"
            className={activeTab === 'edges' ? '' : 'button-link button-link--ghost'}
            onClick={() => setActiveTab('edges')}
          >
            Edges
          </button>
        </div>
      </div>

      {activeTab === 'nodes' && (
        <>
          <div className="section">
            <div className="button-row">
              <h2>New nodes</h2>
              <button type="button" onClick={addNodeDraft}>
                Insert node
              </button>
            </div>
            {nodeDrafts.length === 0 && <small>No pending node inserts.</small>}
            {nodeDrafts.map((draft) => (
              <div className="row review-footer" key={draft.draftId}>
                <div>
                  <label>Id</label>
                  <input
                    value={draft.id}
                    onChange={(event) =>
                      updateNodeDraft(draft.draftId, { id: Number(event.target.value) })
                    }
                  />
                </div>
                <div>
                  <label>Name</label>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      updateNodeDraft(draft.draftId, { name: event.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Type</label>
                  <input
                    value={draft.type}
                    onChange={(event) =>
                      updateNodeDraft(draft.draftId, { type: event.target.value })
                    }
                  />
                </div>
                <div>
                  <label>&nbsp;</label>
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
            {nodes.length === 0 && <small>No nodes yet.</small>}
            {nodes.map((node) => (
              <div className="row review-footer" key={`${node.id}-${node.name}-${node.type}`}>
                <div>
                  <label>Id</label>
                  <div>{node.id}</div>
                </div>
                <div>
                  <label>Name</label>
                  <div>{node.name}</div>
                </div>
                <div>
                  <label>Type</label>
                  <div>{node.type}</div>
                </div>
                <div>
                  <label>&nbsp;</label>
                  <button type="button" onClick={() => deleteNode(node)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'edges' && (
        <>
          <div className="section">
            <div className="button-row">
              <h2>New edges</h2>
              <button type="button" onClick={addDraftRow}>
                Insert edge
              </button>
            </div>
            {drafts.length === 0 && <small>No pending inserts.</small>}
            {drafts.map((draft) => (
              <div className="row review-footer" key={draft.draftId}>
                <div>
                  <label>Parent</label>
                  <select
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
                  <label>Child</label>
                  <select
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
                  <label>Relation</label>
                  <select
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
                <div>
                  <label>&nbsp;</label>
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
            {edges.length === 0 && <small>No edges yet.</small>}
            {edges.map((edge, index) => {
              const parent = nodeMap.get(edge.parent_id);
              const child = nodeMap.get(edge.child_id);
              return (
                <div
                  className="row review-footer"
                  key={`${edge.parent_id}-${edge.child_id}-${edge.relation}-${index}`}
                >
                  <div>
                    <label>Parent</label>
                    <div>
                      {parent ? `${parent.name} (${parent.type})` : edge.parent_id}
                    </div>
                  </div>
                  <div>
                    <label>Child</label>
                    <div>
                      {child ? `${child.name} (${child.type})` : edge.child_id}
                    </div>
                  </div>
                  <div>
                    <label>Relation</label>
                    <div>{edge.relation}</div>
                  </div>
                  <div>
                    <label>&nbsp;</label>
                    <button type="button" onClick={() => deleteEdge(edge)}>
                      Delete
                    </button>
                  </div>
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
