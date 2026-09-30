# GROWTH + REVENUE OS --- Autonomous Marketing, Content Intelligence & Acquisition Blueprint

**Version:** 2.0\
**Date:** 2026-09-29\
**Companion documents:** `CLAUDE.md`, `OPERATOR_CONTEXT.md`,
`TECHNICAL_IMPLEMENTATION_BLUEPRINT_AND_GITHUB_SKILLS.md`\
**Primary interface:** Claude Code / terminal\
**Optional control plane:** GitHub + Vercel\
**CRM:** HubSpot\
**Publishing/distribution:** Postiz\
**Primary outcome:** Build a measurable acquisition engine that turns
market intelligence, content, inbound demand, outbound prospecting and
sales execution into clients and attributable revenue.

------------------------------------------------------------------------

# 1. Expanded Mission

The system is no longer only a freelance outbound engine.

It is a **Growth + Revenue Operating System** responsible for the
complete acquisition loop:

``` text
MARKET INTELLIGENCE
        ↓
AUDIENCE INTELLIGENCE
        ↓
COMPETITOR / CONTENT INTELLIGENCE
        ↓
OPPORTUNITY DETECTION
        ↓
CONTENT STRATEGY
        ↓
┌──────────────┬───────────────┬───────────────┬──────────────┐
│ VIDEO        │ DESIGN        │ BLOG / SEO    │ LEAD MAGNET  │
│ PIPELINE     │ PIPELINE      │ PIPELINE      │ / WEB        │
└──────────────┴───────────────┴───────────────┴──────────────┘
        ↓
QUALITY + BRAND + CLAIM GATE
        ↓
POSTIZ / WEBSITE / DISTRIBUTION
        ↓
SOCIAL + SEARCH + WEBSITE ATTENTION
        ↓
INBOUND FUNNEL
        ↓
CRM / LEAD QUALIFICATION
        ↓
SALES
        ↓
CLIENT
        ↓
REVENUE
        ↓
ATTRIBUTION + LEARNING
        └───────────────────────────────────────┐
                                                ↓
                                         NEXT STRATEGY

PARALLEL ACQUISITION PATH:

MARKET INTELLIGENCE
        ↓
TARGET ACCOUNTS
        ↓
RESEARCH
        ↓
COLD OUTREACH
        ↓
FOLLOW-UP
        ↓
MEETING
        ↓
PROPOSAL
        ↓
CLIENT
        ↓
REVENUE
```

Content marketing and cold outreach must share intelligence.

The system must never behave like two unrelated machines.

------------------------------------------------------------------------

# 2. North-Star Objective

The system optimizes for:

``` text
attention from the correct audience
→ qualified demand
→ qualified conversations
→ opportunities
→ clients
→ attributable revenue
```

Not:

``` text
maximum posts
maximum views
maximum followers
maximum emails
maximum DMs
maximum scraped records
```

Those are intermediate signals.

------------------------------------------------------------------------

# 3. Marketing Operating Model

The system should behave like an integrated team containing:

-   Head of Growth
-   Marketing Strategist
-   Market Researcher
-   Audience Researcher
-   Competitive Intelligence Analyst
-   Social Intelligence Analyst
-   Content Strategist
-   Creative Strategist
-   Video Strategist
-   Design Strategist
-   SEO Strategist
-   Content Writer
-   Distribution Manager
-   Funnel Strategist
-   Conversion Analyst
-   CRM / Revenue Operations Analyst
-   Sales Development Agent
-   Experimentation Analyst
-   Revenue Analyst

These are logical responsibilities. Do not create a separate autonomous
process for every title unless the implementation benefits from it.

------------------------------------------------------------------------

# 4. Unified Intelligence Layer

All marketing and sales systems consume a common intelligence layer.

``` text
MarketSignal
AudienceSignal
Competitor
CompetitorAccount
CompetitorContent
ContentObservation
SearchQuery
AudienceQuestion
PainPoint
Objection
Trend
ContentPattern
CreativePattern
HookPattern
Offer
ICP
Lead
Campaign
ContentAsset
Experiment
Conversion
RevenueEvent
```

Every important observation requires provenance.

Example:

``` json
{
  "type": "content_observation",
  "platform": "instagram",
  "account_id": "...",
  "content_id": "...",
  "observed_at": "...",
  "metrics": {
    "views": null,
    "likes": null,
    "comments": null,
    "shares": null,
    "saves": null
  },
  "features": {
    "format": "reel",
    "hook": "...",
    "topic": "...",
    "duration_seconds": 31,
    "cta": "...",
    "structure": []
  },
  "source": "...",
  "confidence": 0.93
}
```

Never invent unavailable metrics.

------------------------------------------------------------------------

# 5. Market Intelligence Engine

Continuously research the markets relevant to the operator's services.

Research:

