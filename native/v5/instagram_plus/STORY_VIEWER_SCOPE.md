# V5 Instagram Plus Story Viewer Analytics — focused reverse-engineering scope

**Revision:** 2026-10-08  
**Scope agreed with user:** (P0) timestamps shown for Story viewers; (P0) total Story rewatch count; (P1) limits of identifying individual rewatchers.  
**Research branch:** `research/v5-instagram-plus-story-viewers` based on `research/v5-instagram-plus-deep-dive`.  
**Protected V4 stable candidate:** `d86edfa5a70ed1f9055ad05effd71693ca4efabe/native/v4/build/caption-canary.conf`. Do not overwrite V4 or V1/V3 profiles; no merges.

## 1. What is established from primary and corroborating sources?

| ID | Source | Exactly what it supports | Confidence and limitations |
|---|---|---|---|
| **M1** | Official Meta Instagram Plus launch (2026-06-04): https://about.fb.com/ltam/news/2026/06/presentamos-instagram-plus/ | Instagram Plus includes **Story Rewatch Insights**, a way to see *how many times* Stories were rewatched, and **Viewer List Search** for a specific viewer of your own Story | High for announced feature names; does not disclose rewatch data API, count semantics, individual identities, or viewer timestamps |
| **M2** | Meta spokesperson in Fox Business (2026-09-27): https://www.foxbusiness.com/media/meta-pushes-back-claims-instagram-plus-exposes-repeat-story-viewers | Meta says the replay feature shows **aggregate replay total** and **does not identify** which accounts replayed | Strong company-attributed statement; not proof a named user can never be guessed indirectly by manual experimental timing, and not a private backend schema |
| **M3** | Official Meta One expansion (2026-09-15): https://about.fb.com/news/2026/09/introducing-meta-one-subscription-service-more-features-ai/ | Instagram Plus added **notifications when selected people view your Story** | High. Viewer notification is distinct from per-viewer history timestamp and from individual rewatch detection |
| **U1** | User's 2026-10-08 in-app Instagram Plus offer screenshot | Instagram Plus offer includes **“See When Your Story Was Viewed”**, **“Count Story Rewatches”**, **“Preview Stories”**, shown on their device | Strong only for the **offer text**; not proof an account is subscribed or a timestamp field was returned by server |
| **C1** | First-hand user report on Reddit, 2026-08-04: https://www.reddit.com/r/Instagram/comments/1vfph0i/the_story_timestamp_on_instagram_gives_away_who/ | One subscriber reports a relative time next to viewer changing after a repeat view and aggregate count changing | Anecdotal, unverified device/version, no controlled two-account test; could be refresh, delayed sync or other activity |
| **C2** | Separate user report on Reddit, 2026-09-08: https://www.reddit.com/r/Instagram/comments/1watm9i/im_wondering_if_anyone_has_actually_tested/ | A Plus user reports relative viewer timestamps and time-ordered list | Anecdotal; reports may be inconsistent with normal viewer sort/ranking or app cohorts |
| **C3** | Independent non-Plus observation reported on community sites, 2026-09: https://gazestory.com/blog/instagram-story-viewer-order/ | In ordinary Instagram, sorting may be engagement-based, not chronological; rewatch did **not** necessarily move names to top | Non-authoritative, not same cohort as Plus; sufficient warning **not to infer a rewatch from rank movement** |
| **A1** | Meta MobileConfig architecture: https://engineering.fb.com/2024/06/11/core-infra/mobileconfig-meta-mixed-reality-mr/ | Instagram uses remotely configured rollout and A/B testing | Does not prove a Plus analytics payload or premium authorization can be changed by a config flag |

**No real Instagram iOS Story analytics API response, endpoint, GraphQL operation, StoreKit entitlement callback, subscriber binary symbol, or per-viewer replay record has been found for this user's app version.**

### Important semantic uncertainty: what exactly is counted?

One official announcement says roughly *“how many times your stories were rewatched”* (aggregate times). A Reddit report mentions *“how many unique profiles have rewatched”*. These are **not equivalent metrics**:

- **Total replay events:** one viewer replaying three times can contribute 3.
- **Unique rewatching viewers:** one viewer replaying three times contributes 1.
- **Story plays / impressions:** may count original plays and replays differently.

The Meta spokesperson's aggregate reply refers to a total count but does not publish the precise internal event semantics. **Do not convert these concepts or infer viewer identity from a single counter without controlled iOS evidence.**

