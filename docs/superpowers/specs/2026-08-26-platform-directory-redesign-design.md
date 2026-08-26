# Platform Directory Redesign — Design Specification

Date: 2026-08-26
Repository: `devmyskilla/Devmyskilltre`
Status: Approved design, awaiting spec review

## 1. Goal

Reposition the product from a course-first catalog into a professional platform-discovery directory. The homepage should help a visitor answer: **Which learning platform is best for my goal, language, budget, and certificate needs?**

The existing course catalog remains available, but it becomes secondary. Platform discovery, comparison, and platform profiles become the primary experience.

## 2. Current State

The current homepage is course-first:
- Hero copy asks what the visitor wants to learn.
- Learning paths and course filters occupy the main discovery flow.
- Platforms appear as a simple section with text search and cards.
- Platform cards use data from `PLATFORMS_DATA`, with runtime course counts mixed in.
- `platform.html` mainly acts as a container for a platform's verified course list.

The current Supabase `platforms` table already contains the stable platform identity and ingestion fields:
- `id`
- `external_id`
- `name`
- `slug`
- `description`
- `logo_url`
- `official_url`
- `catalog_url`
- `status`
- `expected_count`
- `expected_count_type`
- `last_verified`
- timestamps

There are 40 active platform records in the current project scope.

## 3. Product Direction

### Recommended approach: Platform Directory Pro

Build a searchable and filterable directory with rich platform cards, comparison, featured categories, and detailed platform profiles.

This approach is preferred over a purely visual category browser or a quiz-first experience because it:
- preserves fast browsing,
- supports comparison,
- works well with 40 platforms,
- remains useful when platform metadata is incomplete,
- provides a foundation for a future recommendation assistant.

## 4. Scope

### In scope

1. Platform-first homepage hero.
2. Platform statistics sourced from Supabase.
3. Category discovery.
4. Featured platforms.
5. Searchable and filterable platform directory.
6. Platform comparison for up to three platforms.
7. Rich platform detail page.
8. Supabase as the primary platform-data source.
9. Local `PLATFORMS_DATA` as a read-only fallback when Supabase is unavailable.
10. Arabic, English, and Turkish presentation using the existing language system.
11. Existing theme support and responsive behavior.
12. Existing course catalog retained as a secondary experience.

### Out of scope for this iteration

- User accounts.
- Reviews submitted by users.
- Paid subscriptions.
- AI chat/recommendation assistant.
- Scraping or automatically changing platform editorial descriptions in the browser.
- Rebuilding the course ingestion pipeline.
- Removing the existing course catalog.

## 5. Homepage Information Architecture

The homepage order becomes:

1. **Header**
   - Brand.
   - Platforms.
   - Categories.
   - Compare.
   - Courses as a secondary navigation item.
   - Theme and language controls.

2. **Platform-first Hero**
   - Primary headline: discover the right learning platform.
   - Large platform search field.
   - Quick filter chips: Free content, Certificates, Arabic, English, Technology, Business.
   - Primary CTA: Browse platforms.
   - Secondary CTA: Compare platforms.

3. **Platform Statistics**
   - Active platforms.
   - Platforms with free content.
   - Platforms offering certificates.
   - Platforms verified recently.

4. **Browse by Category**
   - Technology & Programming.
   - Data & AI.
   - Business & Marketing.
   - Languages.
   - Academic / University learning.
   - Career & Professional skills.
   - Other category only when needed by the data.

5. **Featured Platforms**
   - A small editorial shortlist, controlled by `featured` metadata.
   - No ranking claims unless supported by an explicit scoring methodology.

6. **All Platforms Directory**
   - Search.
   - Filters.
   - Sort.
   - Platform cards.
   - Comparison selection.

7. **Secondary Course Discovery CTA/Section**
   - Preserve the existing course catalog but visually demote it.
   - The platform directory remains the main purpose of the page.

8. **Footer**

## 6. Platform Card Design

Each card contains:
- Official or maintained platform logo.
- Platform name.
- Short localized description.
- Primary category.
- Pricing state: free / freemium / paid / mixed / unknown.
- Certificate availability.
- Main languages.
- Official course/content count when known (`expected_count`).
- Count type label when the unit is not literally a course, e.g. `Job Simulations`.
- Verification badge based on `last_verified`.
- Buttons: Details, Compare, Official site.

### Verification badge rules

- `last_verified` within 30 days: **Recently verified**.
- `last_verified` older than 30 days: **Verification outdated**.
- null: **Not yet verified**.

