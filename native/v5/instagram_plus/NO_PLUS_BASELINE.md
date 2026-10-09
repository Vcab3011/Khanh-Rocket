# Instagram Plus Story Viewer — NO-PLUS baseline phase

**As of:** 2026-10-09. **User account:** Instagram Plus NOT ACTIVE.  
**Branch:** `research/v5-ig-story-no-plus-baseline` from `research/v5-instagram-plus-story-viewers`.  
**User priorities:** (1) timestamp of each viewer; (2) total Story rewatch metric; (3) whether anyone can be identified as a repeat viewer.  
**Status:** Public-documentation research, synthetic test fixtures and first-party manual baseline methodology. Not an iOS binary RE result, not a real Instagram Plus backend capture, not a working premium unlock.

## 1. What changed when we learned the account is NOT subscribed?

The existing plan used Plus-specific Story timestamps/replay count as if they might be observable during current device tests. Without Plus, these values may be **unavailable altogether**. Continuing to demand screenshots of Plus-only counters would be unproductive and could tempt unsupported fabricated data. The research scope is now split:

- **Phase N0 (possible now, no paid account):** verify the normal Story viewer interface, capture self-owned counters without third-party personal details, characterize refresh/relaunch effects, evaluate whether aggregate math ever identifies rewatchers (it does not).
- **Phase N1 (possible now for eligible professional accounts only):** separately research official Meta Professional Story insights `views` and `reach` via the already-supported UI/API. Never call a personal account “Professional” or encourage changing account type solely to unlock a research metric. The Professional API is not the private Instagram Plus iOS client API.
- **Phase N2 (requires controlled, legitimate Plus access from an authorized consenting tester later):** test what `“See When Your Story Was Viewed”` means (first vs latest view) and precisely how Story Rewatch Insights increments. Without an actual Plus counter, the numeric semantics are UNKNOWN.
- **Phase N3 (requires evidence of a specific, authorized app interface):** distinguish server-supplied timestamp/counter fields from client UI gates. Do not create a Shadowrocket rewrite based on a guessed `is_plus` field or a generic REST/GraphQL hostname.

There is no need to purchase a subscription or activate a trial to complete N0, N1's public-source study or the current synthetic tests.

## 2. Source hierarchy and what each source does NOT prove

| Evidence ID | Source | Supported fact | Not supported |
|---|---|---|---|
| OFFICIAL-PRODUCT-1 | Meta June 4 2026 release https://about.fb.com/ltam/news/2026/06/presentamos-instagram-plus/ | Official Plus subscription includes *Story Rewatch Insights* and *Viewer List Search* | Per-viewer rewatch identities, per-viewer replay data, exact replay counter meaning or iOS API field names |
| OFFICIAL-META-API-2 | Meta's Instagram official Postman collection https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-6fa9ed1d-3310-4844-ad25-f0001ab66f11 | Meta's **Instagram Graph API** is for **Professional** business/creator accounts with an authorized app and relevant permissions; it explicitly excludes consumer/non-professional accounts | Story viewer identity list, Instagram Plus eligibility or private mobile client endpoint |
| OFFICIAL-ACCOUNT-DATA-3 | Meta Accounts Center announcement https://about.fb.com/news/2023/10/manage-your-information-across-apps/ | **Download Your Information** is accessible from Accounts Center for Instagram data | Any guarantee the export contains itemized Story viewer timestamps, replay identities, Plus-restricted counters or current Story Insights |
| OFFICIAL-DATA-LOGS-4 | Meta Engineering https://engineering.fb.com/2025/02/04/security/data-logs-the-latest-evolution-in-metas-access-tools/ | Meta added some activity/data logs to Download Your Information | Exact downloaded fields for Instagram Plus Story viewer history |
| OFFICIAL-IGPLUS-5 | User's own in-app Plus paywall screenshot from Oct 8 | Account was offered *Count Story Rewatches*, *See When Your Story Was Viewed*, one-month trial | Subscriber account status, observed timestamp values, server-side response, purchase |
| OFFICIAL-META-REWATCH-6 | Meta spokesperson (Fox Business Sep 27 2026) https://www.foxbusiness.com/media/meta-pushes-back-claims-instagram-plus-exposes-repeat-story-viewers | Rewatch insight is an aggregate; named rewatchers are not directly disclosed according to Meta | The actual behavior of relative timestamp labels in current iOS build |
| COMMUNITY-TIMESTAMP-7 | Firsthand forum post https://www.reddit.com/r/Instagram/comments/1vfph0i/the_story_timestamp_on_instagram_gives_away_who/ | A Plus user **reports** a viewer timestamp changing after another visit | Verified cause, replay attribution for arbitrary viewers, stable behavior across accounts/builds |
| THIRD-PARTY-METRIC-8 | Independent overview https://github.com/oliverames/meta-mcp-server/blob/main/docs/instagram-api/insights-metrics.md | Reference says `views` and `reach` are Professional Story aggregate metrics | Authoritative active-version field availability; per-viewer lists; Plus replay count. Check against current Meta docs before using an API. |

