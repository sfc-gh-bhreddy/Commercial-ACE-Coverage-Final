# Commercial ACE Coverage

Tracks Account Engineer (ACE) coverage on FY27 Cap1 deals across the Commercial
Acquisition regions (Comm East / Comm West), and recommends what to do about the
gaps — Bluebird, a specific webinar, or assigning an ACE.

Built for AEs, SEMs and DMs who need to know: **which closed-won deals have
nobody on them, and what's the right motion for each.**

---

## What it shows

| Page | Route | Answers |
|---|---|---|
| **Overview** | `/` | How much of the book is covered? Where's the gap ACV? Is it drifting by quarter? |
| **ACE Coverage** | `/uncovered` | Which specific deals have no ACE, and what should we do about each one? |
| **DM Rollup** | `/dm` | Which districts are worst covered? |
| **SEM Rollup** | `/sem` | Which SE managers' books are worst covered? |
| **AE Rollup** | `/ae` | Which AEs have uncovered deals? |
| **ACE Rollup** | `/ace` | What's each Commercial ACE's current load and bandwidth? |

Every page carries a bar at the top showing the percentage of deals with no ACE,
scoped to whatever region and quarter filters are active.

---

## The recommendation logic

This is the heart of the app. For a deal with no ACE attached:

```
cap1Acv >= $50,000                              ->  Assign an ACE
cap1Acv <  $50,000  +  Ramping or Mature        ->  nothing (already consuming)
cap1Acv <  $50,000  +  new to Snowflake         ->  Bluebird + Webinar + Assign an ACE
cap1Acv <  $50,000  +  Not Started/Started Slow ->  Bluebird + Webinar
```

**Order matters.** The ACV gate is checked first, so a $200k deal that has never
consumed still gets only "Assign an ACE" — never Bluebird.

**It recommends, it never assigns.** "Assign an ACE" is wording shown to the AE
and SE. Nothing is written back to Elementum, Salesforce, or the Bluebird
allow-list. Elementum is a read-only replica; Bluebird is a manual quality gate.

Logic lives in [`lib/recommend.ts`](lib/recommend.ts). Thresholds in
[`lib/constants.ts`](lib/constants.ts).

### Why most of the book lands on self-service

Deliberate, and grounded in two measurements:

- **556 of 585** FY27 Cap1 deals are under $100k, median ~$20k
- **25 ACEs** served **541 accounts** company-wide in the last 12 months

ACE capacity is roughly the size of the Commercial book on its own. You cannot
assign an ACE to everything, so the $50k line puts the long tail on Bluebird and
webinars by design.

---

## Consumption stage

Drives the Bluebird-vs-nothing decision. Derived from A360 consumption revenue,
which is usage expressed in dollars.

| Stage | Rule | Also flags new to Snowflake? |
|---|---|---|
| Not Started | zero lifetime revenue | Yes |
| Started Slow | has revenue, < $200 in last 30 days | No |
| Ramping | $200 – $5,000 in last 30 days | No |
| Mature | > $5,000 in last 30 days | No |

> **Known limitation.** The $200 and $5,000 thresholds are placeholders, not
> derived from the actual revenue distribution. `Not Started` and
> `isNewToSnowflake` are also currently the *same check* (zero lifetime revenue),
> so there is no independent test for genuine newness, and no anchoring to the
> deal's close date. See [Known Limitations](#known-limitations).

---

## Webinar topic matching

Each recommended webinar is matched to the account, not just "the next one on the
calendar".

| Priority | Signal | Topic | Confidence |
|---|---|---|---|
| 1 | `AI_CLASSIFY` over the SE's own notes | whatever it returns | detected |
| 2 | `USE_CASES_C` contains "AI" | 5 — AI Without the PhD | detected |
| 3 | `ETL_TOOL_C` present | 3 — Getting Data Into Snowflake | detected |
| 4 | `CURRENT_DW_TOOL_C` is not Snowflake | 3 — Getting Data Into Snowflake | detected |
| 5 | `USE_CASES_C` contains "Data Engineering" | 3 — Getting Data Into Snowflake | detected |
| 6 | `CURRENT_BI_TOOL_C` present | 4 — Raw Data to Dashboards | detected |
| 7 | `USE_CASES_C` contains "Analytics" | 4 — Raw Data to Dashboards | detected |
| 8 | nothing matched | 1 — Securing Your Account | **inferred** |

