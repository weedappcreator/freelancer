# FREELANCE GROWTH + REVENUE OS --- GitHub Skills Registry

**Research date:** 2026-09-29\
**Purpose:** Curated GitHub Agent Skills registry for the Claude Code
project defined by `CLAUDE.md`, `OPERATOR_CONTEXT.md`,
`TECHNICAL_IMPLEMENTATION_BLUEPRINT_AND_GITHUB_SKILLS.md`, and
`GROWTH_REVENUE_OS_MARKETING_BLUEPRINT.md`.

> This is intentionally a **curated production registry**, not a dump of
> every repository containing the word "skill." The goal is to cover the
> entire system with the smallest high-quality set of skills, avoid
> overlapping instructions, and identify the project-specific skills
> that still need to be built.

------------------------------------------------------------------------

# 1. Executive Decision

The strongest existing GitHub skill collection for the marketing/revenue
side of this project is:

**Corey Haines --- Marketing Skills**\
https://github.com/coreyhaines31/marketingskills

It is currently a large Agent Skills library specifically designed for
Claude Code and compatible agents. It covers marketing context, customer
research, competitor profiling, prospecting, cold email, RevOps, sales
enablement, content strategy, social, video, image generation, SEO, CRO,
analytics, attribution, A/B testing, ads, lead magnets, pricing, offers,
referrals, marketing loops and more.

For engineering discipline, use:

**Superpowers**\
https://github.com/obra/superpowers

For canonical Agent Skills examples/specification:

**Anthropic Skills**\
https://github.com/anthropics/skills

For durable jobs:

**Trigger.dev Skills**\
https://github.com/triggerdotdev/skills

For Vercel/React production engineering:

**Vercel Agent Skills**\
https://github.com/vercel-labs/agent-skills

For current Next.js workflow skills:

**Next.js Skills**\
https://github.com/vercel/next.js/tree/canary/skills

For interactive browser work:

**Browser Use**\
https://github.com/browser-use/browser-use

For social publishing:

**Postiz Agent Skill**\
https://github.com/gitroomhq/postiz-agent

For broad authenticated SaaS integrations when direct adapters are not
desirable:

**Composio Connect Skill**\
https://github.com/composio-community/connect-skills

------------------------------------------------------------------------

# 2. Installation Strategy

Do **not** copy hundreds of unrelated skills into the project.

Use three layers:

``` text
LAYER 1 — GLOBAL ENGINEERING SKILLS
Superpowers + selected Vercel/Next.js skills

LAYER 2 — PROJECT MARKETING / REVENUE SKILLS
Selected Marketing Skills + Postiz + Browser Use + Trigger.dev

LAYER 3 — CUSTOM BUSINESS SKILLS
Skills specific to this Revenue OS that do not exist publicly
```

Preferred Claude Code location:

``` text
.claude/skills/
```

Cross-agent/shared location when required:

``` text
.agents/skills/
```

Keep project-specific skills inside the repository so behavior is
versioned with the application.

------------------------------------------------------------------------

# 3. Foundation / Context Skills

## `product-marketing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0 --- REQUIRED

Use as the common marketing-context foundation.

Relevant to:

-   positioning
-   ICP
-   audience
-   product/service context
-   avoiding repeated foundational questions

For this project, it must be adapted to read `OPERATOR_CONTEXT.md` and
the Revenue OS offer configuration instead of creating a disconnected
second source of truth.

**Decision:** Install, then adapt its context lookup.

------------------------------------------------------------------------

## `customer-research`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   voice-of-customer research
-   audience pain
-   objections
-   jobs-to-be-done
-   language mining
-   synthesis of interviews/reviews/comments

Feeds:

``` text
Audience Intelligence
Content Strategy
Offer Matching
Copywriting
Cold Outreach
Sales Enablement
```

------------------------------------------------------------------------

## `marketing-plan`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Useful for producing integrated campaign plans instead of isolated
tactics.

------------------------------------------------------------------------