**Key distinction:** Meta Professional Insights/Graph API is a separate authorized interface. It cannot be treated as the internal Instagram iOS Story viewer-list service. The existence of a `reach` metric does not expose a mapping from a view to an account.

## 3. Metrics that MUST stay separate

| Signal | What it might measure | Evidence that it exists | What it cannot establish |
|---|---|---|---|
| Native Story viewer list count | Number of entries currently rendered in an owner's Story viewer list | Ordinary Instagram native interface; record only number manually | Cannot be automatically identified as Graph API `reach`, may lag, may omit previews, may have visibility rules |
| Professional Insights `reach` | Unique accounts reached under Meta's professional metric semantics | Meta Professional analytics documentation | Cannot enumerate them; may be estimated/rounded and period-dependent |
| Professional Insights `views` | Count of content plays/displays under active API semantics | Meta Professional analytics reference; confirm app/version/account | Not automatically Instagram Plus “rewatches,” and cannot identify any viewer |
| Instagram Plus Rewatch Insights | Plus-specific count of repeat activity | Official June launch, no subscribed device data | Still need to determine whether event count vs distinct rewatching accounts |
| Plus “when watched” label | Relative or absolute time shown next to viewer in user's Plus offer | Screenshot shows *offer*, other user reports describe label | Whether represents first view, last view or a refresh; none of these has been measured on user's device |

**Arithmetic example (SYNTHETIC):** If a legitimate Professional Story reports `views=12` and `reach=9` for the same Story and comparable measurement window, `12−9=3` is an **arithmetic excess** only. It is *not* a proven Instagram Plus `rewatch_count=3`. Counts may differ because of metric semantics, reporting delays, definition changes, Story previewing, or other rules. Even if exactly 3 replays were independently proven, aggregates cannot identify any particular repeat viewer.

**If `views < reach`**, or if the metrics cover different periods, do not infer “negative replays”; flag inconsistency or insufficient comparability.

## 4. Tests possible with no Instagram Plus and without a proxy

1. **Native normal Story test:** owner publishes a harmless test Story. Two owned or consenting test viewers `A/B` watch once each. Note *only* numeric viewer-list count and whether the list can be displayed in-app. Confirm app/iOS version without usernames. No claim about Plus timestamps.
2. **Control refresh:** owner force-quits/reopens Instagram and looks at the same Story; record if viewer-list count changes with no new test views. Counts may update asynchronously.
3. **Controlled repeat:** A views the Story again and the owner records ordinary viewer-list count; unchanged list count does **not** prove replay wasn't recorded. No person-level claim from rank or position.
4. **Own Professional account (optional):** If already using creator/business, record native Insights `views`/`reach` if available on the same Story and time window. Never request API access to accounts you do not own or manage. Separate these aggregates from the native Story viewer list.
5. **Download Your Information (optional):** Meta's Accounts Center supports exporting Instagram data. Because the export can contain DMs, history, other user interactions and identifiers, **do not upload the zip, HTML, JSON, cookies or file index to public GitHub or the chat**. The official announcement does not establish that viewer-by-viewer Story timestamps or Plus counters are present. If not in export, absence is not proof the service does not store them.
6. **No replay “identity” experiment with unconsenting bystanders**: any attempt to correlate individual visitor order or Story replays must use owned or consenting test participants only. Don't build visitor-tracking scripts or derive private user profiles.

