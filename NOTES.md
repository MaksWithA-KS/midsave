## Where I left off
Session 5 done. Catalogue seeded: 176,241 games, 174,399 IGDB entries,
44 skipped. ~1,840 Steam apps share an IGDB game (duplicate editions).
Keyset pagination, not offset. Apicalypse queries must be ONE LINE —
newlines give a bare "Syntax Error".
skipDuplicates never updates existing rows (the RDR2 row had to be
fixed by hand).

## Next action
Session 6: walk game_time_to_beats wholesale with keyset pagination,
update IgdbGame rows by game_id. Record coverage % in here. ~2h.