## `marketing-council`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful for structured multi-perspective strategy review.

Do not use it as a substitute for measured data.

------------------------------------------------------------------------

## `marketing-ideas`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Large idea library for growth exploration.

Use after ICP/offer context exists.

------------------------------------------------------------------------

## `marketing-psychology`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Useful for:

-   framing
-   persuasion principles
-   behavioral design
-   landing pages
-   offers
-   content hooks

Must not override evidence or create deceptive claims.

------------------------------------------------------------------------

# 4. Market / Competitor / Audience Intelligence

## `competitor-profiling`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Direct fit for the competitor-intelligence subsystem.

Use for:

-   competitor discovery/research
-   positioning
-   offers
-   website analysis
-   market mapping

Extend with our own social-content outlier analysis.

------------------------------------------------------------------------

## `competitors`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Focused on competitor comparison/alternative content.

Useful for:

-   SEO comparison pages
-   sales collateral
-   positioning

Different from `competitor-profiling`.

------------------------------------------------------------------------

## `prospecting`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Direct fit for:

``` text
Lead Discovery
ICP-fit account search
Prospect list creation
Account qualification
Early customer discovery
```

This should feed the canonical Revenue OS lead schema, not create
standalone spreadsheets as the primary store.

------------------------------------------------------------------------

## `directory-submissions`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful for distributing AI/automation products, tools, lead magnets or
future SaaS projects into relevant directories.

------------------------------------------------------------------------

# 5. Offers, Positioning and Monetization

## `offers`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Critical for turning broad skills into specific commercial offers.

Use with:

``` text
prospect research
pain evidence
ICP
operator proof
pricing
```

------------------------------------------------------------------------

## `pricing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Use for:

-   packaging
-   value metric
-   pricing model
-   tier decisions
-   monetization

Do not let the skill autonomously change live client pricing.

------------------------------------------------------------------------

## Alternative `pricing-strategy`

**Repository:** `TerminalSkills/skills`\
https://github.com/TerminalSkills/skills

**Priority:** P3 / reference only

Do not install both pricing skills initially. Prefer the Marketing
Skills version to reduce overlap.

------------------------------------------------------------------------

# 6. Lead Generation / Sales / RevOps

## `revops`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Critical.

Use for:

-   lead lifecycle
-   scoring
-   routing
-   pipeline
-   marketing-to-sales handoff
-   CRM process design

Adapt to HubSpot being the commercial CRM source of truth.

------------------------------------------------------------------------

## `sales-enablement`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   one-pagers
-   pitch materials
-   objection handling
-   demo scripts
-   sales collateral
-   meeting support

------------------------------------------------------------------------

## `cold-email`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Direct fit for:

-   first-touch B2B email
-   personalization
-   follow-up sequences
-   cold outbound

Our system must still enforce:

``` text
evidence before outreach
suppression
approval policy
deduplication
reply stop conditions
```

------------------------------------------------------------------------

## `emails`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Use for:

-   nurture
-   lifecycle
-   automated flows
-   re-engagement
-   post-lead sequences

Cold email and lifecycle email remain separate concepts.

------------------------------------------------------------------------

## `lead-magnets`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Strong fit for inbound funnels.

Examples for this project:

-   AI Operations Audit
-   AI Automation Opportunity Calculator
-   Lead Follow-Up Audit
-   AI Readiness Assessment
-   Website Conversion Audit
-   Workflow Cost Calculator

------------------------------------------------------------------------

## `free-tools`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Excellent fit with the operator's engineering capability.

Potential acquisition assets:

``` text
AI workflow grader
automation ROI estimator
website AI-readiness scanner
lead-response grader
marketing automation audit
```

------------------------------------------------------------------------

## `referrals`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Add once paid clients exist.

------------------------------------------------------------------------

## `co-marketing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Potential partner acquisition channel.

------------------------------------------------------------------------

## `events`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P3

Useful later for webinars/workshops/online events.

------------------------------------------------------------------------

## `public-relations`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P3

Useful later for earned media and authority.