-   growing niches
-   businesses adopting AI
-   industries with repetitive workflows
-   operational bottlenecks
-   expensive administrative work
-   poor lead-response processes
-   marketing inefficiencies
-   new AI/software adoption
-   common complaints
-   business owner questions
-   hiring patterns
-   technology adoption
-   agency/service demand
-   competitor offers
-   pricing signals where legitimately available
-   emerging terminology
-   content trends
-   search demand
-   buying signals

Output:

``` text
opportunity
target ICP
problem
evidence
urgency
offer match
content opportunity
outbound opportunity
confidence
```

------------------------------------------------------------------------

# 6. Audience Intelligence Engine

Build an evolving model of the audience.

Collect and classify:

-   questions
-   fears
-   objections
-   desired outcomes
-   terminology
-   sophistication level
-   misconceptions
-   buying triggers
-   alternatives currently used
-   perceived risks
-   budget objections
-   implementation objections
-   AI objections
-   operational pain
-   marketing pain

Sources may include:

-   search results
-   public discussions
-   comments
-   competitor content
-   FAQs
-   reviews
-   sales conversations
-   email replies
-   discovery calls
-   HubSpot notes
-   website analytics
-   first-party social analytics

Convert recurring signals into:

``` text
content topics
lead magnets
sales angles
offers
FAQ pages
blog posts
video scripts
objection handling
landing-page copy
```

------------------------------------------------------------------------

# 7. Competitor Intelligence Engine

Identify relevant accounts and businesses across:

-   Instagram
-   TikTok
-   YouTube
-   LinkedIn where relevant
-   blogs
-   newsletters
-   search results
-   agencies
-   freelancers
-   AI automation companies
-   growth consultancies
-   web/AI studios

Do not simply choose accounts with the largest follower count.

Evaluate relevance using:

``` text
audience overlap
offer overlap
content overlap
market overlap
account size
posting consistency
observable engagement
growth signals
authority
format similarity
```

Maintain competitor groups:

``` text
DIRECT_COMPETITOR
ADJACENT_COMPETITOR
CONTENT_REFERENCE
CREATIVE_REFERENCE
FUNNEL_REFERENCE
OFFER_REFERENCE
```

------------------------------------------------------------------------

# 8. Competitor Account Analysis

For every tracked account, build:

``` text
account
platform
category
audience hypothesis
followers when observable
posting frequency
formats used
topic clusters
best observable content
median/typical observable performance
outliers
hooks
CTA patterns
visual identity
editing style
content length
story structures
offer strategy
landing pages
lead magnets
funnel
posting cadence
```

The system must compare a post to the **account's own baseline**, not
only absolute views.

Example:

``` text
Post A:
120,000 views

Account normal:
15,000 views

Relative performance:
8× baseline
```

That is more useful than assuming every 120K-view post is equally
exceptional.

------------------------------------------------------------------------

# 9. Content Decomposition

For each relevant high-performing piece of content, extract features.

## Opening

``` text
first frame
first sentence
first 1 second
first 3 seconds
hook type
visual interruption
question
claim
problem
curiosity gap
demonstration
```

## Narrative

``` text
problem → solution
before → after
mistake → correction
question → explanation
claim → proof
story → lesson
demonstration → CTA
list
tutorial
case study
reaction
comparison
```

## Editing / visual grammar

``` text
camera framing
cuts per interval
B-roll
captions
kinetic typography
screen recording
graphics
zoom
pattern interrupts
sound design
music
color
background
lighting
```

## Information

``` text
topic
subtopic
novelty
specificity
proof
examples
numbers
technical depth
emotion
controversy
utility
```

## CTA

``` text
comment
follow
save
share
DM
link
download
book
subscribe
none
```

------------------------------------------------------------------------

# 10. Engagement Pattern Analysis

The system should search for repeated patterns across multiple
observations.

Example hypothesis:

``` text
For AI-automation content targeting SMB owners:

problem-first hooks
+ visible workflow demonstration
+ 20–35 second duration
+ concrete time/cost framing
+ one CTA

appear more frequently among relative outliers than generic AI-news videos.
```

This remains a hypothesis until validated.

The system must distinguish:

``` text
FACT
Observed directly.

INFERENCE
Supported by repeated observations.

HYPOTHESIS
Requires testing with our content.
```

------------------------------------------------------------------------

# 11. Retention Analysis Rules

Do not claim public competitor retention data when unavailable.

For competitor content, the system may analyze **retention-oriented
structural features**, such as:

-   speed to value
-   hook strength
-   information density
-   visual changes
-   open loops
-   payoff timing
-   narrative progression
-   duration
-   pattern interrupts

Call these:

``` text
RETENTION PROXIES
```

Not:

``` text
actual audience retention
```

Actual retention should come from first-party platform analytics when
available.

