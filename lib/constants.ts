export const ENTITY_REVIEW_LABEL_LIMIT = 5;
export const NODE_REVIEW_LABEL_LIMIT = 5;
export const ENTITY_REVIEWS_PAGE_SIZE = 25;
export const ENTITY_REVIEWS_MAX_ITEMS = 200;
export const NODE_REVIEW_STATS_PAGE_SIZE = 25;
export const NODE_REVIEW_STATS_MAX_ITEMS = 200;
export const NODE_REVIEW_KEYWORD_VERSION = 'kw_v1';

export type UserTopEntitySignal = 'review_count' | 'most_recent_review_at';
export type UserTopEntitySortMode = 'most_reviewed' | 'most_recent';

export const USER_TOP_ENTITIES_LIMIT = 5;
export const USER_TOP_ENTITY_SORT_MODE: UserTopEntitySortMode = 'most_reviewed';
export const USER_TOP_ENTITY_SIGNAL_WEIGHTS: Record<UserTopEntitySignal, number> = {
  review_count: 1,
  most_recent_review_at: 0
};
