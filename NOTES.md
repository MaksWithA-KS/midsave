## Where I left off
Session 4 done. Twitch app registered, client-credentials token working
(~60 day expiry). Confirmed against live IGDB:
  external_games: filter external_game_source = 1, NOT category = 1
  uid = steam appid as STRING; IGDB id is `game` here
  game_time_to_beats: filter on `game_id`; values in seconds
RDR2: hastily 48.7h / normally 89.5h / completely 208.3h, count 29.
Test script at scripts/igdb-test.ts (not committed yet).

## Next action
Session 5: seed script part 1. Paginate external_games where
external_game_source = 1, 500 per request, under 4 req/sec, upsert into
Game with match_status. ~4h — the biggest session in the milestone.