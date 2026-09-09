# Shoot totals and notes

History's Totals column sums only rows labeled Main (case-insensitive after
trimming). HOA requires recorded main events for all four gauges: 12, 20, 28,
and .410. Until then it shows "HOA incomplete". HAA adds main doubles and is
displayed only when main doubles exist; with missing gauges it shows "HAA
incomplete". Preliminary scores remain in their individual gauge history totals
and rolling averages, but do not enter HOA/HAA shoot totals. Multiple main rows
for a gauge are summed. No fixed target count is assumed.

The optional notes field accepts at most 5,000 characters and is stored as plain
text. Both POST and PATCH `/api/shoots` accept `notes`. Omitting that field
preserves notes for older clients; an empty or whitespace-only string clears them.
Invalid types or excessive length return HTTP 400 before any shoot changes.

Migration `0005_purple_vargas.sql` adds `shoot_notes`, with a shoot-ID primary
and foreign key, content, and UTC ISO creation/update timestamps. Updates retain
creation time; unchanged notes retain both timestamps. Clearing notes removes the
row, so a later new note starts a new creation timestamp. Deleting a shoot also
deletes its notes. No existing score data is changed by this migration.

History and the legacy full-shoot response include `notes: null` or a note object
with `content`, `createdAt`, and `updatedAt`. The dashboard includes notes only
with its active shoots. Notes are not part of score calculations or name/year
search. The history notes button appears only for populated notes and opens a
plain-text dialog with an Edit notes action.

## Future advice integration

This release does not call an AI service. The separate notes table and stable
shoot IDs allow later advice to refer to observations without changing scores.
Event-specific notes can be introduced later with explicit event-score links.
Keep generated advice in a separate table with model/version, generation time,
and the exact input snapshot or revision references used; timestamps alone do not
preserve past note contents. Users should explicitly request advice before notes
and scores are sent to an AI service. Treat note text as untrusted observations,
not instructions to the advice system. Future account integration must scope notes
through the authorized shooter on every read and write, just like scores.