------------------------------------------------------------------------

# 12. Content Opportunity Engine

Combine:

``` text
audience pain
+
search demand
+
competitor gaps
+
content outliers
+
sales objections
+
operator expertise
+
current trends
```

Generate `ContentOpportunity`.

Schema:

``` ts
interface ContentOpportunity {
  id: string;
  topic: string;
  audience: string;
  funnelStage: "AWARENESS" | "CONSIDERATION" | "DECISION";
  problem: string;
  angle: string;
  hookHypotheses: string[];
  formatRecommendations: string[];
  evidenceIds: string[];
  differentiation: string;
  offerId?: string;
  priority: number;
  confidence: number;
}
```

------------------------------------------------------------------------

# 13. Content Pillars

Initial pillars should be derived from `OPERATOR_CONTEXT.md`.

Candidate pillars:

1.  AI Automation
2.  AI Agents
3.  Business Operations with AI
4.  Growth Systems
5.  Marketing Automation
6.  Lead Generation / Follow-Up
7.  AI Websites
8.  Claude Code / AI Engineering
9.  AI Content Systems
10. Practical Business AI
11. Workflow Teardowns
12. Business Automation Case Studies

The system must refine pillars based on actual performance.

------------------------------------------------------------------------

# 14. Funnel-Aware Content

Every asset must have a purpose.

## Awareness

Goal:

``` text
reach relevant people
establish problem awareness
generate attention
```

Formats:

-   surprising insight
-   problem explanation
-   trend
-   myth
-   comparison
-   short educational video

## Consideration

Goal:

``` text
prove competence
demonstrate systems
answer objections
```

Formats:

-   tutorial
-   teardown
-   workflow demonstration
-   case study
-   before/after
-   architecture explanation
-   detailed carousel
-   blog

## Decision

Goal:

``` text
create qualified action
```

Formats:

-   audit offer
-   implementation example
-   case study
-   service breakdown
-   FAQ
-   lead magnet
-   consultation CTA
-   portfolio proof

------------------------------------------------------------------------

# 15. Full Content Pipeline

``` text
RESEARCH
  ↓
OPPORTUNITY
  ↓
BRIEF
  ↓
FORMAT ROUTER
  ├── VIDEO
  ├── DESIGN
  ├── BLOG
  ├── SOCIAL TEXT
  ├── LEAD MAGNET
  └── LANDING PAGE
  ↓
GENERATION
  ↓
FACT CHECK
  ↓
BRAND CHECK
  ↓
QUALITY CHECK
  ↓
CLAIM CHECK
  ↓
APPROVAL POLICY
  ↓
PUBLISH / SCHEDULE
  ↓
ANALYTICS
  ↓
LEARNING
```

------------------------------------------------------------------------

# 16. Video AI Pipeline

The operator will implement a dedicated AI video generation pipeline.

Revenue OS owns:

``` text
why the video should exist
who it targets
topic
hook
script
storyboard
shot requirements
creative references
CTA
funnel stage
campaign
experiment ID
```

The Video Pipeline owns:

``` text
generation
assets
shots
voice
editing
captions
music
render
export
```

Interface:

``` json
{
  "content_opportunity_id": "...",
  "platform": "instagram",
  "target_duration": 30,
  "aspect_ratio": "9:16",
  "hook": "...",
  "script": "...",
  "storyboard": [],
  "visual_direction": "...",
  "references": [],
  "cta": "...",
  "brand_profile": "...",
  "experiment_id": "..."
}
```

Return:

``` json
{
  "asset_id": "...",
  "video_url": "...",
  "thumbnail_url": "...",
  "duration": 29.4,
  "caption_file": "...",
  "generation_metadata": {}
}
```

------------------------------------------------------------------------

# 17. Design AI Pipeline

Revenue OS supplies:

``` text
objective
platform
content type
copy
hierarchy
brand system
visual references
dimensions
CTA
experiment
```

Design system generates:

-   carousel
-   infographic
-   social graphic
-   case-study visual
-   comparison graphic
-   quote/explainer
-   lead magnet graphics
-   blog graphics

Required output:

``` text
editable source where possible
export asset
metadata
copy version
brand version
campaign ID
```

------------------------------------------------------------------------

# 18. Blog / SEO Pipeline

Pipeline:

``` text
topic discovery
↓
search intent
↓
SERP research
↓
competitor coverage
↓
content gap
↓
outline
↓
evidence
↓
draft
↓
fact verification
↓
SEO optimization
↓
internal links
↓
CTA
↓
publish
↓
index/performance tracking
↓
refresh
```

Every article needs:

``` text
primary query
intent
audience
funnel stage
offer
outline
sources
unique angle
CTA
update date
```

Do not produce commodity SEO text solely to increase article count.

------------------------------------------------------------------------

# 19. Repurposing Engine