## 5. New offline source: nonplus_baseline.py

`native/v5/instagram_plus/nonplus_baseline.py` accepts **sanitized, manually recorded numerical observations**, with no HTTP/network capture:

- `schema="khanh.igplus.nonplus-observation.v1"`;
- `accountType` ∈ `personal/creator/business/unknown`;
- `measurementSource` ∈ `native_story_viewer/professional_story_insights/unknown`;
- `metricComparability` ∈ `unknown/same_story_same_window/not_comparable`;
- `steps` length 2–30, each contains sequential `stage`, event enum, and **optional** `views/reach/viewerListCount` numbers, null when unavailable;
- `metricComparability=same_story_same_window` is the *user's declared precondition*, not verified by the tool. If uncertain, use `unknown`.
- It never accepts or prints names, viewer IDs, Story IDs, usernames, tokens, timestamps, raw URLs, HTTP response bodies, payment information or screenshots.

**Safety invariant:** Never silently transform native `viewerListCount` into Professional `reach`. Never label `views-reach` as Plus rewatch count. Never infer named viewer identity. No implicit trial or authorized credential access is built in.

```bash
# Synthetic personal-account baseline (no Plus):
python native/v5/instagram_plus/nonplus_baseline.py \
  native/v5/instagram_plus/fixtures/nonplus_native_synthetic.json

# Synthetic preexisting Professional account observations:
python native/v5/instagram_plus/nonplus_baseline.py \
  native/v5/instagram_plus/fixtures/nonplus_professional_synthetic.json

# Run the full Instagram Plus and non-Plus study regressions:
python -m unittest discover -s native/v5/instagram_plus/tests -p 'test_*.py' -v
```

All fixture counts are invented **for unit testing**. They do not represent the user's Instagram metrics or Meta service responses.

## 6. Decisions and gates for actual Shadowrocket development

| Gate | Required before promoting claim | Current result |
|---|---|---|
| N0 normal owner-story UI | In-app screenshot/state (sensitive names blurred) and app version | USER TEST PENDING |
| N1 Professional metric availability | Existing authorized Professional account, same Story/window | OPTIONAL / UNKNOWN |
| N2 Plus feature difference | Consented comparison against legitimate Plus device or official feature description | NO PLUS ACCOUNT; NOT VERIFIED |
| N3 Per-viewer timestamp | Evidence of field existing and its refresh semantics | NOT OBSERVED |
| N4 Rewatch metric semantics | Controlled event vs unique viewer count experiment | NOT OBSERVED |
| N5 iOS request/response attribution | Authorized narrow schema evidence; avoid credential interception | NOT OBSERVED |
| N6 Shadowrocket script | Strict narrow method/path, non-sensitive payload, security review and device validation | NOT STARTED |
| N7 Stable V4 | Exact protected V1/V3/V4 Git blob checks | ENFORCED BY CI |

**Stop conditions:** no fabricated “one-shot,” `is_plus:true` payloads, subscription receipt forgery, private person tracking, request replay, or broad MITM across Instagram DM/login/story routes. Never treat passing offline code tests as proof of an actual Instagram Plus capability.

## 7. Next concrete device input (no paid subscription)

Ask for **Instagram iOS version/build**, and a simple observation from the owner's *normal* Story screen: does the viewer list show only names and aggregate views? Does any per-viewer time appear? You do not need to purchase Plus. If sharing a screenshot, blur all handles, faces, avatars, locations and private media. For Professional account only, optionally transcribe `views` and `reach` manually for the same controlled Story and time window.

**Deliverable in this branch:** a documented non-Plus research gate, a bounded count-only analyzer, synthetic fixtures and CI. No protected config files modified and no new Plus-enabled Shadowrocket module implied.
