'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LabelBadgeRow, { buildLabelBadges } from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import { parseReviewFilters } from '@/lib/reviewFilters';
import { useSession } from '../components/useSession';
import ScopeToggle from '../components/ScopeToggle';
import { ENTITY_REVIEW_LABEL_LIMIT, ENTITY_REVIEWS_MAX_ITEMS } from '@/lib/constants';

type Review = {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  preview: string;
  entity_name: string;
  node_id: number | null;
  node_name: string | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  all_count: number;
  my_count: number;
};

export default function EntityReviewsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [labels, setLabels] = useState<ReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<{ created_at: string; review_id: number } | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  const {
    scope: effectiveScope,
    label: effectiveLabel,
    nodeId,
    nodeName: nodeNameParam,
    userId: userIdParam
  } =
    useMemo(
    () =>
      parseReviewFilters(searchParams, {
        isLoggedIn: Boolean(user),
        isAdmin: user?.role === 'admin'
      }),
    [searchParams, user]
  );

  const [resolvedNodeName, setResolvedNodeName] = useState('');

  const queryString = useMemo(() => {
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }, [searchParams]);

  const nodeSearchValue = useMemo(() => {
    if (nodeNameParam) return nodeNameParam;
    if (nodeId !== null) return resolvedNodeName;
    return '';
  }, [nodeId, nodeNameParam, resolvedNodeName]);

  const hasSpecificUserFilter = Boolean(userIdParam && effectiveScope === 'all');

  const nodeReviewStatsHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', effectiveScope);
    return `/node-review-stats?${params.toString()}`;
  }, [effectiveScope]);

  const allLabelBadges = useMemo(
    () => buildLabelBadges(labels, ENTITY_REVIEW_LABEL_LIMIT, effectiveScope),
    [effectiveScope, labels]
  );

  useEffect(() => {
    let isActive = true;
    const loadInitial = async () => {
      setIsLoading(true);
      setError('');
      setCursor(null);
      setHasMore(true);
      try {
        const res = await fetch(`/api/reviews${queryString}`);
        const data = await res.json();
        if (!isActive) return;
        setReviews(data.reviews || []);
        setLabels(data.labels || []);
        setCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.nextCursor));
      } catch {
        if (!isActive) return;
        setReviews([]);
        setLabels([]);
        setError('Failed to load reviews.');
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    };
    loadInitial();
    return () => {
      isActive = false;
    };
  }, [queryString, user]);

  useEffect(() => {
    if (!hasMore) return;
    if (reviews.length >= ENTITY_REVIEWS_MAX_ITEMS) {
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
      const params = new URLSearchParams(queryString.replace(/^\?/, ''));
      params.set('cursor_created_at', cursor.created_at);
      params.set('cursor_review_id', String(cursor.review_id));
      fetch(`/api/reviews?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setReviews((prev) => {
            const next = [...prev, ...(data.reviews ?? [])];
            return next.slice(0, ENTITY_REVIEWS_MAX_ITEMS);
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
  }, [cursor, hasMore, isLoading, isLoadingMore, queryString, reviews.length]);

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
    node?: string | null;
    node_id?: string | null;
    user_id?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.scope) {
      params.set('scope', next.scope);
    } else if (next.scope === null) {
      params.delete('scope');
    }
    if (!next.label || next.label.toLowerCase() === 'all') {
      params.delete('label');
    } else {
      params.set('label', next.label);
    }
    if (next.node_name) {
      params.set('node_name', next.node_name);
    } else if (next.node_name !== undefined) {
      params.delete('node_name');
    }
    if (next.node) {
      params.set('node', next.node);
    } else if (next.node !== undefined) {
      params.delete('node');
    }
    if (next.node_id) {
      params.set('node_id', next.node_id);
    } else if (next.node_id !== undefined) {
      params.delete('node_id');
    }
    if (next.user_id) {
      params.set('user_id', next.user_id);
    } else if (next.user_id !== undefined) {
      params.delete('user_id');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    let isActive = true;
    if (nodeId === null || nodeNameParam) {
      setResolvedNodeName('');
      return;
    }
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        const entities = (data?.entities ?? []) as Array<{ id: number; name: string }>;
        const match = entities.find((entity) => entity.id === nodeId);
        setResolvedNodeName(match?.name ?? '');
      })
      .catch(() => {
        if (!isActive) return;
        setResolvedNodeName('');
      });
    return () => {
      isActive = false;
    };
  }, [nodeId, nodeNameParam]);

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Entity Reviews</h1>
            <small>Browse reviews by scope and entity label.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href={nodeReviewStatsHref} className="button-link">
                Node review stats
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
              value={effectiveScope}
              onChange={(scope) =>
                updateQuery({
                  scope,
                  label: effectiveLabel,
                  user_id: scope === 'my' ? user?.user_id ?? null : null
                })
              }
            />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ scope: effectiveScope, label })}
            />
          </div>
          <div className="filter-row">
            <NodeNameSearch
              value={nodeSearchValue}
              onCommit={(value) =>
                updateQuery({
                  node_name: value.trim() ? value : null,
                  node: null,
                  node_id: null
                })
              }
              onClear={() =>
                updateQuery({ node_name: null, node: null, node_id: null, user_id: null })
              }
              forceClear={hasSpecificUserFilter}
              placeholder={
                hasSpecificUserFilter
                  ? 'Click Clear first'
                  : 'Type node name'
              }
            />
          </div>
        </section>
      </div>

      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />
      <section
        className="section section--reviews"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        <div className="review-scroll">
          <ul className="list list--snap">
          {isLoading && <small>Loading...</small>}
          {error && <small>{error}</small>}
          {!isLoading &&
            !error &&
            reviews.map((review) => {
              const nodeLabel = review.node_name ?? review.entity_name;
              return (
                <li key={review.id}>
                  <div className="review-line">
                    <span className="review-preview">
                      <span
                        className="badge badge--filter"
                        onClick={() => {
                          if (review.node_id === null) return;
                          updateQuery({
                            node: String(review.node_id),
                            node_name: null,
                            node_id: null
                          });
                        }}
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
                      type="button"
                      className="review-user"
                      onClick={() =>
                        updateQuery({
                          scope: 'all',
                          user_id: review.user_id
                        })
                      }
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
          {!isLoading && !error && reviews.length === 0 && <small>No reviews found.</small>}
          <div ref={loadMoreRef} />
          {isLoadingMore && <small>Loading more...</small>}
        </div>
      </section>
    </>
  );
}
