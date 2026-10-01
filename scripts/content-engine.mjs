#!/usr/bin/env node
/**
 * Content Engine — Generate social media content for LinkedIn, Instagram, TikTok
 * Uses OpenRouter free model (nvidia/nemotron) for copy generation
 * Outputs: post text + hashtags + image prompts per platform
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env
const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq)] = t.slice(eq + 1);
}

const OPENROUTER_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const OPENROUTER_BASE = env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

if (!OPENROUTER_KEY) { console.error('Missing OPENROUTER_API_KEY'); process.exit(1); }

// Brand identity
const BRAND = {
  name: 'Weed Edouard',
  business: 'Edouard Automations',
  handles: {
    instagram_personal: '@weeddoesitalll',
    instagram_business: '@edouard.automations',
    tiktok: '@weeddoesitalll',
    linkedin: 'Weed Edouard'
  },
  niche: 'AI Automation for businesses',
  services: ['AI chatbots & assistants', 'workflow automation', 'web development', 'growth systems', 'marketing automation'],
  tone: 'confident, direct, slightly provocative, zero fluff — like a tech founder who builds, not talks',
  audience: 'small business owners, agency owners, dentists, realtors, entrepreneurs in Miami',
  differentiator: 'Actually builds AI systems that generate revenue, not just talks about AI'
};

// Content pillars
const PILLARS = [
  { id: 'proof', name: 'Social Proof & Results', weight: 3, examples: ['client results', 'before/after', 'revenue numbers', 'testimonials'] },
  { id: 'education', name: 'Educational / Value', weight: 3, examples: ['how AI saves time', 'automation tips', 'business efficiency', 'tech explained simply'] },
  { id: 'behind', name: 'Behind the Scenes', weight: 2, examples: ['building process', 'desk setup', 'coding sessions', 'client calls'] },
  { id: 'hot-take', name: 'Hot Takes / Opinions', weight: 2, examples: ['why most agencies fail', 'AI replacing jobs debate', 'hustle culture vs automation'] },
  { id: 'lifestyle', name: 'Lifestyle / Personal Brand', weight: 1, examples: ['Miami life', 'entrepreneur journey', 'day in the life'] }
];

// Platform specs
const PLATFORMS = {
  instagram: {
    maxCaption: 2200,
    hashtagLimit: 30,
    formats: ['single-image', 'carousel', 'reel-script'],
    bestTimes: ['9:00 AM', '12:00 PM', '6:00 PM']
  },
  tiktok: {
    maxCaption: 4000,
    hashtagLimit: 10,
    formats: ['short-video-script', 'stitch-hook', 'trending-audio-overlay'],
    bestTimes: ['7:00 AM', '12:00 PM', '7:00 PM']
  },
  linkedin: {
    maxPost: 3000,
    hashtagLimit: 5,
    formats: ['text-post', 'carousel-doc', 'article-snippet'],
    bestTimes: ['8:00 AM', '12:00 PM', '5:00 PM']
  }
};

// Content templates by pillar + platform
const TEMPLATES = {
  // Instagram templates
  'instagram:proof': [
    'Show a before/after of a client\'s business metric. Hook: "This dental practice went from 5 online bookings/month to 47. Here\'s the AI system I built for them."',
    'Revenue screenshot or dashboard view. Hook: "Built this system in 3 days. It\'s already generated $X for my client."',
    'Client DM screenshot (redacted). Hook: "This is what happens when you automate the boring stuff."'
  ],
  'instagram:education': [
    'Carousel: "5 Things AI Can Do For Your Business Right Now (That You\'re Paying Someone $4K/Month to Do)"',
    'Single post: Quick tip about automation. Hook: "Stop paying for X when AI does it better."',
    'Reel: 30-second explainer of one automation. Hook: "Here\'s how I automated [task] in under an hour."'
  ],
  'instagram:hot-take': [
    'Text-heavy post: "Your marketing agency is charging you $3K/month for what AI does in 5 minutes."',
    'Single post: "If your business doesn\'t have AI by 2027, you won\'t have a business."',
    'Reel: "Hot take: Most \'AI consultants\' can\'t even build a chatbot."'
  ],
  // TikTok templates
  'tiktok:proof': [
    'Screen recording showing AI system in action. Hook: "Watch this AI book 12 appointments while the dentist sleeps."',
    'Before/after split screen. Hook: "What happens when you let AI handle your leads."'
  ],
  'tiktok:education': [
    'Quick tutorial: "How to automate your entire email follow-up in 10 minutes"',
    'Explainer: "3 AI tools that replaced my $5K/month employee"',
    'Step-by-step: "I built an AI assistant for a real estate agent. Here\'s how."'
  ],
  'tiktok:hot-take': [
    '"Your business is losing money every hour you don\'t have AI answering your leads" — talking head',
    '"I replaced a 3-person team with one AI system" — storytime'
  ],
  // LinkedIn templates
  'linkedin:proof': [
    'Case study post: Detailed breakdown of a client transformation with specific numbers',
    'Results post: "In the last 30 days, my AI systems have: \\n• Sent X emails \\n• Booked X appointments \\n• Generated $X in pipeline"'
  ],
  'linkedin:education': [
    'Framework post: "The 3-Step AI Automation Framework I Use For Every Client"',
    'Listicle: "7 Processes You Should Automate Before Hiring Another Employee"',
    'How-to: "How I Built an AI Sales Assistant That Qualifies Leads 24/7"'
  ],
  'linkedin:hot-take': [
    'Opinion piece: "The AI agency model is broken. Here\'s what actually works."',
    'Contrarian: "You don\'t need an AI strategy. You need AI that makes money."'
  ]
};

// Generate content via OpenRouter
async function generateContent(prompt) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://edouardautomations.engineering'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: `You are a social media content writer for ${BRAND.name} (${BRAND.business}). Brand tone: ${BRAND.tone}. Services: ${BRAND.services.join(', ')}. Target audience: ${BRAND.audience}. Always write in first person. Never use emojis excessively — max 2-3 per post. Never sound corporate. Sound like someone who actually builds things.` },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.8
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Select weighted random pillar
function pickPillar() {
  const total = PILLARS.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PILLARS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PILLARS[0];
}

// Generate a week of content
async function generateWeekContent() {
  const DAYS = 7;
  const POSTS_PER_DAY = 3;
  const calendar = [];

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const startDate = new Date('2026-10-01');

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(` CONTENT ENGINE — Generating ${DAYS * POSTS_PER_DAY} posts`);
  console.log(` Platforms: Instagram + TikTok + LinkedIn`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  for (let day = 0; day < DAYS; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().slice(0, 10);
    const dayName = dayNames[day % 7];

    console.log(`📅 ${dayName} ${dateStr}`);

    // 3 posts: 1 Instagram, 1 TikTok, 1 LinkedIn (rotating pillars)
    const platforms = ['instagram', 'tiktok', 'linkedin'];

    for (let p = 0; p < POSTS_PER_DAY; p++) {
      const platform = platforms[p];
      const pillar = pickPillar();
      const templateKey = `${platform}:${pillar.id}`;
      const templates = TEMPLATES[templateKey] || TEMPLATES[`${platform}:education`];
      const template = templates[Math.floor(Math.random() * templates.length)];

      const prompt = `Generate a ${platform} post for ${dateStr}.

Pillar: ${pillar.name}
Template idea: ${template}

Requirements:
- Platform: ${platform}
- Max length: ${platform === 'instagram' ? '2200 chars' : platform === 'tiktok' ? '300 chars caption' : '3000 chars'}
- Include a strong hook in the first line
- Include a clear CTA at the end
- Include ${platform === 'linkedin' ? '3-5' : platform === 'tiktok' ? '5-8' : '15-25'} relevant hashtags
- If it's a video concept, include a brief script outline
- If it's a carousel, list the slides

Format your response as:
HOOK: [first line that stops the scroll]
BODY: [main content]
CTA: [call to action]
HASHTAGS: [space-separated hashtags]
IMAGE_PROMPT: [describe the ideal image/thumbnail for this post]
FORMAT: [single-image | carousel | reel | video | text-post]`;

      try {
        const content = await generateContent(prompt);
        const post = {
          id: `${dateStr}-${platform}-${p + 1}`,
          date: dateStr,
          day: dayName,
          platform,
          pillar: pillar.name,
          pillarId: pillar.id,
          templateIdea: template,
          content,
          generatedAt: new Date().toISOString(),
          status: 'draft'
        };

        calendar.push(post);
        console.log(`  ✓ ${platform.padEnd(10)} | ${pillar.name.slice(0, 25).padEnd(25)} | ${content.split('\n')[0].slice(0, 50)}...`);

        // Rate limit for free tier
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.log(`  ✗ ${platform.padEnd(10)} | ${err.message.slice(0, 50)}`);
      }
    }
    console.log('');
  }

  // Save calendar
  const calPath = path.join(ROOT, 'data', 'content', 'calendar.json');
  fs.writeFileSync(calPath, JSON.stringify(calendar, null, 2));

  // Save individual posts to platform folders
  for (const post of calendar) {
    const dir = path.join(ROOT, 'data', 'content', 'posts');
    fs.writeFileSync(path.join(dir, `${post.id}.md`), `# ${post.platform.toUpperCase()} — ${post.day} ${post.date}
**Pillar:** ${post.pillar}
**Format Idea:** ${post.templateIdea}

---

${post.content}
`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(` DONE: ${calendar.length} posts generated`);
  console.log(` Calendar: data/content/calendar.json`);
  console.log(` Posts: data/content/posts/`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return calendar;
}

generateWeekContent().catch(console.error);