## 2. P0: per-viewer timestamp hypothesis

**Research question:** Does the user's Instagram Plus iOS actually show relative time since first view, last view, most recent app sync, or another event?

Plausible and mutually distinct hypotheses:

- **T1 First view:** time next to name remains anchored to first appearance, even after a replay.
- **T2 Most recent view:** time next to name moves to time of latest replay (on same test account).
- **T3 Cache/refresh timestamp:** some UI label changes after app refresh unrelated to replay.
- **T4 Delayed ingestion or cohort variant:** UI can show stale/changed time as the app polls; country/build/experiment matters.
- **T5 Localized relative time:** the literal label changes from *“5 min”* to *“6 min”* through passage of time; this is **not** an updated stored event.
- **T6 No per-viewer timestamps:** offer advertises capability but inactive on account or not available in current build.

**NEVER use only movement in viewer-list order** to claim a replay. Ranking/sorting is not established as a reliable timestamp or replay signal.

### Controlled experiment T-1 (only accounts you own or with explicit participant consent)

Use one Story created by the researcher; participants **A/B** are both consenting test accounts. No private third-party profiles. If the researcher **already has legitimate Instagram Plus access**, measure the timestamps normally in the native app. Otherwise mark fields `not_tested` and **do not buy/activate a trial merely for this study without deciding costs**.

1. Post a harmless synthetic Story, recording a relative session start `t=0` locally.
2. A views once; save the **relative** viewer-time label and reported replay count. A display may read e.g. "2 min ago" — record a comparable event-offset only when semantics are clear; otherwise use null.
3. B views once. Record count, list order, relative time for A/B if accessible.
4. A intentionally replays once. Compare the Story replay total and A/B display after the normal sync interval; do not assume immediate update.
5. **Control:** trigger only refresh/force quit without a replay from either participant and watch whether labels change.
6. Repeat the experiment on a new harmless Story or with the test actor switched, if the trial permits. Record Instagram build/iOS version outside machine-readable study. Never collect usernames, follower lists, real Story contents, sessions or authentication.

**Pass criteria for T2 observational evidence:** A's timestamp appears to reset near controlled second play while B's does not; relevant aggregate increments; pure refresh causes no similar reset; repeat test confirms. This supports a *correlation on consenting accounts*, not a general claim Meta exposes named repeat-viewers in Plus or that Shadowrocket can synthesize the same service data.

**Failure criteria:** no Plus timestamp accessible; aggregate only; app's relative label cannot be reconciled; control refresh produces same apparent reset; real-viewer data would be needed.

## 3. P0: aggregate Story Rewatch Insights

Test whether a counter exists, when it increments, whether app owner's own replays count, and whether it measures total events or distinct rewatching people. For example on a controlled Story:

| Trial | A plays | B plays | Expected under replay EVENTS | Expected under UNIQUE rewatchers |
|---|---:|---:|---:|---:|
| Baseline | 1 | 1 | 0 | 0 |
| A second play | 2 | 1 | 1 | 1 |
| A third play | 3 | 1 | 2 | 1 |
| B second play | 3 | 2 | 3 | 2 |

These are **hypothetical mathematical outputs**, not documented Instagram values. If the observed metric differs, consider delayed sync, deduplicated session/window, story completion thresholds, or that the published metric is defined another way. Do not force-fit a theory to four observations.

Capture only relative stage numbers/counts; do not transmit actual Story IDs or accounts.

## 4. P1: can aggregates identify individual rewatchers?

**Not in general.** Given two anonymous consenting viewers A and B and an observed aggregate of two replay *events*, at least three equally compatible allocations exist:

- A replays twice, B zero.
- A replays once, B once.
- A zero, B twice.

Without **independent individualized measurements or controlled action knowledge**, the aggregate total alone cannot distinguish these cases.

Mathematically, if `r` replay events may be distributed among `n` possible viewers, the number of nonnegative assignments is `C(r+n-1,n-1)` (stars and bars). This is a mathematical illustration, not a statement about Instagram backend event rules. If the counter is distinct rewatchers `u`, possible sets equal `C(n,u)`, under the assumption the viewer list represents all eligible actors. If active Story Preview and other visibility rules apply, even the candidate set may be incomplete.

