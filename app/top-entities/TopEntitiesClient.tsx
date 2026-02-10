'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import LabelBadgeRow from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import EntitySummaryRow from '../components/EntitySummaryRow';
import { useSession } from '../components/useSession';
import { parseReviewFilters } from '@/lib/reviewFilters';
import ScopeToggle from '../components/ScopeToggle';
import {
  NODE_REVIEW_LABEL_LIMIT,
  NODE_REVIEW_STATS_MAX_ITEMS
} from '@/lib/constants';

type SortDirection = 'asc' | 'desc';
type SortState<T extends string> = { key: T; direction: SortDirection };

type EntityReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
  pos_keywords: string | null;
  neg_keywords: string | null;
};

type EntityReviewLabelRow = {
  label: string;
  all_count: number;
  my_count: number;
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

export default function TopEntitiesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [stats, setStats] = useState<EntityReviewStatRow[]>([]);
  const [labels, setLabels] = useState<EntityReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<{
    score: number;
    count: number;
    node_id: number;
    name: string;
  } | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const searchParamString = searchParams.toString();

  const sortKeyParam = searchParams.get('sort_key');
  const sortDirParam = searchParams.get('sort_dir');

  const { scope: scopeParam, label: effectiveLabel } = useMemo(
    () => parseReviewFilters(searchParams),
    [searchParams]
  );
  const effectiveScope = scopeParam ?? 'all';
  const sort = useMemo<SortState<'name' | 'review_count' | 'bayes_score'>>(() => {
    const key =
      sortKeyParam === 'name' || sortKeyParam === 'bayes_score' || sortKeyParam === 'review_count'
        ? sortKeyParam
        : 'review_count';
    const direction = sortDirParam === 'asc' ? 'asc' : 'desc';
    return { key, direction };
  }, [sortDirParam, sortKeyParam]);

  const entityReviewsHref = useMemo(() => {
    const scopeValue = searchParams.get('scope');
    return scopeValue ? `/entity-reviews?scope=${scopeValue}` : '/entity-reviews';
  }, [searchParams]);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      setIsLoading(true);
      setError(null);
      setHasMore(true);
      setCursor(null);
      try {
        const url = searchParamString
          ? `/api/node-review-stats?${searchParamString}`
          : '/api/node-review-stats';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to load entity stats');
        }
        const data = (await res.json()) as {
          stats?: EntityReviewStatRow[];
          labels?: EntityReviewLabelRow[];
          nextCursor?: {
            score: number;
            count: number;
            node_id: number;
            name: string;
          } | null;
        };
        if (isActive) {
          setStats(data.stats ?? []);
          setLabels(data.labels ?? []);
          setCursor(data.nextCursor ?? null);
          setHasMore(Boolean(data.nextCursor));
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
          setHasMore(false);
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
    if (!hasMore) return;
    if (stats.length >= NODE_REVIEW_STATS_MAX_ITEMS) {
      setHasMore(false);
      return;
    }
    const node = loadMoreRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (isFetchingRef.current || isLoading || isLoadingMore) return;
      if (!hasMore || !cursor) return;
      isFetchingRef.current = true;
      setIsLoadingMore(true);
      const params = new URLSearchParams(searchParamString);
      params.set('cursor_score', String(cursor.score));
      params.set('cursor_count', String(cursor.count));
      params.set('cursor_node_id', String(cursor.node_id));
      if (sort.key === 'name') {
        params.set('cursor_name', cursor.name);
      }
      fetch(`/api/node-review-stats?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setStats((prev) => {
            const next = [...prev, ...(data.stats ?? [])];
            return next.slice(0, NODE_REVIEW_STATS_MAX_ITEMS);
          });
          if (data.nextCursor) {
            setCursor(data.nextCursor);
            setHasMore(true);
          } else {
            setHasMore(false);
          }
        })
        .catch(() => {
          setHasMore(false);
        })
        .finally(() => {
          isFetchingRef.current = false;
          setIsLoadingMore(false);
        });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, hasMore, isLoading, isLoadingMore, searchParamString, sort.key, stats.length]);

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
    () =>
      labels.slice(0, NODE_REVIEW_LABEL_LIMIT).map((item) => ({
        label: item.label,
        count: effectiveScope === 'my' ? item.my_count : item.all_count
      })),
    [effectiveScope, labels]
  );

  const [searchDraft, setSearchDraft] = useState('');
  const [searchCommitted, setSearchCommitted] = useState('');

  const filteredStats = useMemo(() => {
    const query = searchCommitted.trim().toLowerCase();
    if (!query) return stats;
    return stats.filter((row) => {
      const name = row.node_name?.toLowerCase() ?? '';
      if (name.includes(query)) return true;
      const posKeywords = row.pos_keywords?.toLowerCase() ?? '';
      const negKeywords = row.neg_keywords?.toLowerCase() ?? '';
      return posKeywords.includes(query) || negKeywords.includes(query);
    });
  }, [searchCommitted, stats]);

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Top Entities</h1>
            <small>Discover top-rated entities.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href={entityReviewsHref} className="button-link">
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
            <ScopeToggle
              value={user ? effectiveScope : 'all'}
              disabled={!user}
              onChange={(scope) => updateQuery({ scope })}
            />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ label })}
            />
          </div>
          <div className="filter-row">
            <NodeNameSearch
              value={searchCommitted}
              inputValue={searchDraft}
              onInputValueChange={setSearchDraft}
              onCommit={(value) => setSearchCommitted(value)}
              onClear={() => {
                setSearchDraft('');
                setSearchCommitted('');
              }}
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
              <ul className="list list--snap">
                {filteredStats.map((row) => (
                  <li
                    key={row.node_id}
                    className="admin-row--clickable list-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const params = new URLSearchParams();
                      const scopeValue = searchParams.get('scope');
                      if (scopeValue) {
                        params.set('scope', scopeValue);
                      }
                      params.set('entity_id', String(row.node_id));
                      const query = params.toString();
                      router.push(query ? `/entity-reviews?${query}` : '/entity-reviews');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      const params = new URLSearchParams();
                      const scopeValue = searchParams.get('scope');
                      if (scopeValue) {
                        params.set('scope', scopeValue);
                      }
                      params.set('entity_id', String(row.node_id));
                      const query = params.toString();
                      router.push(query ? `/entity-reviews?${query}` : '/entity-reviews');
                    }}
                  >
                    <EntitySummaryRow
                      name={row.node_name ?? `Entity ${row.node_id}`}
                      posKeywords={row.pos_keywords}
                      negKeywords={row.neg_keywords}
                      reviewCount={row.review_count}
                      score={row.bayes_score}
                    />
                  </li>
                ))}
              </ul>
              <div ref={loadMoreRef} />
              {isLoadingMore && <div className="admin-row">Loading more...</div>}
            </>
          )}
        </div>
      </section>
    </>
  );
}
