# Review Platform Architecture (Target)

## 1. Resource Model

Independent resources:

- Entity  
  Canonical URL: /entities/[slug]  
  Role: SEO hub and structured data anchor.

- Review  
  Canonical URL: /reviews/[id]  
  Role: Independent content document.

- User  
  Canonical URL: /users/[user_id]  
  Role: Public profile document (shareable; not primary SEO asset).

- Comment  
  Not an independent resource.  
  Shareable via fragment only:
  /reviews/[id]#comment-[comment_id]

Fragments do NOT create separate canonical resources.

## 2. Collections & Discovery

Two types of collection pages:

### A. Application Discovery Hub
Path: /entities

Purpose:
- Replaces /entity-reviews.
- Supports filtering (entity name, user filter, scope, etc.).
- Not treated as a primary SEO ranking asset.

### B. Curated SEO Collections

Stable taxonomy-based collections are SEO indexable.

Canonical pattern:
- /labels/[label-slug]

These represent meaningful, finite, admin-defined groupings of entities.

Freeform search queries (e.g., entity_name filters) are NOT SEO resources in v1.

## 3. URL & Canonical Policy

- Clean path URLs only.
- Query parameters are not canonical targets.
- Canonical must always reference the clean path resource.
- Lowercase paths.
- No trailing slash.
- Slugs are stable and preferably immutable.

## 4. Transitional Direction

The following routes are transitional and will align with this architecture:

- /entity-reviews -> to be replaced by /entities
- /top-entities -> to be replaced by label-based collection routes
- /reviews/[id] -> to function as canonical review page (not only a redirect/highlight helper)

This section describes intended structural direction only.
No implementation changes are required.