One validated idea can produce:

``` text
1 research insight
    ↓
1 long-form article
    ↓
1 long video
    ↓
3–8 short videos
    ↓
1 carousel
    ↓
3 static graphics
    ↓
social text posts
    ↓
email/newsletter angle
    ↓
outbound personalization insight
```

Do not mechanically copy identical text across platforms.

Adapt:

-   hook
-   length
-   pacing
-   CTA
-   format
-   visual language
-   platform context

------------------------------------------------------------------------

# 20. Postiz Distribution Layer

Postiz is the distribution/scheduling layer.

Revenue OS remains responsible for:

-   strategy
-   content intelligence
-   campaign IDs
-   asset selection
-   approval
-   experiment metadata
-   attribution

Postiz is responsible for:

-   connected channels
-   media upload
-   post creation
-   scheduling
-   publishing
-   available analytics
-   publishing state

Preferred integration order:

``` text
Postiz Public API / CLI / MCP
→ official connected platform channels
```

Do not make the marketing strategy dependent on Postiz internals.

Implement:

``` ts
interface PublishingProvider {
  listChannels(): Promise<Channel[]>;
  uploadAsset(asset: Asset): Promise<RemoteAsset>;
  createDraft(post: PublishRequest): Promise<PublishedPost>;
  schedule(post: ScheduleRequest): Promise<PublishedPost>;
  publish(post: PublishRequest): Promise<PublishedPost>;
  getPostAnalytics(id: string): Promise<PostAnalytics>;
}
```

Postiz currently exposes agent/automation surfaces including CLI, MCP,
public API, uploads, posts and analytics. Treat those as adapters, not
business logic.

------------------------------------------------------------------------

# 21. Content Calendar Engine

Calendar decisions should be strategy-driven.

Each slot stores:

``` text
date/time
platform
content pillar
funnel stage
format
topic
hook
CTA
campaign
experiment
asset status
approval status
publishing status
```

Calendar must prevent:

-   accidental duplicate topics
-   excessive repetition
-   identical platform copy
-   publishing unfinished assets
-   conflicting campaigns

------------------------------------------------------------------------

# 22. Performance Analytics

Collect first-party metrics when available.

Possible metrics:

``` text
impressions
reach
views
watch time
average watch duration
retention
likes
comments
shares
saves
profile visits
follows
link clicks
DMs
leads
meetings
opportunities
revenue
```

Not all platforms expose all metrics.

Store `null` rather than inventing missing data.

------------------------------------------------------------------------

# 23. Normalized Content Metrics

Raw views are insufficient.

Calculate where data supports it:

``` text
engagement_rate
share_rate
save_rate
comment_rate
follow_conversion
profile_visit_rate
click_rate
lead_conversion
meeting_conversion
revenue_per_content_asset
```

Also calculate:

``` text
relative_performance =
asset_metric / account_baseline_metric
```

Baseline should use robust statistics such as median when practical.

------------------------------------------------------------------------

# 24. Content Learning Engine

After sufficient observations, answer:

``` text
Which topics attract our ICP?
Which hooks outperform?
Which formats create saves?
Which formats create shares?
Which videos generate profile visits?
Which content creates leads?
Which content creates meetings?
Which content contributes to revenue?
Which CTAs work?
Which durations work?
Which content pillars underperform?
```

Do not optimize only for engagement.

A 20K-view post that creates 5 qualified leads may be more valuable than
a 500K-view entertainment post producing zero pipeline.

------------------------------------------------------------------------

# 25. Funnel Engine

Marketing assets must connect to conversion paths.

Possible funnels:

## Content → Audit

``` text
social content
→ profile
→ landing page
→ free/paid audit
→ qualification
→ meeting
→ proposal
```

## Content → Lead Magnet

``` text
content
→ lead magnet
→ email capture
→ nurture
→ consultation
```

## Blog → Service

``` text
search
→ blog
→ case study
→ service page
→ consultation
```

## Outbound → Proof

``` text
cold email
→ relevant case study/content
→ reply
→ meeting
```

Content and outbound reinforce each other.

------------------------------------------------------------------------

# 26. Outbound + Content Intelligence

Before cold outreach, research whether relevant content already exists.

Example:

``` text
Prospect pain:
slow lead response

Existing operator asset:
"How an AI qualification workflow handles inbound leads"

Outbound message can reference the relevant proof asset.
```

Conversely:

``` text
50 prospects repeatedly object:
"AI agents are unreliable"

→ create content addressing reliability, approval gates and audit logs.
```

Sales becomes a research input for marketing.

------------------------------------------------------------------------

# 27. Growth Knowledge Graph

Create relationships such as:

