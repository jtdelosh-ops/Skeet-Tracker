# Bulk import

Use Import existing records from the tracker. Imports are scoped to the signed-in shooter or James's selected support target. A preview never writes tracker records. Review editable rows, choose Main or Preliminary when the source omits it, check duplicates, and confirm the selected shoots. New records are complete shoots; no existing records are overwritten. Starting classes extracted from an image are reference-only and do not change settings.

CSV accepts one row per shoot with Shoot, Date, Shoot Name, Event Type, 12, 20, 28, 410, Doubles. Cells may contain scores such as 94/100 A. Separate gauge Broken, Targets, Class columns are also accepted. Dates must be YYYY-MM-DD or MM/DD/YYYY. Blank event cells mean no event. UTF-8 BOM, quoted commas, escaped quotes, multiline quoted cells, and CRLF are supported. A public example template contains synthetic data. Use up to 100 shoots and 500 KB per CSV. A row uses one event type; mixed preliminary/main records for the same shoot must be reviewed and completed in the tracker instead of importing duplicate shoot rows.

PNG, JPEG, and WebP images up to 8 MB use OpenAI Responses with gpt-4.1-mini-2025-04-14 and strict structured output. Images are processed only on Preview file; they are not stored in the tracker. Original images remain in the browser preview, and the API request uses store:false. The extraction instruction excludes averages, totals, and member details from shoot rows, preserves blank events, and requires uncertainty warnings rather than guessed values. Source totals are compared to extracted row totals on the review screen. All extracted data remains untrusted until reviewed. Actual provider retention is governed by the API account's policies; store:false is not a promise of zero retention.

The private test site needs OPENAI_API_KEY as a Sites secret. Existing Resend secrets are unrelated. Extraction is disabled with a clear message when the key is absent. Limits are ten extraction attempts per initiating account per rolling day and fifty across the site; output is capped at 8,000 tokens. CSV import does not call OpenAI. Pricing reference: https://developers.openai.com/api/docs/models/gpt-4.1-mini ($0.40/M input, $1.60/M output checked 2026-09-10). Expected sample costs are estimates, not measured until a real extraction is run. No automatic paid retries are performed.

Duplicate checks use account-scoped NSSA shoot numbers, stable import keys, and matching name/date. Duplicates are excluded in preview and rechecked at commit. A unique key plus a transactional guard prevents races. A client request ID and content digest make a retried successful import idempotent. A failed batch rolls back all shoots, scores, import metadata, and administrative audit entries.

Recent batches support undo. Before deleting any remaining batch records, snapshots are checked inside the transaction; edits to imported scores, notes, dates, names, or status block undo to preserve later work. Already-deleted records are not recreated. Undo is account-scoped and repeatable. James's support imports and undo record full per-shoot administrative audit entries. Ordinary shooters' imports have their own batch history.

Migration 0011 adds import batches/snapshots and nullable import references/indexes on shoots. It is schema-only; live records and the live deployment remain untouched.

Validation: the 44-test suite covers parsing the six-shoot NSSA example (28 events, totals 568/582/580/557/360), validation, preview/confirmation, duplicate checks including a race, idempotency, ownership, audit rollback, undo protection, and mocked image extraction/configuration/rate limits. Real image extraction remains to be verified after the API secret is supplied.


## Multiple screenshot imports

Users can select up to five images or one CSV, with a step-by-step NSSA guide. Images process sequentially and each consumes one existing extraction attempt. Successful rows and edits survive a failed file; retry targets only that file, or remove it to continue. Each row links to its source image. Starting classes and total comparisons stay per source. Duplicate checks cover the combined preview and saved records. More than 100 preview rows blocks confirmation until a file is removed. Images stay browser-local except during extraction and are never saved by the tracker.

The configured test-site API successfully extracted the original six-shoot, 28-score NSSA screenshot on September 10, 2026.
