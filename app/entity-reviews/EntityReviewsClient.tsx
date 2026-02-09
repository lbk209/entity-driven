'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LabelBadgeRow, { buildLabelBadges } from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import EntitySummaryRow from '../components/EntitySummaryRow';
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
  entity_id: number | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  all_count: number;
  my_count: number;
};

export default function EntityReviewsClient() {
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
  const navigationRef = useRef(false);
  const [entitySummary, setEntitySummary] = useState<{
    reviewCount: number | null;
    score: number | null;
    posKeywords: string | null;
    negKeywords: string | null;
  } | null>(null);
  const lastSummaryKeyRef = useRef<string>('');
  const [entityMap, setEntityMap] = useState<Map<number, string>>(new Map());

  const {
    scope: scopeParam,
    label: effectiveLabel,
    nodeId: entityId
  } = useMemo(
    () => parseReviewFilters(searchParams),
    [searchParams]
  );
  const effectiveScope = scopeParam ?? 'all';

  const [resolvedEntityName, setResolvedEntityName] = useState('');
  const [specificUserId, setSpecificUserId] = useState<string | null>(null);
  const [reviewQuery, setReviewQuery] = useState('');
  const [entitySearchDraft, setEntitySearchDraft] = useState('');
  const [reviewSearchDraft, setReviewSearchDraft] = useState('');

  const searchParamString = searchParams.toString();
  const detailQueryString = useMemo(() => {
    return searchParamString ? `?${searchParamString}` : '';
  }, [searchParamString]);
  const queryString = useMemo(() => {
    return searchParamString ? `?${searchParamString}` : '';
  }, [searchParamString]);

  const entitySearchValue = useMemo(() => {
    if (entityId !== null) return resolvedEntityName;
    return '';
  }, [entityId, resolvedEntityName]);

  const hasSpecificUserFilter = Boolean(specificUserId);

  const scopeForData = !user && scopeParam === 'my' ? 'all' : effectiveScope;
  const isEntityContextActive = entityId !== null;

  useEffect(() => {
    setReviewQuery('');
    setReviewSearchDraft('');
  }, [entityId]);

  useEffect(() => {
    if (isEntityContextActive) return;
    setEntitySearchDraft(entitySearchValue);
  }, [entitySearchValue, isEntityContextActive]);

  useEffect(() => {
    if (!searchParams.get('user_id')) return;
    const params = new URLSearchParams(searchParamString);
    params.delete('user_id');
    const query = params.toString();
    navigationRef.current = true;
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParamString, searchParams]);

  const topEntitiesHref = useMemo(() => {
    const scopeValue = searchParams.get('scope');
    return scopeValue ? `/node-review-stats?scope=${scopeValue}` : '/node-review-stats';
  }, [searchParams]);

  const allLabelBadges = useMemo(
    () => buildLabelBadges(labels, ENTITY_REVIEW_LABEL_LIMIT, scopeForData),
    [labels, scopeForData]
  );

  useEffect(() => {
    let isActive = true;
    const loadInitial = async () => {
      setIsLoading(true);
      setError('');
      setCursor(null);
      setHasMore(true);
      try {
        const res = await fetch(`/api/reviews${queryString}`, {
          headers: specificUserId ? { 'x-review-user-id': specificUserId } : undefined
        });
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
  }, [queryString, specificUserId, user]);

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
      fetch(`/api/reviews?${params.toString()}`, {
        headers: specificUserId ? { 'x-review-user-id': specificUserId } : undefined
      })
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
  }, [cursor, queryString, hasMore, isLoading, isLoadingMore, reviews.length, specificUserId]);

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

  const entityInfo = useMemo(() => {
    if (entityId !== null) {
      const name = resolvedEntityName || `Entity ${entityId}`;
      return { id: entityId, name };
    }
    return null;
  }, [entityId, resolvedEntityName]);

  useEffect(() => {
    if (!entityInfo) {
      setEntitySummary(null);
      lastSummaryKeyRef.current = '';
      return;
    }
    const scopeValue = searchParams.get('scope') ?? '';
    const key = `${entityInfo.id ?? ''}|${entityInfo.name}|${scopeValue}`;
    if (lastSummaryKeyRef.current === key) return;
    lastSummaryKeyRef.current = key;
    const params = new URLSearchParams();
    if (scopeValue) {
      params.set('scope', scopeValue);
    }
    if (entityInfo.id !== null) {
      params.set('entity_id', String(entityInfo.id));
    }
    fetch(`/api/node-review-stats?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const stats = (data?.stats ?? []) as Array<{
          node_id: number;
          node_name: string | null;
          review_count: number;
          bayes_score: number;
          pos_keywords: string | null;
          neg_keywords: string | null;
        }>;
        let match = null as (typeof stats)[number] | null;
        if (entityInfo.id !== null) {
          match = stats.find((row) => row.node_id === entityInfo.id) ?? null;
        }
        setEntitySummary(
          match
            ? {
                reviewCount: match.review_count,
                score: match.bayes_score,
                posKeywords: match.pos_keywords,
                negKeywords: match.neg_keywords
              }
            : null
        );
      })
      .catch(() => {
        setEntitySummary(null);
      });
  }, [entityInfo, searchParams]);


  function updateQuery(next: {
    scope?: string | null;
    label?: string | null;
    entity_id?: string | null;
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
    if (next.entity_id) {
      params.set('entity_id', next.entity_id);
    } else if (next.entity_id !== undefined) {
      params.delete('entity_id');
    }
    const query = params.toString();
    navigationRef.current = true;
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (navigationRef.current) {
      navigationRef.current = false;
      return;
    }
    setSpecificUserId(null);
  }, [searchParams]);

  useEffect(() => {
    let isActive = true;
    if (entityId === null) {
      setResolvedEntityName('');
      return;
    }
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        const entities = (data?.entities ?? []) as Array<{ id: number; name: string }>;
        const match = entities.find((entity) => entity.id === entityId);
        setResolvedEntityName(match?.name ?? '');
      })
      .catch(() => {
        if (!isActive) return;
        setResolvedEntityName('');
      });
    return () => {
      isActive = false;
    };
  }, [entityId]);

  useEffect(() => {
    let isActive = true;
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        const entities = (data?.entities ?? []) as Array<{ id: number; name: string }>;
        const nextMap = new Map<number, string>();
        entities.forEach((entity) => {
          nextMap.set(entity.id, entity.name);
        });
        setEntityMap(nextMap);
      })
      .catch(() => {
        if (!isActive) return;
        setEntityMap(new Map());
      });
    return () => {
      isActive = false;
    };
  }, []);

  function commitEntitySelection(entity: { id: number; name: string }) {
    setResolvedEntityName(entity.name);
    setReviewQuery('');
    setReviewSearchDraft('');
    setEntitySearchDraft('');
    updateQuery({
      entity_id: String(entity.id),
    });
  }

  function clearEntitySelection() {
    setResolvedEntityName('');
    setEntitySearchDraft('');
    updateQuery({
      entity_id: null
    });
  }

  const filteredReviews = useMemo(() => {
    if (!isEntityContextActive) return reviews;
    const query = reviewQuery.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) => review.preview.toLowerCase().includes(query));
  }, [isEntityContextActive, reviewQuery, reviews]);

  function renderHighlightedText(text: string, query: string) {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const parts: React.ReactNode[] = [];
    let startIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery);
    while (matchIndex !== -1) {
      if (matchIndex > startIndex) {
        parts.push(text.slice(startIndex, matchIndex));
      }
      parts.push(
        <mark key={`${matchIndex}-${lowerQuery}`} className="review-highlight">
          {text.slice(matchIndex, matchIndex + lowerQuery.length)}
        </mark>
      );
      startIndex = matchIndex + lowerQuery.length;
      matchIndex = lowerText.indexOf(lowerQuery, startIndex);
    }
    if (startIndex < text.length) {
      parts.push(text.slice(startIndex));
    }
    return parts;
  }

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Entity Reviews</h1>
            <small>Explore reviews across entities.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href={topEntitiesHref} className="button-link">
                Top Entities
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
              onChange={(scope) => {
                setSpecificUserId(null);
                updateQuery({ scope, label: effectiveLabel });
              }}
            />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ label })}
            />
          </div>
          <div className="filter-row">
            {isEntityContextActive ? (
              <NodeNameSearch
                value={reviewQuery}
                inputValue={reviewSearchDraft}
                onInputValueChange={setReviewSearchDraft}
                onCommit={(value) => setReviewQuery(value)}
                onClear={() => {
                  setReviewSearchDraft('');
                  setReviewQuery('');
                }}
                placeholder="Search review text"
              />
            ) : (
              <NodeNameSearch
                mode="entity"
                value={entitySearchValue}
                inputValue={entitySearchDraft}
                onInputValueChange={setEntitySearchDraft}
                onCommit={commitEntitySelection}
                onClear={() => {
                  setSpecificUserId(null);
                  clearEntitySelection();
                }}
                forceClear={hasSpecificUserFilter}
                placeholder={
                  hasSpecificUserFilter
                    ? 'Filtered by user'
                    : 'Type entity name'
                }
              />
            )}
          </div>
        </section>
        {entityInfo && (
          <section className="section">
            <div className="entity-summary-panel">
              <button
                type="button"
                className="entity-summary-close"
                aria-label="Close entity summary"
                onClick={() => {
                  clearEntitySelection();
                }}
              >
                ×
              </button>
              <EntitySummaryRow
                name={entityInfo.name}
                posKeywords={entitySummary?.posKeywords ?? ''}
                negKeywords={entitySummary?.negKeywords ?? ''}
                reviewCount={entitySummary?.reviewCount ?? null}
                score={entitySummary?.score ?? null}
              />
            </div>
          </section>
        )}
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
            filteredReviews.map((review) => {
              const reviewEntityId = review.entity_id;
              const entityLabel =
                reviewEntityId !== null ? entityMap.get(reviewEntityId) ?? `Entity ${reviewEntityId}` : 'Unknown';
              const previewText =
                isEntityContextActive && reviewQuery.trim()
                  ? renderHighlightedText(review.preview, reviewQuery)
                  : review.preview;
              return (
                <li key={review.id}>
                  <div className="review-line">
                    <span className="review-preview">
                      {reviewEntityId !== null ? (
                        <span
                          className="badge badge--filter"
                          onClick={() => {
                            commitEntitySelection({
                              id: reviewEntityId,
                              name: entityLabel
                            });
                          }}
                        >
                          {entityLabel}
                        </span>
                      ) : (
                        <span className="badge badge--muted" aria-disabled="true">
                          {entityLabel}
                        </span>
                      )}
                      {review.sentiment && (
                        <span
                          className={`review-sentiment review-sentiment--${review.sentiment}`}
                          aria-label={`${review.sentiment} sentiment`}
                        >
                          {review.sentiment === 'positive' ? '😊' : '☹️'}
                        </span>
                      )}
                      <Link
                        className="review-link"
                        href={`/reviews/${review.id}${detailQueryString}`}
                      >
                        {previewText}
                      </Link>
                    </span>
                  </div>
                  <small className="review-meta">
                    <button
                      type="button"
                      className="review-user"
                      onClick={() => setSpecificUserId(review.user_id)}
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
          {!isLoading && !error && filteredReviews.length === 0 && <small>No reviews found.</small>}
          <div ref={loadMoreRef} />
          {isLoadingMore && <small>Loading more...</small>}
        </div>
      </section>
    </>
  );
}