The UI must never invent an exact course count. If `expected_count` is null, display `—` or `Not officially confirmed`.

## 7. Search, Filters, and Sorting

### Search fields

Search across:
- platform name,
- localized description,
- category,
- supported languages.

### Filters

- Category.
- Pricing model.
- Has free content.
- Certificates available.
- Language.
- Verification state.

### Sorting

- Recommended / featured first.
- Name A–Z.
- Official content count, only known counts first.
- Recently verified.

No fabricated platform rating is introduced in this iteration.

## 8. Platform Comparison

Visitors can select up to three platforms.

Comparison fields:
- platform name and logo,
- category,
- pricing model,
- free content availability,
- certificate availability,
- languages,
- official content count and unit,
- verification date,
- best-for summary,
- official website link.

Selection is stored in `localStorage`; no account is required.

The comparison modal/dock follows the current course-comparison interaction pattern but uses a separate storage key such as `dunya.platform.compare`.

## 9. Platform Detail Page

`platform.html` changes from a course-list wrapper into a full platform profile.

### Hero
- Logo.
- Name.
- Localized description.
- Category.
- Pricing model.
- Languages.
- Certificate status.
- Official content count.
- Verification badge/date.
- Official website and official catalog buttons.

### Profile sections

1. **Overview**
   - What the platform is.
   - Primary learning model.

2. **Best for**
   - Short editorial use cases.

3. **Strengths**
   - Structured list.

4. **Limitations**
   - Structured list.

5. **Platform facts**
   - Pricing.
   - Certificates.
   - Languages.
   - Count and count type.
   - Last verified.

6. **Verified courses on this platform**
   - Existing Supabase-backed course grid remains at the bottom.
   - This section is explicitly secondary to the platform profile.

## 10. Supabase Data Model

Use the existing `platforms` table as the primary source instead of creating a second public table. This keeps identity, ingestion metadata, verification metadata, and UI metadata on one record and avoids an unnecessary join for a 40-platform directory.

### Existing fields reused

- `external_id` — stable bridge to legacy `plat-N` IDs.
- `name`.
- `logo_url`.
- `official_url`.
- `catalog_url`.
- `status`.
- `expected_count` — official content count when verified.
- `expected_count_type` — `courses`, `job_simulations`, `modules`, etc.
- `last_verified`.

### Fields to add

- `description_ar text`
- `description_en text`
- `description_tr text`
- `category text`
- `pricing_model text` constrained to `free`, `freemium`, `paid`, `mixed`, `unknown`
- `has_free_content boolean`
- `certificate_available boolean`
- `languages text[]`
- `best_for_ar text[]`
- `best_for_en text[]`
- `best_for_tr text[]`
- `strengths_ar text[]`
- `strengths_en text[]`
- `strengths_tr text[]`
- `limitations_ar text[]`
- `limitations_en text[]`
- `limitations_tr text[]`
- `featured boolean not null default false`
- `display_order integer`

The original `description` remains for compatibility during migration and fallback.

### Data integrity

- Platform editorial fields may be null while records are being enriched.
- Missing data is displayed as unknown rather than inferred.
- `expected_count` is only updated after a source-backed verification.
- `expected_count_type` must match what the platform actually counts; non-course units must not be labeled as courses.

## 11. Supabase Access and Security

The public site uses only the publishable browser key.

Requirements:
- RLS remains enabled on `public.platforms`.
- `anon` receives SELECT access only to platform rows that are safe for public display, normally `status = 'active'`.
- No secret/service-role key is placed in frontend files.
- Existing table Data API grants are verified explicitly.
- Any future new public table must receive explicit Data API grants because Supabase's 2026 Data API defaults no longer guarantee automatic exposure.

No client-side write policy is needed for platform data in this iteration.

## 12. Frontend Architecture

### `js/supabase-runtime.js`

Add platform-focused methods with one responsibility each:
- `loadActivePlatforms(config)`
- `loadPlatform(config, externalId)`

They map Supabase rows into a stable frontend platform shape.

### New `js/platform-directory.js`

Owns platform-directory state and behavior:
- query,
- filters,
- sorting,
- comparison selection,
- platform rendering,
- statistics,
- category groups.

Keeping this separate prevents further growth of the already course-heavy `js/app.js`.

### `js/app.js`

Retains the course catalog behavior and shared page behaviors.
Platform rendering logic currently inside `app.js` is removed or delegated to `PlatformDirectory`.

### `js/platform-detail.js`