> Topics **1, 2 and 6** (Securing, Warehouse Cost, Governance) are account
> *configuration states* — Salesforce has no field that observes whether an
> account has a network policy or a resource monitor. The AI classification of SE
> notes gives real signal for them, but the picklist fallback is a default, not a
> finding. These render marked `inferred` with an asterisk.

### Live vs on demand

Session state comes from the date alone. A future session shows its date, time
and a Register link. Once it passes, the same URL becomes an on-demand recording
and the time is dropped — verified against the live pages.

This means a matched topic **always** resolves to something. `bestSessionForTopic`
takes the soonest upcoming session, falling back to the most recent recording.

Catalog: [`lib/webinars.ts`](lib/webinars.ts). Append new sessions, never delete
past ones.

---

## Architecture

One query feeds everything.

```
DEALS_SQL (lib/data.ts)                    ~25s cold, then cached
  |
  +-- 12 sources joined, one row per opportunity x fiscal quarter
  |
  v
/api/coverage  ->  CoverageProvider  ->  every page derives client-side
                                          (rollups are NOT separate queries)
```

Region and quarter filters, the rollups, and the recommendation all run against
that single in-memory array. Session resolution is client-side too, so the daily
"has this webinar passed yet" check costs nothing.

**Caching:** 10 min TTL, stale-while-revalidate, 15 min background refresh, 4 min
keepalive ping so the connection pool doesn't idle-drop.

---

## Data sources

Full column-by-column lineage with reasoning: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)

### Coverage signals — covered if ANY is present

| Signal | Source |
|---|---|
| ACE TMR filed | `SALES.SALES_ENGINEERING.FIELD_SPECIALIST_REQUESTS_DX_ELEMENTUM` |
| `#activation` tagged use case | `SALES.SE_REPORTING.DD_SOLUTION_ENGINEER_SALESFORCE_USE_CASE` |
| ACE on use case team | `SALES.SE_REPORTING.DD_SALESFORCE_USE_CASE_TEAM` |
| ACE on account team | `FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER` |

### Everything else

| Source | Provides |
|---|---|
| `SALES.RAVEN.SDA_CLOSED_OPPORTUNITY_BOOKINGS_VIEW` | the deals themselves — **row-secured to your hierarchy** |
| `SALES.RAVEN.A360_REVENUE_CONSUMPTION_VIEW` | consumption usage, stage, new-to-Snowflake |
| `SALES.RAVEN.D_SALESFORCE_ACCOUNT_CUSTOMERS` | account name, lead SE |
| `SALES.RAVEN.RAVEN_SE_ACCOUNT_ASSIGNMENTS` | SE manager resolution |
| `FIVETRAN.SALESFORCE.OPPORTUNITY` | pre-close discovery for topic matching |
| `SNOWFLAKE.ACCOUNT_USAGE.USERS` | display name |

### Project-owned objects

All in `TEMP.BHREDDY` so a future native app reads from one place.

| Object | Purpose |
|---|---|
| `ACE_TOPIC_HINTS` | `AI_CLASSIFY` output over SE notes (802 rows) |
| `V_ACE_ROSTER` | Commercial ACE roster + load, derived live from Salesforce |
| `V_ACE_ACCOUNT_MAP` | ACE -> account mapping (67 ACEs, 850 accounts) |
| `ACE_CAPACITY` | TMRs Needed, loaded from the SnowCats BoB sheet |
| `ACE_NOTIFICATION_LOG` | notification history (not yet wired) |
| `DEALS_SNAPSHOT` | flat rows for a future native app — see below |

DDL: [`sql/schema.sql`](sql/schema.sql)

---

## Running it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Requires:

- **Node 20+**
- **Snowflake CLI configured** — verify with `snow connection list`. Must point at
  the Snowhouse account, since that's where `SALES.*` lives.
- Access to the source tables. As an ACE with normal roles you already have it.

The query runs **as you**, so the row-access policy on the bookings view returns
your slice of the hierarchy. If you see **0 deals**, your session likely has no
secondary roles active:

```bash
snow sql -q "SELECT CURRENT_SECONDARY_ROLES()"
# if empty, set DEFAULT_SECONDARY_ROLES = ('ALL') on your user
```

Warehouse defaults to `SNOWADHOC`; override with `SNOWFLAKE_WAREHOUSE`.
Connection defaults to your default; override with `SNOWFLAKE_CONNECTION_NAME`.

---

## Common tasks

### Change the $50k threshold

