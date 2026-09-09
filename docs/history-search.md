# Tournament history search

`GET /api/history?q=state%202025&page=1` returns completed shoots, newest date
first, then descending ID. The fixed page size is 10 shoots, with all event rows
for those shoots. Response fields: `shoots`, `total`, `page`, `pages`, `pageSize`,
and normalized `query`. Count and rows share the same parameterized predicate.
Malformed, nonpositive, or unsafe integer pages become page 1. Pages beyond the
last page clamp to the last page; an empty result has page 1 of 1. Queries longer
than 200 characters return HTTP 400. Name tokens are literal SQLite NOCASE
substring matches (ASCII case folding); four-digit tokens filter the stored
calendar year exactly. All tokens must match.

The browser debounces typing by 300 ms, aborts obsolete requests and invalidates
their completions, and preserves the last successful results on failure. Query
changes replace the current URL and reset page 1; page buttons add history entries.
Other URL parameters and history state are retained. Retry reads the current URL.
Successful saves/deletions refresh both the dashboard and the current history view.

`GET /api/dashboard` runs the existing calculations from `lib/scoring.ts` on the
server across the full scoring history. Its response includes five display scores
per gauge, class summaries, starting classes, and active shoots. It never returns
completed raw history to the browser. The server currently reads all scoring rows
to reuse the exact established algorithm; this is not a database aggregation or a
new classification algorithm. Active shoots retain their existing separate view.

The existing `/api/shoots` GET and write endpoints remain available unchanged for
compatibility, including full-data consumers. The dashboard no longer calls the
full-history GET. There is no account or selected-shooter model on this branch.
Future account integration must apply identical authorized shooter scope to count,
page selection, attached event rows, dashboard inputs, and every existing read/write
endpoint. Adding a filter only in the UI is insufficient.

Migration `0004_right_charles_xavier.sql` adds only the
`shoots(status, date, id)` index for completed-history ordering. It neither deletes
nor seeds data. Leading-wildcard name queries still scan eligible names; this
index is not claimed to accelerate substring matching.

The reusable `TrackerBrand` component uses the supplied banner's wordmark and
clay design, with real-text creator credit. The image edit removed the baked
checkerboard; an SVG color filter makes its white matte transparent at rendering
time, with reserved shallow dimensions and responsive scaling. The underlying PNG
has a white matte, not an alpha channel. The existing tracker has one light theme.

Validation: run `npm test` and `npm run lint`. Tests use synthetic SQLite data and
the actual history route, including 23-shoot pagination, literal search, invalid
pages, empty/deleted pages, complete event totals, request invalidation, older gauge
inputs, and preliminary/main regressions. Browser checks cover refresh, Back,
search/clear, and opening the edit form from a searched result at phone width.