------------------------------------------------------------------------

## `influencer-marketing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful if the Growth OS expands into creator partnerships.

------------------------------------------------------------------------

# 7. Content Strategy

## `content-strategy`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Core skill for the marketing engine.

Use for:

-   content pillars
-   topic selection
-   funnel mapping
-   editorial planning
-   content gaps
-   calendar strategy

Must consume Revenue OS intelligence rather than operate from generic
brainstorming alone.

------------------------------------------------------------------------

## Alternative `content-strategy`

**Repository:** `rampstackco/claude-skills`\
https://github.com/rampstackco/claude-skills

**Decision:** Reference only initially.

The Corey Haines version integrates better with the rest of the selected
marketing skill graph.

------------------------------------------------------------------------

# 8. Social Media

## `social`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   Instagram
-   TikTok
-   LinkedIn
-   X
-   content scheduling strategy
-   platform-native adaptation
-   social content creation

Our custom intelligence layer still needs to handle:

``` text
competitor account baselines
relative outliers
hook extraction
story structure
retention proxies
cross-account pattern mining
```

------------------------------------------------------------------------

# 9. Video / Creative AI

## `video`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use as a strategy/generation reference for the planned Video AI
Pipeline.

Revenue OS should send a structured video brief to the actual pipeline.

------------------------------------------------------------------------

## `image`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   social graphics
-   blog visuals
-   ad images
-   creative generation
-   image optimization

Our Design AI Pipeline remains a separate adapter.

------------------------------------------------------------------------

## `ad-creative`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Useful for systematic paid-ad creative variants.

------------------------------------------------------------------------

# 10. Copywriting

## `copywriting`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   homepage
-   landing pages
-   service pages
-   offer pages
-   CTA
-   portfolio copy

------------------------------------------------------------------------

## `copy-editing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Use as a quality/refinement stage.

------------------------------------------------------------------------

# 11. SEO / Search Acquisition

## `seo-audit`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for technical/on-page SEO auditing.

------------------------------------------------------------------------

## `ai-seo`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Particularly relevant in 2026.

Use for:

-   AEO
-   GEO
-   LLM visibility
-   AI search citation optimization

------------------------------------------------------------------------

## `programmatic-seo`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Useful if Revenue OS creates scalable pages such as:

``` text
AI automation for [industry]
AI workflow audit for [industry]
[tool] automation consultant
AI agent implementation for [use case]
```

Only use where pages provide unique value.

------------------------------------------------------------------------

## `site-architecture`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Use for:

-   portfolio/service site hierarchy
-   topical clusters
-   navigation
-   internal linking

------------------------------------------------------------------------

## `schema`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Use for structured data.

------------------------------------------------------------------------

## `aso`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P3

Not needed for the initial freelance system unless a mobile app becomes
an acquisition product.

------------------------------------------------------------------------

# 12. CRO / Funnel Optimization

## `cro`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for:

-   landing pages
-   service pages
-   forms
-   conversion diagnosis

------------------------------------------------------------------------

## `signup`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful for SaaS/free-tool acquisition flows.

------------------------------------------------------------------------

## `onboarding`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Relevant to future products and lead magnets requiring accounts.

------------------------------------------------------------------------

## `popups`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful for lead capture.

------------------------------------------------------------------------

## `paywalls`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P3

Only relevant if the operator launches paid SaaS/products.

------------------------------------------------------------------------

# 13. Measurement / Attribution / Experiments

## `analytics`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Critical.

Use for:

-   event tracking
-   UTM strategy
-   GA4/GTM concepts
-   conversion tracking
-   measurement plans

------------------------------------------------------------------------

## `attribution`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Direct fit for:

``` text
content → lead
outbound → reply
touchpoints → opportunity
campaign → revenue
```

Do not claim perfect causal attribution.

------------------------------------------------------------------------

## `ab-testing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

Use for experiment design.

Must integrate with the Revenue OS experiment entity and guardrail
metrics.

------------------------------------------------------------------------