``` text
Audience
→ has PainPoint
→ asks Question
→ consumes Topic

Competitor
→ publishes Content
→ uses Hook
→ uses Structure
→ produces Observation

ContentOpportunity
→ supportedBy Signal
→ targets PainPoint
→ uses HookHypothesis
→ mapsTo Offer

ContentAsset
→ derivedFrom ContentOpportunity
→ belongsTo Campaign
→ assignedTo Experiment
→ publishedTo Channel

Lead
→ attributedTo ContentAsset
→ enters Funnel
→ becomes Opportunity
→ becomes Deal
→ produces Revenue
```

A graph database is not mandatory initially.

Implement relationally first unless graph queries become materially
useful.

------------------------------------------------------------------------

# 28. Growth Agent Topology

``` text
Growth Director / Supervisor
│
├── Market Intelligence Agent
├── Audience Intelligence Agent
├── Competitor Discovery Agent
├── Competitor Analysis Agent
├── Trend Intelligence Agent
├── Search Intelligence Agent
├── Content Pattern Agent
├── Content Strategist
├── Creative Strategist
├── Video Strategist
├── Design Strategist
├── SEO / Blog Strategist
├── Repurposing Agent
├── Distribution Agent
├── Performance Analyst
├── Funnel Analyst
└── Growth Experiment Agent
```

Existing Revenue agents remain:

``` text
Lead Discovery
Qualification
Account Research
Offer Matching
Outreach
Reply Intelligence
Meeting Prep
Proposal
CRM
Revenue Analytics
```

One supervisor coordinates both domains.

------------------------------------------------------------------------

# 29. Required Custom Skills

Create each as a real project `SKILL.md`.

``` text
skills/
├── market-intelligence/SKILL.md
├── audience-intelligence/SKILL.md
├── competitor-discovery/SKILL.md
├── competitor-intelligence/SKILL.md
├── trend-research/SKILL.md
├── search-intelligence/SKILL.md
├── content-pattern-analysis/SKILL.md
├── content-strategy/SKILL.md
├── video-strategy/SKILL.md
├── design-strategy/SKILL.md
├── blog-seo/SKILL.md
├── content-repurposing/SKILL.md
├── content-quality/SKILL.md
├── postiz-publishing/SKILL.md
├── performance-analysis/SKILL.md
├── funnel-strategy/SKILL.md
├── landing-page-strategy/SKILL.md
├── prospect-research/SKILL.md
├── lead-qualification/SKILL.md
├── offer-matching/SKILL.md
├── outreach-copy/SKILL.md
├── reply-triage/SKILL.md
├── meeting-prep/SKILL.md
├── proposal-generation/SKILL.md
├── revenue-analysis/SKILL.md
└── experiment-design/SKILL.md
```

------------------------------------------------------------------------

# 30. Skill Specification --- Competitor Intelligence

`skills/competitor-intelligence/SKILL.md`

Purpose:

> Analyze relevant accounts and content to discover repeatable,
> evidence-supported content and funnel patterns.

Required workflow:

``` text
1. Confirm market/ICP.
2. Discover relevant accounts.
3. Classify reference type.
4. Collect observable content.
5. Normalize metrics.
6. Calculate account baseline.
7. Identify relative outliers.
8. Decompose outlier content.
9. Compare patterns.
10. Separate facts/inferences/hypotheses.
11. Generate testable recommendations.
```

Must never:

-   invent analytics
-   call structural proxies "retention"
-   assume correlation is causation
-   blindly copy creators
-   plagiarize scripts/designs

Output:

``` json
{
  "accounts": [],
  "outliers": [],
  "patterns": [],
  "gaps": [],
  "hypotheses": [],
  "recommended_experiments": [],
  "sources": []
}
```

------------------------------------------------------------------------

# 31. Skill Specification --- Content Pattern Analysis

Purpose:

Extract reusable structural features.

Feature vector:

``` text
platform
format
topic
hook type
opening visual
opening words
duration
narrative structure
proof type
visual changes
caption density
editing pace
CTA
emotion
specificity
novelty
relative performance
```

Output clusters, not vague observations.

------------------------------------------------------------------------

# 32. Skill Specification --- Content Strategy

Inputs:

``` text
ICP
audience signals
competitor intelligence
search intelligence
sales objections
offers
operator expertise
performance history
```

Outputs:

``` text
content pillars
campaign themes
priority topics
format mix
funnel distribution
publishing cadence
content opportunities
experiments
```

Every recommendation must explain why.

------------------------------------------------------------------------

# 33. Skill Specification --- Video Strategy

Output a production-ready brief:

``` text
objective
audience
platform
funnel stage
duration
hook
opening frame
script
beats
storyboard
B-roll
visual direction
caption strategy
sound direction
CTA
references
claims requiring verification
```

This skill does not render the final video.

It sends the structured brief to the dedicated Video AI Pipeline.

------------------------------------------------------------------------

# 34. Skill Specification --- Design Strategy