`BLUEBIRD_MAX_ACV` in [`lib/constants.ts`](lib/constants.ts). One line.

### Add newly scheduled webinar sessions

Append to `WEBINAR_SESSIONS` in [`lib/webinars.ts`](lib/webinars.ts). Past
sessions stay — they become on-demand automatically.

### Add a new coverage signal

Documented procedure in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#adding-a-coverage-signal).
Summary: add a CTE, `LEFT JOIN` it, fold into `HAS_ANY_ACE`, extend `RawDeal` and
the `getDeals` mapping.

**Then clear `.data-cache/`** or the old snapshot keeps serving. This has bitten
this app before.

### Refresh the AI topic classification

```sql
-- see sql/refresh_topic_hints.sql
```

### Load TMRs Needed from the BoB sheet

Not automated yet — the sheet can't be reached from Snowflake. See
[Known Limitations](#known-limitations).

---

## Known limitations

Read this before trusting a number.

**1. Row-level security scopes everything to you.**
`SDA_CLOSED_OPPORTUNITY_BOOKINGS_VIEW` is filtered to your sales hierarchy.
Every count on every page reflects your slice. Someone else running this sees
different numbers. This is not a bug, but it does mean figures aren't comparable
between people.

**2. Consumption stage thresholds are unvalidated.**
$200 and $5,000 per 30 days were chosen to make the tiers function, not derived
from the real distribution. A $4,900/month account currently reads
"Ramping — no action."

**3. "New to Snowflake" is the same check as "Not Started".**
Both are zero lifetime A360 revenue. There is no independent test for genuine
newness, and no anchoring to close date — so a deal that closed last week with
zero revenue looks identical to one that closed eleven months ago. The second is
a real problem; the first is normal. Fixing this needs a prior-closed-won check
plus revenue windowed from each deal's close date.

**4. Missing consumption data reads as "never started".**
The join is a `LEFT JOIN`, so an account absent from A360 gets `NULL` which
coalesces to zero. A data gap is indistinguishable from a genuine non-starter.

**5. Topics 1, 2 and 6 are inferred, not detected.**
CRM cannot observe account configuration state. Marked `inferred` in the UI.

**6. TMRs Needed is not connected.**
It lives only in the SnowCats BoB Google Sheet, maintained per-person. Snowflake
Workspace policy blocks publish-to-web from serving unauthenticated clients, so
there is no unauthenticated path to it. Requires the Openflow Google Drive
connector or a credentialed sync job. Column currently renders `—`.

**7. The ACE roster is inferred and disagrees with the real team.**
`V_ACE_ROSTER` derives Commercial ACEs from Salesforce use-case membership plus a
>50% Commercial rule, with manual include/exclude overrides. Cross-checked against
the BoB sheet's share list, it misses several actual team members and includes
people the sheet doesn't. The sheet's tab names are the authoritative roster.

**8. Notifications are built but not enabled.**
Stored procedure and log table exist. Designed to send only to the operator with
the intended AE/SE recipient logged, so production is a `NOTIFY_MODE` flip.
Not currently scheduled.

---

## Native app readiness

Not deployed as a native app yet, but structured so it can be.

**The blocker to be aware of:** a native app service identity cannot read
`SALES.RAVEN.*`. The bookings view is row-secured to a sales hierarchy the
service identity doesn't have, so it would return **zero rows**.

`DEALS_SNAPSHOT` exists to solve this. A scheduled Task running as a real user
resolves all 12 sources and writes flat rows; the app then reads that one table.
Building the table now means the eventual switch is a config change rather than a
rewrite.

---

## Project layout

```
app/
  page.tsx              Overview
  uncovered/page.tsx    ACE Coverage — the action list
  dm/ sem/ ae/ ace/     rollups
  api/coverage/         serves DEALS_SQL results
  api/ace-roster/       serves the ACE roster
components/
  deals-table.tsx       sortable table + motion pills
  page-shell.tsx        layout + the gap bar
  sidebar.tsx           Snowsight-style nav
  coverage-provider.tsx single dataset + filters
lib/
  data.ts               DEALS_SQL — the one query
  recommend.ts          motion routing
  webinars.ts           webinar catalog
  aggregate.ts          rollup math
  constants.ts          every tunable
  ace-roster.ts         ACE bandwidth query
sql/
  schema.sql            project object DDL
  load_ace_capacity.sql TMRs Needed loader
docs/
  DATA_SOURCES.md       column-level lineage
  ARCHITECTURE.md       how it fits together
```