# 14. Paid Acquisition

## `ads`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Supports:

-   Google Ads
-   Meta
-   LinkedIn
-   paid media
-   retargeting
-   campaign optimization

Add only after conversion tracking is reliable.

------------------------------------------------------------------------

## `ad-creative`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P1

Pairs with `ads` and the Design/Video pipelines.

------------------------------------------------------------------------

# 15. Growth Loops / Autonomous Marketing

## `marketing-loops`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P0

This is unusually relevant to the project.

Use it to design recurring agent-operated loops such as:

``` text
competitor scan
→ opportunity detection
→ content brief
→ production
→ publish
→ measure
→ learn
```

and:

``` text
market scan
→ prospect discovery
→ research
→ outreach
→ replies
→ CRM
→ learning
```

Our deterministic workflow engine still controls execution.

------------------------------------------------------------------------

# 16. Retention

## `churn-prevention`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P3 initially

Useful later if the business moves toward
retainers/subscriptions/products.

------------------------------------------------------------------------

# 17. Launch / Distribution

## `launch`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Useful for launching:

-   new services
-   lead magnets
-   free tools
-   AI products
-   case studies

------------------------------------------------------------------------

## `community-marketing`

**Repository:** `coreyhaines31/marketingskills`\
**Priority:** P2

Potential authority/community acquisition channel.

------------------------------------------------------------------------

# 18. Social Publishing --- Postiz

## `postiz`

**Repository:** `gitroomhq/postiz-agent`\
https://github.com/gitroomhq/postiz-agent

**Priority:** P0

The current Postiz skill covers scheduling/publishing to a broad set of
channels and points to the Postiz public API/CLI ecosystem.

Use as the distribution adapter skill.

Revenue OS owns:

``` text
strategy
content opportunity
campaign
approval
experiment
attribution
```

Postiz owns:

``` text
channel connection
asset upload
schedule
publish
publishing state
available analytics
```

Do not let Postiz become the canonical strategy store.

------------------------------------------------------------------------

# 19. Browser / Web Interaction

## `browser-use`

**Repository:** `browser-use/browser-use`\
https://github.com/browser-use/browser-use

**Priority:** P0

Use only when:

-   JavaScript rendering is necessary
-   clicks/forms/navigation are required
-   an authorized logged-in session is required
-   normal HTTP/search is insufficient
-   browser QA is required

The skill itself explicitly recommends plain fetch/HTTP for simple
public information.

------------------------------------------------------------------------

## `qa`

**Repository:** `browser-use/browser-use`\
**Priority:** P2

Useful for browser QA of:

-   landing pages
-   funnels
-   forms
-   Vercel dashboard
-   portfolio

Do not use its subjective numeric score as a business KPI.

------------------------------------------------------------------------

# 20. Durable Jobs / Scheduling

## Trigger.dev skill set

**Repository:** `triggerdotdev/skills`\
https://github.com/triggerdotdev/skills

**Priority:** P0

At minimum evaluate/install:

### `trigger-setup`

Bootstrap Trigger.dev.

### `trigger-tasks`

Build durable background tasks.

### `trigger-realtime`

Expose job progress/status to the Vercel UI.

Also inspect the repository's current list before installation because
it is maintained as a mirror of Trigger.dev's current SDK skills.

Use for:

``` text
competitor scans
lead discovery batches
enrichment
scheduled follow-ups
analytics synchronization
content generation jobs
publishing workflows
CRM sync
weekly reports
```

------------------------------------------------------------------------

# 21. Engineering Discipline --- Superpowers

**Repository:** `obra/superpowers`\
https://github.com/obra/superpowers

**Priority:** P0

Install/use these skills:

## `brainstorming`

Before material feature design.

## `writing-plans`

Before multi-step implementation.

## `test-driven-development`

Before feature/bug implementation.

## `systematic-debugging`

When something fails.

## `executing-plans`

For inline plan execution.

## `subagent-driven-development`

For plans with independent tasks.

