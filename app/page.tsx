'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type NodeSummary = {
  id: number;
  name: string;
  type: string;
};

type Review = {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  preview: string;
  entity_name: string;
  node_name: string | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  node_count: number;
};

export default function HomePage() {
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [labels, setLabels] = useState<ReviewLabelRow[]>([]);
  const [filterNode, setFilterNode] = useState('');
  const [filterNodeId, setFilterNodeId] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('All');
  const [showNodeSuggestions, setShowNodeSuggestions] = useState(false);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  const nodeNames = useMemo(() => nodes.map((node) => node.name), [nodes]);
  const nodeSuggestions = useMemo(() => {
    const trimmed = filterNode.trim().toLowerCase();
    return nodeNames
      .filter((name) => name.trim().length > 0)
      .filter((name) => {
        if (!trimmed) return true;
        return name.toLowerCase().includes(trimmed);
      })
      .slice(0, 20);
  }, [nodeNames, filterNode]);

  const allLabelBadges = useMemo(() => {
    const list = labels.map((item) => ({
      label: item.label,
      count: item.node_count
    }));
    return [{ label: 'All', count: null }, ...list];
  }, [labels]);

  useEffect(() => {
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => setNodes(data.entities || []))
      .catch(() => setNodes([]));
  }, []);

  useEffect(() => {
    const nodeParam = searchParams.get('node');
    const nodeNameParam = searchParams.get('node_name');
    if (nodeNameParam) {
      setFilterNode(nodeNameParam);
      setFilterNodeId('');
      return;
    }
    if (nodeParam) {
      setFilterNodeId(nodeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const trimmed = filterNode.trim();
    const userTrimmed = filterUser.trim();
    const params = new URLSearchParams();
    if (selectedLabel !== 'All') params.set('label', selectedLabel);
    if (filterNodeId.trim()) {
      params.set('node', filterNodeId.trim());
    } else if (trimmed) {
      params.set('node_name', trimmed);
    }
    if (userTrimmed) params.set('user', userTrimmed);
    const query = params.toString();
    const url = query ? `/api/reviews?${query}` : '/api/reviews';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setLabels(data.labels || []);
      })
      .catch(() => {
        setReviews([]);
        setLabels([]);
      });
  }, [filterNode, filterNodeId, filterUser, selectedLabel]);

  useEffect(() => {
    const stickyNode = stickyRef.current;
    if (!stickyNode) return;
    const updateHeight = () => {
      const nextHeight = stickyNode.offsetHeight;
      setStickyHeight((prev) => (prev === 0 ? nextHeight : Math.min(prev, nextHeight)));
    };
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(stickyNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!filterNodeId.trim() || filterNode.trim()) return;
    const matchedNode = nodes.find((node) => String(node.id) === filterNodeId);
    if (matchedNode) {
      setFilterNode(matchedNode.name);
    }
  }, [filterNode, filterNodeId, nodes]);

  function handleBadgeClick(name: string) {
    setFilterNode(name);
    const matchedNode = nodes.find((node) => node.name === name);
    setFilterNodeId(matchedNode ? String(matchedNode.id) : '');
  }

  function handleUserClick(userId: string) {
    setFilterUser(userId);
  }

  function handleClearFilters() {
    setFilterNode('');
    setFilterNodeId('');
    setFilterUser('');
    setSelectedLabel('All');
  }

  function handleBadgeKeyDown(name: string, event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    handleBadgeClick(name);
  }

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Entity Reviews</h1>
            <small>Browse recent reviews and filter by node name.</small>
          </div>
          <div className="button-row page-header__actions">
            <Link href="/node-review-stats" className="button-link">
              Node review stats
            </Link>
            <Link href="/reviews/new" className="button-link">
              Write review
            </Link>
          </div>
        </div>

        <section className="section">
          <div className="badge-row" role="radiogroup" aria-label="Filter by taxonomy label">
            {allLabelBadges.map((badge) => (
              <button
                key={badge.label}
                type="button"
                className={`badge badge--filter ${
                  selectedLabel === badge.label ? 'badge--selected' : 'badge--muted'
                }`}
                role="radio"
                aria-checked={selectedLabel === badge.label}
                onClick={() => setSelectedLabel(badge.label)}
                title={
                  badge.count === null
                    ? 'All'
                    : `${badge.label} (${badge.count})`
                }
              >
                {badge.count === null
                  ? badge.label
                  : `${badge.label} (${badge.count})`}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <div className="entity-input-wrap">
              <input
                id="node-search"
                aria-label="Filter by node name"
                placeholder="Type node name"
                value={filterNode}
                onChange={(event) => {
                  setFilterNode(event.target.value);
                  setFilterNodeId('');
                  setShowNodeSuggestions(true);
                }}
                onFocus={() => setShowNodeSuggestions(true)}
                onBlur={() => setShowNodeSuggestions(false)}
                autoComplete="off"
              />
              {showNodeSuggestions && nodeSuggestions.length > 0 && (
                <div className="entity-suggestions">
                  {nodeSuggestions.map((name) => (
                    <button
                      type="button"
                      key={name}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setFilterNode(name);
                        const matchedNode = nodes.find((node) => node.name === name);
                        setFilterNodeId(matchedNode ? String(matchedNode.id) : '');
                        setShowNodeSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(filterNode.trim() || filterUser.trim()) && (
              <button className="clear-button" type="button" onClick={handleClearFilters}>
                Clear
              </button>
            )}
          </div>
          <small>Filtering only matches linked nodes, not review text.</small>
          {filterUser.trim() && (
            <small>Filtering by user: {filterUser.trim()}</small>
          )}
        </section>
      </div>
      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />

      <section
        className="section section--reviews"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        <div className="review-scroll">
          <ul className="list list--snap">
            {reviews.map((review) => {
              const nodeLabel = review.node_name ?? review.entity_name;
              return (
                <li key={review.id}>
                  <div className="review-line">
                    <span className="review-preview">
                      <span
                        className="badge badge--filter"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleBadgeClick(nodeLabel);
                        }}
                        onKeyDown={(event) => handleBadgeKeyDown(nodeLabel, event)}
                      >
                        {nodeLabel}
                      </span>
                    {review.sentiment && (
                      <span
                        className={`review-sentiment review-sentiment--${review.sentiment}`}
                        aria-label={`${review.sentiment} sentiment`}
                      >
                        {review.sentiment === 'positive' ? '😊' : '☹️'}
                      </span>
                    )}
                    <Link className="review-link" href={`/reviews/${review.id}`}>
                      {review.preview}
                    </Link>
                  </span>
                </div>
                <small className="review-meta">
                  <button
                    className="review-user"
                    type="button"
                    onClick={() => handleUserClick(review.user_id)}
                  >
                    {review.user_id}
                  </button>{' '}
                  ·{' '}
                  {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                </small>
                </li>
              );
            })}
          </ul>
            {reviews.length === 0 && <small>No reviews found.</small>}
        </div>
      </section>
    </>
  );
}
