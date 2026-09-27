## Where I left off
Sessions 5, 6 done, plus coverage check and threshold calibration.
KEY FINDING: NEARLY_DONE must be 0.3, not 0.7. Labelled all 45
good-progress games by hand: 79% correct below 0.25, 47% at 0.29-0.49,
8% above 0.53. Completion happens well under ratio 1.0 because IGDB
`normally` includes side content.
Also: multiplayer-only games (Among Us, Rocket League) get campaign
estimates and land in the wrong bucket — need IGDB game_modes.

## Next action
Session 6b (small): add game_modes to IgdbGame + seed script.
Then session 7: Steam sign-in. ~4h.