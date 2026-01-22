'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import LabelBadgeRow, { buildLabelBadges } from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import { useSession } from '../components/useSession';
import { parseReviewFilters } from '@/lib/reviewFilters';
import ScopeToggle from '../components/ScopeToggle';
import { NODE_REVIEW_LABEL_LIMIT } from '@/lib/constants';

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [stats, setStats] = useState<NodeReviewStatRow[]>([]);
  const [labels, setLabels] = useState<NodeReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const searchParamString = searchParams.toString();

  const sortKeyParam = searchParams.get('sort_key');
  const sortDirParam = searchParams.get('sort_dir');

  const { scope: effectiveScope, label: effectiveLabel, nodeName: nodeNameParam } = useMemo(
    () =>
      parseReviewFilters(searchParams, {
        isLoggedIn: Boolean(user),
        isAdmin: user?.role === 'admin'
      }),
    [searchParams, user]
  );
  const sort = useMemo<SortState<'name' | 'review_count' | 'bayes_score'>>(() => {
    const key =
      sortKeyParam === 'name' || sortKeyParam === 'bayes_score' || sortKeyParam === 'review_count'
        ? sortKeyParam
        : 'review_count';
    const direction = sortDirParam === 'asc' ? 'asc' : 'desc';
    return { key, direction };
  }, [sortDirParam, sortKeyParam]);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      setIsLoading(true);
      setError(null);
      try {
        const url = searchParamString
          ? `/api/node-review-stats?${searchParamString}`
          : '/api/node-review-stats';
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
  }, [searchParamString, user]);

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

  function updateQuery(next: {
    scope?: string | null;
    label?: string | null;
    node_name?: string | null;
    sort_key?: string | null;
    sort_dir?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.scope) {
      params.set('scope', next.scope);
    } else if (next.scope === null) {
      params.delete('scope');
    }
    if (next.label && next.label.toLowerCase() !== 'all') {
      params.set('label', next.label);
    } else if (next.label !== undefined) {
      params.delete('label');
    }
    if (next.node_name) {
      params.set('node_name', next.node_name);
    } else if (next.node_name !== undefined) {
      params.delete('node_name');
    }
    if (next.sort_key) {
      params.set('sort_key', next.sort_key);
    } else if (next.sort_key === null) {
      params.delete('sort_key');
    }
    if (next.sort_dir) {
      params.set('sort_dir', next.sort_dir);
    } else if (next.sort_dir === null) {
      params.delete('sort_dir');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const allLabelBadges = useMemo(
    () => buildLabelBadges(labels, NODE_REVIEW_LABEL_LIMIT),
    [labels]
  );

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Node Review Stats</h1>
            <small>Browse cached node scores used for ranking.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href="/entity-reviews" className="button-link">
                All reviews
              </Link>
              <Link href="/reviews/new" className="button-link">
                Write review
              </Link>
              <AuthButton />
            </div>
          </div>
        </div>
        <section className="section">
          <div className="filter-row filter-row--inline">
            <ScopeToggle value={effectiveScope} onChange={(scope) => updateQuery({ scope })} />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ label })}
            />
          </div>
          <div className="filter-row">
            <NodeNameSearch
              value={nodeNameParam}
              onCommit={(value) =>
                updateQuery({ node_name: value.trim() ? value : null })
              }
              onClear={() => updateQuery({ node_name: null })}
            />
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
                      onClick={() => {
                        const next = nextSort(sort, 'name');
                        updateQuery({ sort_key: next.key, sort_dir: next.direction });
                      }}
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
                      onClick={() => {
                        const next = nextSort(sort, 'review_count');
                        updateQuery({ sort_key: next.key, sort_dir: next.direction });
                      }}
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
                      onClick={() => {
                        const next = nextSort(sort, 'bayes_score');
                        updateQuery({ sort_key: next.key, sort_dir: next.direction });
                      }}
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