Output:

``` text
asset type
dimensions
content hierarchy
headline
body copy
visual concept
layout
brand constraints
references
CTA
export requirements
```

Send to Design AI Pipeline.

------------------------------------------------------------------------

# 35. Skill Specification --- Blog SEO

Must perform:

``` text
query research
intent classification
SERP research
competitor coverage
gap analysis
outline
source collection
draft
fact verification
internal linking
CTA mapping
metadata
```

Do not keyword-stuff.

------------------------------------------------------------------------

# 36. Skill Specification --- Content Repurposing

Input one source asset.

Generate platform-native derivatives while preserving the underlying
idea.

Track lineage:

``` text
source_asset_id
parent_content_id
derivative_asset_ids
```

This allows revenue attribution back to the original research idea.

------------------------------------------------------------------------

# 37. Skill Specification --- Postiz Publishing

Responsibilities:

``` text
inspect connected channels
validate platform requirements
upload assets
create draft
schedule approved content
store Postiz IDs
synchronize publishing state
retrieve available analytics
handle errors
```

Default:

``` text
PUBLISH_POLICY=APPROVAL_REQUIRED
```

Later:

``` text
APPROVED_CALENDAR_AUTOPUBLISH
```

Never allow the strategy agent itself to bypass publishing policy.

------------------------------------------------------------------------

# 38. Skill Specification --- Performance Analysis

Compare:

``` text
asset vs own baseline
asset vs pillar baseline
asset vs format baseline
campaign vs campaign
experiment control vs variant
```

Then connect downstream:

``` text
content
→ profile/site
→ lead
→ meeting
→ opportunity
→ revenue
```

Recommend actions:

``` text
SCALE
ITERATE
REPACKAGE
RETEST
STOP
```

Only based on evidence.

------------------------------------------------------------------------

# 39. Skill Specification --- Funnel Strategy

For each offer define:

``` text
traffic source
audience
entry asset
landing experience
conversion event
qualification
nurture
sales handoff
measurement
```

Every funnel must have event tracking.

------------------------------------------------------------------------

# 40. Marketing Database Additions

Add:

``` text
competitors
competitor_accounts
competitor_content
content_observations
content_patterns
audience_signals
search_queries
trends
content_opportunities
content_briefs
content_assets
asset_variants
content_lineage
publishing_jobs
published_posts
post_metrics
content_experiments
funnel_sessions
conversion_events
attribution_touchpoints
```

------------------------------------------------------------------------

# 41. Content Asset Lifecycle

``` text
IDEA
→ RESEARCHED
→ BRIEFED
→ GENERATING
→ DRAFT
→ QA
→ APPROVAL
→ APPROVED
→ SCHEDULED
→ PUBLISHED
→ MEASURING
→ ANALYZED
→ REUSE | ARCHIVE
```

Invalid transitions must be rejected.

------------------------------------------------------------------------

# 42. Quality Gate

Before publication:

## Accuracy

-   claims supported
-   statistics sourced
-   no fabricated case studies

## Brand

-   correct positioning
-   correct voice
-   consistent visual system

## Strategy

-   clear audience
-   clear objective
-   clear funnel stage
-   appropriate CTA

## Creative

-   strong opening
-   understandable
-   platform-native
-   no obvious AI slop

## Technical

-   correct dimensions
-   media valid
-   caption valid
-   links valid
-   tracking attached

------------------------------------------------------------------------

# 43. Marketing Approval Levels

``` text
LEVEL 0
Research only.

LEVEL 1
Generate briefs/drafts.

LEVEL 2
Generate final assets but require publishing approval.

LEVEL 3
Auto-schedule content from an approved calendar/strategy.

LEVEL 4
Bounded autonomous publishing inside approved campaigns.

LEVEL 5
Reserved for future use only after reliability is demonstrated.
```

Initially use Level 2.

------------------------------------------------------------------------

# 44. Growth CLI

Add:

``` bash
freelance growth status

freelance market scan
freelance audience questions
freelance trends scan

freelance competitors discover --niche "AI automation"
freelance competitors analyze
freelance competitors outliers

freelance content opportunities
freelance content plan --week
freelance content brief <id>

freelance video brief <content-id>
freelance design brief <content-id>
freelance blog create <content-id>

freelance content repurpose <asset-id>
freelance content qa <asset-id>

freelance publish preview <asset-id>
freelance publish approve <asset-id>
freelance publish schedule <asset-id>

freelance analytics content
freelance analytics funnel
freelance analytics attribution
freelance experiments growth
```

------------------------------------------------------------------------

# 45. Vercel Growth Console

Add views:

``` text
/growth
/intelligence
/competitors
/competitors/[id]
/content
/content/opportunities
/content/calendar
/content/assets
/content/[id]
/publishing
/analytics/content
/analytics/funnel
/analytics/attribution
/experiments
```