Loads the platform profile from Supabase first.
Uses the matching local `PLATFORMS_DATA` entry only as fallback.
Continues loading verified course rows from Supabase for the bottom course section.

### `js/platforms.js`

Becomes fallback/legacy compatibility data only. It is not the authoritative source while Supabase is reachable.

## 13. Data Flow

### Homepage

1. Load translation/theme shell.
2. Request active platforms from Supabase.
3. If successful, render directory, stats, categories, and featured platforms from Supabase data.
4. If the request fails, map `PLATFORMS_DATA` into the same shape and show a subtle fallback-state indicator.
5. Course catalog loading continues independently so a course-data failure does not break platform discovery.

### Platform page

1. Parse `external_id` from query string.
2. Load one active platform record from Supabase.
3. Fall back to `PLATFORMS_DATA` if unavailable.
4. Render platform profile immediately.
5. Load verified courses separately.
6. If course loading fails, keep the profile usable and show a course-section error/fallback state.

Platform discovery and course discovery must fail independently.

## 14. Error Handling

- Supabase platform read failure: use local fallback and keep the page functional.
- Missing platform record: show a proper not-found state rather than silently defaulting to FutureLearn.
- Missing logo: use `icon.svg`.
- Missing count: display unknown, never zero unless zero is explicitly verified.
- Missing editorial profile fields: hide that individual block rather than rendering empty headings.
- Broken official URL: the record remains visible but the button is hidden/disabled until corrected.
- Course API failure on a platform detail page must not remove the profile content.

## 15. Internationalization

Arabic, English, and Turkish remain supported.

- UI labels remain in `i18n.js`.
- Platform descriptions, best-for, strengths, and limitations are selected from localized Supabase columns.
- When a requested translation is absent, fall back to English, then the legacy `description`.
- Category and enum labels are translated in the UI; stored database values remain stable machine values.

## 16. Responsive and Accessibility Requirements

- Directory cards: 3 columns desktop, 2 tablet, 1 mobile.
- Filter controls collapse into a mobile filter panel below tablet width.
- All controls are keyboard accessible.
- Comparison controls have visible selected states and accessible labels.
- Images use useful `alt` text when meaningful; decorative icons use empty alt.
- Verification state is expressed in text, not color alone.
- Focus styles remain visible.

## 17. Performance

The platform directory must not load all course rows merely to render platform cards.

- Initial platform request contains only platform/profile fields.
- Forty platform rows are small enough for one request.
- Course data loads independently and lazily according to existing behavior.
- Logos use lazy loading outside the initial viewport.
- Search/filtering happens client-side after the 40-row platform payload is loaded.

## 18. Testing Strategy

### Unit tests

- Supabase row-to-platform mapping.
- Localized field fallback.
- Search and filtering.
- Sorting known vs unknown counts.
- Verification-state calculation.
- Comparison maximum of three.
- Missing count is never rendered as `0`.

### Regression tests

- Existing course catalog still initializes.
- Existing theme and language switching still works.
- Platform detail course section still loads verified Supabase courses.
- JSON fallback still works when platform Data API fetch fails.

### Integration checks

- Anonymous Data API request returns active platforms only.
- Inactive platform is not visible to `anon`.
- No service-role/secret key exists in frontend code.
- `platform.html?id=plat-1` renders the correct Supabase platform instead of defaulting to another platform.

### Deployment verification

- GitHub Actions passes.
- GitHub Pages deployment completes.
- Test desktop and mobile directory rendering.
- Test Arabic RTL plus English/Turkish LTR.

## 19. Rollout Order

1. Extend and populate platform metadata in Supabase.
2. Add platform runtime mapping and tests.
3. Build the isolated platform directory module.
4. Redesign platform section and hero on `index.html`.
5. Add filters and comparison.
6. Redesign `platform.html` and `platform-detail.js`.
7. Demote, but preserve, the existing course-first sections.
8. Run full regression and Data API/RLS checks.
9. Deploy through GitHub Pages.

## 20. Success Criteria

The redesign is complete when:
- The homepage clearly presents itself as a learning-platform directory before a course catalog.
- The number and list of platforms come from active Supabase records rather than a hard-coded 110 count.
- Users can search and filter the 40-platform scope without loading all courses.
- Users can compare up to three platforms.
- Platform detail pages provide useful platform-level information before course listings.
- Official counts are displayed only when verified and with the correct unit.
- Platform discovery keeps working if course data fails.
- Supabase remains the authoritative source while local platform data acts only as fallback.