## `dispatching-parallel-agents`

For independent parallelizable tasks.

## `requesting-code-review`

Before considering major work complete.

## `receiving-code-review`

For rigorously processing review feedback.

## `verification-before-completion`

Mandatory before success claims.

## `using-git-worktrees`

For isolated feature work.

## `finishing-a-development-branch`

For integration/merge decisions.

## `writing-skills`

For creating and testing our custom `SKILL.md` files.

This repository should govern **engineering behavior**, not marketing
strategy.

------------------------------------------------------------------------

# 22. Official Anthropic Skills

**Repository:** `anthropics/skills`\
https://github.com/anthropics/skills

**Priority:** P0 as reference / selective install

Important:

## `doc-coauthoring`

Useful for:

-   proposals
-   technical specs
-   structured client documents
-   strategy documents

## Skill template/spec examples

Use Anthropic's repository as the canonical reference for skill
structure.

Do not copy every example skill into the runtime.

------------------------------------------------------------------------

# 23. Vercel Engineering Skills

## Vercel Agent Skills

**Repository:** `vercel-labs/agent-skills`\
https://github.com/vercel-labs/agent-skills

**Priority:** P1

Useful skills include:

### `react-best-practices`

Use when building the Vercel control center.

### `vercel-optimize`

Use after deployment to audit:

-   cost
-   performance
-   caching
-   reliability
-   function usage

Install only what the project needs.

------------------------------------------------------------------------

# 24. Current Next.js Skills

**Repository:** `vercel/next.js`\
https://github.com/vercel/next.js/tree/canary/skills

**Priority:** P1

Important note:

The older `vercel-labs/next-skills` repository now states that Next.js
Agent Skills moved into the main Next.js repository so they stay
version-matched.

Relevant current workflow skills include the cache-component
adoption/optimization workflows.

For modern Next.js, prefer the framework's version-matched
documentation/agent rules instead of stale generic Next.js skills.

------------------------------------------------------------------------

# 25. Broad SaaS Integration Skill

## `composio`

**Repository:** `composio-community/connect-skills`\
https://github.com/composio-community/connect-skills

**Priority:** P2 / conditional

Use if Revenue OS needs to rapidly authenticate/action many external
SaaS systems.

Potential uses:

``` text
Gmail
Google Calendar
HubSpot-like SaaS integrations
other business tools
```

Architecture rule:

For core revenue-critical integrations, direct adapters are preferred
when they provide stronger control, typing, observability and failure
handling.

Use Composio when integration breadth provides a meaningful advantage.

------------------------------------------------------------------------

# 26. Secondary Marketing Skill Collections

These repositories contain useful skills but overlap substantially with
the selected primary Marketing Skills library.

Do **not** install all of them simultaneously.

## `anthropics/knowledge-work-plugins`

https://github.com/anthropics/knowledge-work-plugins

Notable marketing skill:

-   `email-sequence`

Use as a reference where it is stronger than the selected `emails`
skill.

------------------------------------------------------------------------

## `borghei/Claude-Skills`

https://github.com/borghei/Claude-Skills

Notable skills found:

-   paid-ads
-   content-strategy
-   email-sequence
-   other marketing capabilities

Useful as a reference library.

Avoid installing overlapping versions without a deliberate comparison.

------------------------------------------------------------------------

## `tebakkasus/skills`

https://github.com/tebakkasus/skills

Contains a marketing division described as dozens of skills across
content, SEO, CRO, channels, growth, intelligence and sales.

Potentially valuable for gap analysis.

Do not combine its full marketing router with the full Corey Haines
marketing library initially; that creates overlapping triggers and
contradictory workflows.

------------------------------------------------------------------------

# 27. Skills That Still Need to Be Custom-Built

Existing public skills cover a large percentage of generic marketing,
but **they do not fully implement this project's intelligence
architecture**.

These custom skills remain necessary.

## P0 Custom Skills

### `revenue-os-orchestrator`

Coordinates Growth + Revenue workflows and knows the canonical state
machine.

