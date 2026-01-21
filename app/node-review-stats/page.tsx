'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type SortDirection = 'asc' | 'desc';
type SortState<T extends string> = { key: T; direction: SortDirection };

type NodeReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
};

type NodeReviewLabelRow = {
  label: string;
  node_count: number;
};

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

function formatScore(value: number) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(3);
}

export default function NodeReviewStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<NodeReviewStatRow[]>([]);
  const [labels, setLabels] = useState<NodeReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterNode, setFilterNode] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('All');
  const [sort, setSort] = useState<SortState<'name' | 'review_count' | 'bayes_score'>>({
    key: 'review_count',
    direction: 'desc'
  });
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      setIsLoading(true);
      setError(null);
      try {
        const trimmed = filterNode.trim();
        const params = new URLSearchParams();
        if (selectedLabel !== 'All') params.set('label', selectedLabel);
        if (trimmed) params.set('node_name', trimmed);
        params.set('sort_key', sort.key);
        params.set('sort_dir', sort.direction);
        const query = params.toString();
        const url = query ? `/api/node-review-stats?${query}` : '/api/node-review-stats';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to load node review stats');
        }
        const data = (await res.json()) as {
          stats?: NodeReviewStatRow[];
          labels?: NodeReviewLabelRow[];
        };
        if (isActive) {
          setStats(data.stats ?? []);
          setLabels(data.labels ?? []);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      isActive = false;
    };
  }, [filterNode, selectedLabel, sort]);

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

  const allLabelBadges = useMemo(() => {
    const list = labels.map((item) => ({
      label: item.label,
      count: item.node_count
    }));
    return [{ label: 'All', count: null }, ...list];
  }, [labels]);

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Node Review Stats</h1>
            <small>Browse cached node scores used for ranking.</small>
          </div>
          <div className="button-row page-header__actions">
            <Link href="/" className="button-link">
              All reviews
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
                {badge.count === null ? badge.label : `${badge.label} (${badge.count})`}
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
                onChange={(event) => setFilterNode(event.target.value)}
              />
            </div>
            {filterNode.trim() && (
              <button
                className="clear-button"
                type="button"
                onClick={() => setFilterNode('')}
              >
                Clear
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />
      <section
        className="section section--admin"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        <div className="admin-scroll">
          {isLoading && <div className="admin-row">Loading...</div>}
          {error && <div className="admin-row">{error}</div>}
          {!isLoading && !error && (
            <>
              <div className="row review-footer admin-row admin-row--header admin-row--data admin-row--data-node-review-stats">
                <div>
                  <button
                    type="button"
                    className="admin-sort"
                    onClick={() => setSort((prev) => nextSort(prev, 'name'))}
                  >
                    Node
                    <span className="admin-sort__indicator">
                      {sortIndicator(sort, 'name')}
                    </span>
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="admin-sort"
                    onClick={() => setSort((prev) => nextSort(prev, 'review_count'))}
                  >
                    Review Count
                    <span className="admin-sort__indicator">
                      {sortIndicator(sort, 'review_count')}
                    </span>
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="admin-sort"
                    onClick={() => setSort((prev) => nextSort(prev, 'bayes_score'))}
                  >
                    Bayes Score
                    <span className="admin-sort__indicator">
                      {sortIndicator(sort, 'bayes_score')}
                    </span>
                  </button>
                </div>
              </div>
              {stats.map((row) => (
                <div
                  className="row review-footer admin-row admin-row--data admin-row--data-node-review-stats admin-row--clickable"
                  key={row.node_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    router.push(`/?node=${encodeURIComponent(String(row.node_id))}`);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    router.push(`/?node=${encodeURIComponent(String(row.node_id))}`);
                  }}
                >
                  <div className="admin-cell-wrap">
                    {row.node_name ?? `Node ${row.node_id}`}
                  </div>
                  <div className="admin-cell-wrap">{row.review_count}</div>
                  <div className="admin-cell-wrap">{formatScore(row.bayes_score)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
