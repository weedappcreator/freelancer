/**
 * Skills Loader
 * Discovers and loads markdown skill files from all integrated repositories.
 * Makes them available to agents as injectable knowledge.
 */

import fs from "node:fs";
import path from "node:path";
import { logger } from "../core/logger.js";

export interface Skill {
  id: string;
  name: string;
  category: string;
  source: string;
  content: string;
  filePath: string;
}

interface SkillSource {
  name: string;
  category: string;
  basePath: string;
  pattern: string; // glob-like: "*.md" or "**/*.md"
}

const SKILL_SOURCES: SkillSource[] = [
  // Harvey — sales skills
  { name: "harvey", category: "sales", basePath: "harvey/skills", pattern: "*.md" },
  { name: "harvey", category: "sales-prompts", basePath: "harvey/prompts", pattern: "*.md" },

  // Marketing Skills — 50 marketing modules
  { name: "marketingskills", category: "marketing", basePath: "marketingskills/skills", pattern: "**/SKILL.md" },

  // Claude SEO — SEO agents
  { name: "claude-seo", category: "seo", basePath: "claude-seo/agents", pattern: "*.md" },

  // Superpowers — agent workflow skills
  { name: "superpowers", category: "agent-ops", basePath: "superpowers/skills", pattern: "**/SKILL.md" },
];

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private reposRoot: string;

  constructor(projectRoot: string) {
    this.reposRoot = path.join(projectRoot, ".skills", "repos");
  }

  /** Load all skills from configured sources */
  loadAll(): number {
    let count = 0;
    for (const source of SKILL_SOURCES) {
      const sourceDir = path.join(this.reposRoot, source.basePath);
      if (!fs.existsSync(sourceDir)) {
        logger.debug(`Skills source not found: ${source.basePath}`);
        continue;
      }

      const files = this.findMarkdownFiles(sourceDir, source.pattern);
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          const relativePath = path.relative(sourceDir, file);
          const skillName = relativePath.replace(/\.md$/i, "").replace(/\/SKILL$/i, "");
          const id = `${source.name}/${source.category}/${skillName}`;

          this.skills.set(id, {
            id,
            name: skillName,
            category: source.category,
            source: source.name,
            content,
            filePath: file,
          });
          count++;
        } catch (err) {
          logger.warn(`Failed to load skill: ${file}`, { error: String(err) });
        }
      }
    }

    logger.info(`Loaded ${count} skills from ${SKILL_SOURCES.length} sources`);
    return count;
  }

  /** Get a specific skill by ID */
  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /** Find skills by category */
  byCategory(category: string): Skill[] {
    return [...this.skills.values()].filter((s) => s.category === category);
  }

  /** Find skills by keyword in name or content */
  search(query: string): Skill[] {
    const q = query.toLowerCase();
    return [...this.skills.values()].filter(
      (s) => s.name.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }

  /** Get skills relevant to a specific agent task */
  forAgent(agentName: string): Skill[] {
    const categoryMap: Record<string, string[]> = {
      "market-intelligence": ["marketing", "seo"],
      "lead-discovery": ["sales", "marketing"],
      "qualification": ["sales"],
      "account-research": ["sales", "seo", "marketing"],
      "personalization": ["sales", "marketing"],
      "email": ["sales"],
      "follow-up": ["sales"],
      "reply-intelligence": ["sales"],
      "content": ["marketing", "seo"],
      "proposal": ["sales"],
      "orchestrator": ["agent-ops"],
    };

    const categories = categoryMap[agentName] ?? [];
    return categories.flatMap((cat) => this.byCategory(cat));
  }

  /** List all loaded skills */
  list(): Array<{ id: string; name: string; category: string; source: string }> {
    return [...this.skills.values()].map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      source: s.source,
    }));
  }

  /** Build a context string from selected skills for injection into agent prompts */
  buildContext(skillIds: string[], maxLength = 8000): string {
    const parts: string[] = [];
    let totalLen = 0;

    for (const id of skillIds) {
      const skill = this.skills.get(id);
      if (!skill) continue;

      const section = `\n--- Skill: ${skill.name} (${skill.category}) ---\n${skill.content}\n`;
      if (totalLen + section.length > maxLength) break;

      parts.push(section);
      totalLen += section.length;
    }

    return parts.join("");
  }

  private findMarkdownFiles(dir: string, pattern: string): string[] {
    const results: string[] = [];

    if (pattern === "*.md") {
      // Direct .md files only
      for (const entry of fs.readdirSync(dir)) {
        if (entry.endsWith(".md")) {
          results.push(path.join(dir, entry));
        }
      }
    } else if (pattern === "**/SKILL.md") {
      // Recursive: look for SKILL.md in subdirs
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const skillFile = path.join(dir, entry.name, "SKILL.md");
          if (fs.existsSync(skillFile)) {
            results.push(skillFile);
          }
          // Also check for any .md files in the skill dir
          const skillDir = path.join(dir, entry.name);
          for (const f of fs.readdirSync(skillDir)) {
            if (f.endsWith(".md") && f !== "SKILL.md") {
              results.push(path.join(skillDir, f));
            }
          }
        }
      }
    }

    return results;
  }
}