Must never directly bypass policy gates.

------------------------------------------------------------------------

### `social-competitor-outlier-analysis`

Required because generic competitor skills do not fully implement our
desired model:

``` text
account baseline
relative outliers
hook decomposition
first-frame analysis
narrative structure
editing structure
CTA
observable engagement
retention proxies
cross-account clustering
```

Must distinguish:

``` text
FACT
INFERENCE
HYPOTHESIS
```

------------------------------------------------------------------------

### `content-pattern-mining`

Turns many observed posts/videos into reusable feature clusters and
hypotheses.

------------------------------------------------------------------------

### `market-signal-to-content`

Converts:

``` text
market signal
audience question
competitor gap
sales objection
search demand
```

into a ranked `ContentOpportunity`.

------------------------------------------------------------------------

### `market-signal-to-prospect`

Converts market/business signals into target-account discovery criteria.

------------------------------------------------------------------------

### `growth-knowledge-graph`

Maintains relationships:

``` text
signal
→ opportunity
→ asset
→ campaign
→ post
→ lead
→ opportunity
→ revenue
```

------------------------------------------------------------------------

### `video-pipeline-router`

Produces the exact structured payload for the operator's future AI Video
Pipeline.

It does not render the video itself.

------------------------------------------------------------------------

### `design-pipeline-router`

Produces the exact structured payload for the Design AI Pipeline.

------------------------------------------------------------------------

### `content-quality-gate`

Validates:

``` text
facts
brand
claims
funnel fit
CTA
creative quality
platform format
tracking metadata
```

before publishing.

------------------------------------------------------------------------

### `postiz-revenue-os`

A thin project-specific wrapper around the generic Postiz skill.

Adds:

``` text
campaign IDs
content asset IDs
experiment IDs
approval state
attribution metadata
canonical database synchronization
```

------------------------------------------------------------------------

### `hubspot-revenue-os`

Project-specific HubSpot workflow.

Handles:

``` text
identity resolution
upsert
dedupe
lifecycle
deal mapping
next action
suppression
attribution
sync reconciliation
```

------------------------------------------------------------------------

### `revenue-attribution`

Connects:

``` text
content
outbound
website
lead
meeting
proposal
deal
revenue
```

with honest multi-touch reporting.

Generic marketing attribution skills can inform it, but this skill must
understand our schema.

------------------------------------------------------------------------

### `growth-experiment-analysis`

Analyzes our experiment entity and connects marketing metrics to
downstream revenue.

------------------------------------------------------------------------

# 28. P1 Custom Skills

## `audience-question-mining`

Mine and cluster:

-   comments
-   public questions
-   search questions
-   sales replies
-   discovery-call objections

------------------------------------------------------------------------

## `hook-library-builder`

Build an evidence-backed internal hook library from observed content and
first-party performance.

------------------------------------------------------------------------

## `content-repurposing-router`

Tracks lineage while routing one idea into:

``` text
video
carousel
static
blog
email
outbound proof
```

------------------------------------------------------------------------

## `weekly-growth-review`

Produces the weekly executive report:

``` text
revenue
pipeline
inbound
outbound
content
competitors
SEO
experiments
failures
next actions
```

------------------------------------------------------------------------

## `daily-revenue-operator`

Determines the highest-value actions for the day based on:

``` text
replies
follow-ups
pipeline
content approvals
publishing
failed jobs
new qualified leads
```

------------------------------------------------------------------------

# 29. Recommended P0 Installation Set

Start here.

``` bash
# Marketing / Revenue
npx skills add coreyhaines31/marketingskills \
  --skill product-marketing \
  customer-research \
  competitor-profiling \
  prospecting \
  offers \
  revops \
  sales-enablement \
  cold-email \
  lead-magnets \
  content-strategy \
  social \
  video \
  image \
  copywriting \
  seo-audit \
  ai-seo \
  cro \
  analytics \
  attribution \
  ab-testing \
  marketing-loops \
  -a claude-code

# Durable workflows
npx skills add triggerdotdev/skills -a claude-code

# Browser
# Follow the current Browser Use repository installation instructions.
```

