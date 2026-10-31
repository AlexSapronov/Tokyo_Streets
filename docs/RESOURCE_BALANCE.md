# Road resource audit · model 6

Scope: touge duels and Time Attack. Drag/drift keep their own resource models and record groups. No changes to rewards, AI privileges or installed tire condition. Both road drivers and the tuning bench use the same simulation.

## Reproduction

`npm run balance:resources` runs 2,970 deterministic sessions: all 9 road events, all 11 cars, 5 tire choices, dry/rain, and 3 policies. `node scripts/balance-resources.js --json` exports individual results. Neutral uses balanced throughout; varied attempts attack / early apex / breathe / power / balanced / Ren apex / safe / weight in a cycle, falling back to balanced if unavailable. Preserve deliberately repeats preservation to expose resource-card regressions. Fresh hardware, Ren, default setup, neutral racing line; no execution RNG or incidents. This isolates resource arithmetic, not win rate or player skill.

## Findings and paired results

Before this patch, each corner cost a fixed 2.1 points of tire life and each straight 1.05, before multipliers. Suzuka and Fuji therefore consumed identical rubber at neutral pace despite different distances. Repetition compounded wear even for preservation: repeatedly saving tires destroyed a fresh slick in one session. R34 slicks lost over half their life per neutral Suzuka lap.

| Car / circuit / policy | Previous tire loss | Model 6 tire loss |
| --- | ---: | ---: |
| NSX / Suzuka / neutral | 43.9 pp | 12.7 pp |
| NSX / Suzuka / varied | 51.3 pp | 14.6 pp |
| R34 / Suzuka / neutral | 56.1 pp | 16.2 pp |
| R34 / Suzuka / varied | 65.6 pp | 18.7 pp |
| R34 / Suzuka / preserve repeatedly | 100 pp | 5.7 pp |
| R34 / Fuji / neutral | 56.1 pp | 11.6 pp |

Tire loss now follows kilometers: 0.45 pp/km on straights and 1.4 pp/km in corners, with a bounded radius modifier, then compound, mass, drivetrain, setup, action and line multipliers. Active-action repetition has a bounded x3 wear multiplier; resource/neutral actions have no repetition wear multiplier. Existing focus, repetition pace penalties and cooldowns remain. Slicks still wear x1.55, semi-slicks x1.25 and street tires x0.85. This is an explicit gameplay calibration, not a claimed real A005 service life: actual compound, car, setup and conditions are not represented in enough detail to predict that. All stock chassis on fresh slicks retain over 60% after two neutral Suzuka sessions; component wear is carried into subsequent starts.

## Brakes

Previously a straight supplied roughly -10 degrees per decision plus card heat, independent of distance, duration or temperature. Full attack could therefore *heat* brakes on a straight. Corner-heavy courses also forced maximum temperature during ordinary driving.

Airflow now always removes heat above the 35-degree floor. Exponential cooling uses simulated elapsed time, average speed, the car cooling coefficient and a lower airflow factor in corners. A 1,475 m Fuji straight can remove much more heat than a short straight. Positive heating applies only in corners: corner load, entry-speed reduction, action and bounded repeated-attack load, reduced by brake kits/pads. An uninterrupted straight has no brake heat source, even under full throttle. Negative action heat is a separate recovery contribution, so the cooling card no longer promises a fixed net -24 degrees. Engine heat/turbo heat multipliers no longer directly heat brake discs; oil and coolant telemetry remain separate. An attack still creates braking load in corners; on straights airflow cools the brakes under every pace card.

With fresh R34 slicks, the Suzuka neutral session ends near 127 and the varied policy near 131, versus 194 and 200 previously. Brake fade still starts at 105 and late braking is blocked above 155. These are **gameplay temperature indices**, not credible measured rotor temperatures. The existing Celsius display is retained and the in-game help explicitly says this. Actual disc temperature calibration would require changing the full thermal model and thresholds together.

Sector explanations now report start/end brake temperature and the airflow contribution, making cooling visible in the existing result UI. Physics changes move road record keys from 5 to 6; v5 records retain recorded playback and do not compete as current ghosts. Existing saves, purchases, wear and career progress are preserved; no free tire replacement is granted.

## Validation

Regression coverage checks two laps on every chassis, compound ordering, distance scaling, preservation on every road course, long/hot/fast straight cooling, attack heat, brake hardware, telemetry explanation and record isolation. The broader suite checks AI/player execution, economy, awards, wear persistence, saves, replays and unchanged drag/drift behavior. The audit is not a statistical DNF or multiplayer balance study.