Key dashboard:

``` text
WHAT SHOULD WE DO TODAY?
```

Display:

-   emerging opportunities
-   competitor outliers
-   content awaiting approval
-   assets ready to publish
-   underperforming campaigns
-   winning experiments
-   inbound leads
-   high-value follow-ups
-   pipeline impact
-   revenue impact

------------------------------------------------------------------------

# 46. Daily Growth Loop

``` text
1. Check system health.
2. Synchronize first-party analytics.
3. Inspect new replies/leads.
4. Update competitor observations.
5. Update trends/search/audience signals.
6. Detect new content opportunities.
7. Review current funnel performance.
8. Prioritize content.
9. Generate briefs.
10. Route briefs to video/design/blog pipelines.
11. QA returned assets.
12. Request approval.
13. Schedule through Postiz.
14. Update CRM and attribution.
15. Analyze experiments.
16. Recommend next highest-value action.
```

------------------------------------------------------------------------

# 47. Weekly Strategic Loop

Generate a weekly report containing:

``` text
Revenue
Pipeline
Qualified leads
Inbound vs outbound
Best acquisition sources
Best content
Worst content
Content outliers
Winning hooks
Winning topics
Winning formats
Competitor changes
Audience questions
SEO opportunities
Sales objections
Funnel leaks
Experiments
Recommended next-week strategy
```

------------------------------------------------------------------------

# 48. Monthly Strategy Loop

Re-evaluate:

``` text
ICP
offers
positioning
content pillars
competitor set
channel allocation
funnel
lead magnets
landing pages
outbound messaging
content production mix
```

Do not preserve a strategy simply because it was configured initially.

------------------------------------------------------------------------

# 49. Content-to-Revenue Attribution

Implement multi-touch history.

Example:

``` text
2026-10-01
Prospect watches Reel A

2026-10-03
Visits website

2026-10-04
Reads Blog B

2026-10-07
Receives outbound email

2026-10-08
Replies

2026-10-10
Meeting

2026-10-18
Deal won
```

Store all known touchpoints.

Do not falsely claim perfect causal attribution.

Report:

``` text
first touch
lead creation touch
latest touch
assisted touches
sales touch
```

------------------------------------------------------------------------

# 50. Content Experimentation

Possible variables:

``` text
hook
opening visual
duration
topic
format
CTA
caption
thumbnail
story structure
posting time
offer
landing page
```

Never change all variables and call it an A/B test.

------------------------------------------------------------------------

# 51. Cold Outreach Remains a Core Channel

Marketing does not replace outbound.

Outbound becomes smarter because it consumes:

-   competitor intelligence
-   prospect research
-   industry trends
-   audience language
-   content proof
-   case studies
-   sales objections

Outbound also produces intelligence for marketing.

This creates the closed loop:

``` text
MARKETING
↕
SALES
↕
DELIVERY
↕
REVENUE DATA
```

------------------------------------------------------------------------

# 52. GitHub / Tooling Guidance

Continue using the previously selected engineering/research stack.

Recommended roles:

``` text
Anthropic Skills
→ skill authoring standard

Superpowers
→ disciplined engineering

Playwright MCP
→ deterministic browser interaction

Firecrawl / Crawl4AI / Crawlee
→ research extraction

Browser Use
→ interactive fallback

Trigger.dev
→ durable workflows

Langfuse
→ LLM traces/evals

HubSpot
→ CRM

Postiz
→ publishing/distribution
```

Do not add another framework unless it fills a measurable gap.

------------------------------------------------------------------------

# 53. Postiz Integration Note

Current Postiz documentation/repository information indicates support
for social scheduling, analytics and automation, with public API,
CLI/MCP-oriented agent surfaces and media/post operations.

Architectural rule:

``` text
Revenue OS owns intelligence and strategy.
Postiz owns publishing execution.
Platform analytics feed Revenue OS.
```

Do not scrape through Postiz.

Use separate authorized research adapters for market/competitor
intelligence.

------------------------------------------------------------------------

# 54. Data Compliance / Platform Safety

Research only information the system is authorized to access.

Do not:

-   bypass authentication
-   bypass CAPTCHAs
-   circumvent rate limits
-   impersonate people
-   mass-spam users
-   collect unnecessary sensitive personal data
-   automate actions prohibited by the configured platform/account
    policies

Maintain source provenance and suppression controls.

------------------------------------------------------------------------

# 55. Implementation Phases

## Growth Phase G0 --- Foundation

Implement schemas:

``` text
competitors
content observations
audience signals
content opportunities
assets
publishing
metrics
attribution
```

## G1 --- Intelligence

Build:

``` text
market intelligence
competitor discovery
competitor analysis
audience research
search intelligence
trend intelligence
```