Before executing this blindly, Claude Code must run the repository's
current `--list` command and verify skill names have not changed.

------------------------------------------------------------------------

# 30. P1 Expansion Set

After the foundation works:

``` text
copy-editing
emails
free-tools
programmatic-seo
site-architecture
schema
ads
ad-creative
pricing
co-marketing
referrals
launch
marketing-psychology
```

------------------------------------------------------------------------

# 31. P2 / Conditional Set

Install only when the business actually uses the capability:

``` text
influencer-marketing
community-marketing
events
public-relations
directory-submissions
signup
onboarding
popups
paywalls
churn-prevention
aso
```

------------------------------------------------------------------------

# 32. Skill Conflict Rules

Never install multiple skills with the same purpose merely because they
exist.

Conflict policy:

``` text
1. Official/vendor-maintained skill
2. Strong actively maintained specialist skill
3. Project-specific skill
4. Secondary/reference skill
```

But project-specific skills may wrap generic skills when business
schema/policy requires it.

Examples:

``` text
generic Postiz
        ↓
postiz-revenue-os wrapper

generic attribution
        ↓
revenue-attribution

generic competitor profiling
        ↓
social-competitor-outlier-analysis
```

------------------------------------------------------------------------

# 33. Skill Quality Gate

Before installing any additional GitHub skill, Claude Code must inspect:

``` text
repository
skill path
license
last maintenance
author/vendor
frontmatter
trigger description
scope
external commands
network behavior
credential requirements
scripts
dependencies
overlap
security concerns
expected benefit
```

Classify:

``` text
ADOPT
ADAPT
REFERENCE
REJECT
```

Do not execute unknown skill scripts before reviewing them.

------------------------------------------------------------------------

# 34. Security Rules for Third-Party Skills

A `SKILL.md` is executable behavioral instruction.

Treat it as code.

Before adoption:

1.  Read the entire `SKILL.md`.
2.  Inspect referenced scripts.
3.  Inspect shell commands.
4.  Inspect package-install commands.
5.  Inspect environment-variable requirements.
6.  Inspect network endpoints.
7.  Check for destructive commands.
8.  Check for secret exfiltration risks.
9.  Check for instructions that override project governance.
10. Pin or vendor the reviewed version where reliability matters.

No third-party skill may override:

``` text
CLAUDE.md
approval policy
security boundaries
suppression rules
canonical data model
operator context
external-action gates
```

------------------------------------------------------------------------

# 35. Proposed Final Skill Tree

``` text
.claude/skills/
│
├── engineering/
│   └── superpowers/*
│
├── marketing/
│   ├── product-marketing
│   ├── customer-research
│   ├── competitor-profiling
│   ├── prospecting
│   ├── offers
│   ├── content-strategy
│   ├── social
│   ├── video
│   ├── image
│   ├── copywriting
│   ├── copy-editing
│   ├── seo-audit
│   ├── ai-seo
│   ├── programmatic-seo
│   ├── site-architecture
│   ├── schema
│   ├── cro
│   ├── analytics
│   ├── attribution
│   ├── ab-testing
│   ├── ads
│   ├── ad-creative
│   ├── lead-magnets
│   ├── free-tools
│   └── marketing-loops
│
├── sales/
│   ├── cold-email
│   ├── emails
│   ├── revops
│   ├── sales-enablement
│   └── pricing
│
├── runtime/
│   ├── trigger-*
│   ├── browser-use
│   ├── postiz
│   └── selected-vercel-skills
│
└── revenue-os/
    ├── revenue-os-orchestrator
    ├── social-competitor-outlier-analysis
    ├── content-pattern-mining
    ├── market-signal-to-content
    ├── market-signal-to-prospect
    ├── growth-knowledge-graph
    ├── audience-question-mining
    ├── hook-library-builder
    ├── video-pipeline-router
    ├── design-pipeline-router
    ├── content-repurposing-router
    ├── content-quality-gate
    ├── postiz-revenue-os
    ├── hubspot-revenue-os
    ├── revenue-attribution
    ├── growth-experiment-analysis
    ├── weekly-growth-review
    └── daily-revenue-operator
```