**Timestamp caveat:** If a timestamp resets during a controlled replay, the experimenter knows which *consenting* test participant triggered it. That does **not** mean the platform publicly supplies an individual replay record, nor that one can generalize the inference to arbitrary people. A production module must not claim it identifies private viewers via timing speculation.

**Design invariant:** never expose a leaderboard or “person X rewatched” based only on an aggregate count, sorting changes, or relative timestamp fluctuations. Label results `not_identifiable_from_current_evidence` / `correlation_only_not_identity`.

## 5. Where Shadowrocket genuinely enters the scope

Only **after** the user has established the legitimacy of inspecting their own traffic and a concrete interface, the engineering workflow can study:

1. **Availability:** whether the normal Story viewer screen receives a metadata flag that affects whether timestamp/rewatch UI is shown.
2. **Data:** whether iOS receives aggregate counts and per-viewer event-time fields for this consenting own Story, versus not receiving any such fields.
3. **Authorization:** whether a server denies the feature to a non-Plus account, or whether a local presentation layer alone hides already-authorized information.
4. **Persistence:** whether the real returned data still appears after relaunch and normal refresh. Never claim One-shot without this.

The Meta backend, and not Shadowrocket, remains the source of actual replay counts and timestamps. **Do not fabricate real views, user identities, or payment tokens.** Without a verified endpoint, a guessed URL rewrite or generic `is_plus=true` script is not a functional implementation.

## 6. Deliverable: a pure offline anonymized study harness

**Source:** `native/v5/instagram_plus/story_study.py`  
**Example:** `native/v5/instagram_plus/EXAMPLE_STORY_STUDY.json`  
**Tests:** `native/v5/instagram_plus/tests/test_story_study.py`

Requires **Python standard library only**. It does not contact Instagram, inspect unconsented activity, manipulate HTTPS, store accounts, or read external files beyond its provided input.

It intentionally accepts:
- `A/B/C/D` only — anonymous consenting test participants; **no usernames**.
- Session offsets in minutes instead of real timestamps; maximum 7 days.
- Optional aggregate replay numbers (up to safe caps), or null if absent.
- Whether count semantics are `replay_events` / `unique_rewatchers` / `unknown`.
- Whether displayed viewer time is `first_view` / `last_view` / `unknown`; **default unknown**.
- Events `baseline` / `new_view` / `replay_by_consenter` / `refresh_only` / `relaunch` / `control_wait`.

The output compares snapshot deltas and flags changes, but **never reports an individual as a verified rewatcher**. It tracks ambiguity explicitly with `C(n+r-1,n-1)` or `C(n,u)` only if meanings have been validated.

### Local commands

```sh
python native/v5/instagram_plus/story_study.py \
  native/v5/instagram_plus/EXAMPLE_STORY_STUDY.json

python -m unittest discover -s native/v5/instagram_plus/tests -p 'test_*.py' -v
```

The fixture is **synthetic**, not captured from the user's Instagram account.

## 7. Definition of done and next source of evidence

| Milestone | Required proof | Status |
|---|---|---|
| S0: Scope & source confidence | Meta launch, Meta clarification, screenshot, competing public anecdote separated | Completed |
| S1: Safe synthetic measurement | Parser validates, rejects usernames and tokens, reports deltas and ambiguity | **CI passed** (23 Story-specific tests; 43 Instagram tests overall, 23 iOS research and 7 Node regressions) |
| S2: Timestamp mechanism | Repeated iPhone observations with A/B control vs refresh | **No device evidence** |
| S3: Counter definition | 2nd/3rd A play then B replay, compare event vs unique count | **No device evidence** |
| S4: Private endpoint attribution | Verified, authorized iOS evidence with no token/personal media in repo | **Not discovered** |
| S5: Optional Shadowrocket module | Concrete safe behavior supported by source + functional on-device proof | **Not implemented** |
| S6: V4 protection | Exact unchanged V4/V1/V3 blobs | Guarded by CI |

### What the researcher needs next from the iPhone

- Instagram iOS version/build (no account handle).
- Whether the user has **legitimate trial/active Plus**, no purchase assumptions.
- A description of Story viewer screen with timestamps and rewatch count visible or hidden. Screenshots should have usernames/avatars and Story content redacted before sharing.
- Whether they can conduct controlled A/B experiments using two owned or explicitly consenting accounts.

No account login, receipts, unredacted HAR, Story content or follower list should be shared. **V4 Stable remains the daily-driver.**