## G2 --- Strategy

Build:

``` text
pattern analysis
content opportunity scoring
content planning
calendar
experiment planning
```

## G3 --- Production Interfaces

Implement contracts for:

``` text
Video AI Pipeline
Design AI Pipeline
Blog Pipeline
```

Do not tightly couple the Growth OS to one generation provider.

## G4 --- Postiz

Implement:

``` text
channel discovery
upload
draft
schedule
publish
status sync
analytics sync
```

## G5 --- Funnel

Build:

``` text
landing-page mapping
lead magnets
conversion events
HubSpot handoff
attribution
```

## G6 --- Learning

Build:

``` text
performance normalization
content baselines
outlier detection
experiment analysis
content-to-pipeline attribution
```

## G7 --- Controlled Autonomy

Allow approved-calendar autopublishing only after reliability is
demonstrated.

------------------------------------------------------------------------

# 56. Acceptance Tests

## Competitor intelligence

Given 20 observed posts:

``` text
calculate baseline
identify outliers
extract features
produce evidence-linked patterns
never fabricate missing metrics
```

## Content strategy

Given:

``` text
ICP
10 audience questions
5 competitor patterns
3 sales objections
2 active offers
```

Produce ranked opportunities with evidence.

## Production routing

A video opportunity must produce a valid Video Pipeline payload.

A design opportunity must produce a valid Design Pipeline payload.

A blog opportunity must produce a valid SEO brief.

## Publishing

Dry-run must show:

``` text
channel
asset
caption
schedule
campaign
tracking
```

without publishing.

## Attribution

A HubSpot opportunity must be traceable to known marketing/sales
touchpoints when those touchpoints exist.

------------------------------------------------------------------------

# 57. Claude Code Execution Prompt

Use this after adding the document to the repository:

``` text
Read CLAUDE.md, OPERATOR_CONTEXT.md,
TECHNICAL_IMPLEMENTATION_BLUEPRINT_AND_GITHUB_SKILLS.md,
and GROWTH_REVENUE_OS_MARKETING_BLUEPRINT.md completely.

The project is now a unified Growth + Revenue Operating System.

Do not treat marketing and cold outreach as separate products.

Marketing intelligence, competitor research, content production,
Postiz distribution, inbound funnels, cold outreach, HubSpot sales
operations, attribution and revenue learning must share one canonical
data model and event system.

Begin by updating the architecture plan and database model to support
the Growth domain without breaking the existing Revenue domain.

Implement Growth Phase G0 before autonomous marketing actions.

Create the custom SKILL.md files defined in the blueprint with strict
input/output contracts.

Build adapters for Video AI, Design AI and Blog pipelines rather than
hardcoding a single provider.

Implement Postiz as a publishing adapter. Strategy must remain inside
Revenue OS.

Competitor research must distinguish observed facts, inferences and
hypotheses. Never fabricate private retention/watch-time metrics.

All content must carry:
- target ICP
- funnel stage
- content opportunity
- campaign
- CTA
- experiment metadata where applicable
- attribution identifiers

All external publishing begins in APPROVAL_REQUIRED mode.

Verify schemas, tests, state transitions, CLI behavior and dry-run
publishing before claiming completion.
```

------------------------------------------------------------------------

# 58. Final System

The target is:

``` text
                    ┌──────────────────┐
                    │ INTERNET / DATA  │
                    └────────┬─────────┘
                             ↓
                 ┌───────────────────────┐
                 │ INTELLIGENCE ENGINE   │
                 └──────────┬────────────┘
                            ↓
              ┌────────────────────────────┐
              │ STRATEGY / OPPORTUNITIES   │
              └─────────────┬──────────────┘
                            ↓
       ┌────────────────────┼─────────────────────┐
       ↓                    ↓                     ↓
     VIDEO                DESIGN                 BLOG
       └────────────────────┼─────────────────────┘
                            ↓
                       QUALITY GATE
                            ↓
                          POSTIZ
                            ↓
                SOCIAL / SEARCH / WEBSITE
                            ↓
                         INBOUND
                            │
                            ├──────────────────────────┐
                            ↓                          │
                         HUBSPOT                       │
                            ↑                          │
                            │                          │
MARKET → LEADS → RESEARCH → OUTBOUND → REPLIES ──────┘
                            ↓
                         MEETING
                            ↓
                         PROPOSAL
                            ↓
                          CLIENT
                            ↓
                          REVENUE
                            ↓
                 ATTRIBUTION + LEARNING
                            ↓
                     STRATEGY UPDATE
                            └────────────→ LOOP
```

The objective is not autonomous content creation.

The objective is a system that continuously discovers **what the market
cares about, what attracts the right audience, what converts that
audience, what produces qualified conversations, and what ultimately
produces clients and revenue** --- then uses that evidence to improve
the next cycle.