------------------------------------------------------------------------

# 36. Claude Code Installation / Audit Prompt

Give Claude Code this instruction before installing anything:

``` text
Read:
- CLAUDE.md
- OPERATOR_CONTEXT.md
- TECHNICAL_IMPLEMENTATION_BLUEPRINT_AND_GITHUB_SKILLS.md
- GROWTH_REVENUE_OS_MARKETING_BLUEPRINT.md
- GITHUB_SKILLS_REGISTRY.md

Audit the current project's installed skills before adding anything.

For each recommended third-party skill:
1. verify the current GitHub repository and skill path;
2. read the complete SKILL.md;
3. inspect referenced scripts and install commands;
4. verify license and maintenance status;
5. identify overlap with existing skills;
6. classify ADOPT / ADAPT / REFERENCE / REJECT;
7. document the decision in docs/SKILLS_AUDIT.md.

Do not install duplicate skill families.

Prefer:
- coreyhaines31/marketingskills for generic marketing/revenue workflows;
- obra/superpowers for engineering discipline;
- anthropics/skills as the canonical Agent Skills reference;
- triggerdotdev/skills for durable Trigger.dev workflows;
- current Vercel/Next.js vendor skills for the Vercel control center;
- browser-use/browser-use for browser interaction only when normal HTTP/search is insufficient;
- gitroomhq/postiz-agent for Postiz publishing.

Then create the project-specific Revenue OS skills listed in this registry.

Project-specific skills must follow the Agent Skills specification and be tested using the Superpowers writing-skills methodology.

No skill may bypass:
- human approval gates;
- suppression/opt-out state;
- canonical CRM/data models;
- secret-management rules;
- evidence requirements;
- external-action policy.

After installation, run a skill-trigger audit using representative scenarios for:
- competitor research
- content strategy
- Instagram/TikTok analysis
- video brief generation
- design brief generation
- blog/SEO
- Postiz publishing
- lead discovery
- cold email
- reply handling
- HubSpot synchronization
- proposal generation
- attribution
- experiment analysis

Report collisions, missing triggers and redundant skills before declaring the skill layer complete.
```

------------------------------------------------------------------------

# 37. Source Registry

Primary repositories researched for this registry:

-   https://github.com/coreyhaines31/marketingskills
-   https://github.com/anthropics/skills
-   https://github.com/obra/superpowers
-   https://github.com/triggerdotdev/skills
-   https://github.com/browser-use/browser-use
-   https://github.com/gitroomhq/postiz-agent
-   https://github.com/vercel-labs/agent-skills
-   https://github.com/vercel/next.js/tree/canary/skills
-   https://github.com/composio-community/connect-skills
-   https://github.com/anthropics/knowledge-work-plugins
-   https://github.com/borghei/Claude-Skills
-   https://github.com/rampstackco/claude-skills
-   https://github.com/TerminalSkills/skills
-   https://github.com/tebakkasus/skills

------------------------------------------------------------------------

# 38. Final Recommendation

Do **not** attempt to make the system intelligent by installing the
largest possible number of skills.

The production strategy is:

``` text
BEST GENERIC SKILLS
        +
PROJECT-SPECIFIC REVENUE SKILLS
        +
DETERMINISTIC WORKFLOWS
        +
REAL DATA
        +
EVALUATIONS
        +
ATTRIBUTION
        =
USEFUL AUTONOMY
```

The highest-value immediate stack is:

``` text
Marketing Skills
+ Superpowers
+ Trigger.dev Skills
+ Browser Use
+ Postiz
+ Vercel/Next.js Skills
+ Revenue OS custom skills
```

That combination covers almost the entire planned system while keeping
the skill graph understandable and testable.
