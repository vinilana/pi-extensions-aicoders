/**
 * AICoders Context Feedforward Extension
 *
 * Bootstraps a dotcontext-inspired `.context/` knowledge base and injects
 * the right docs, guides, agents and skills into the system prompt before
 * each agent turn starts.
 *
 * Usage:
 *   /dotcontext init
 *   /dotcontext status
 *   /dotcontext feed <task>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type PrevcPhase = "P" | "R" | "E" | "V" | "C";
type ProjectType =
  | "cli"
  | "web-frontend"
  | "web-backend"
  | "full-stack"
  | "mobile"
  | "library"
  | "pi-extension"
  | "monorepo"
  | "desktop"
  | "unknown";

type DocDefinition = {
  key: string;
  file: string;
  title: string;
  description: string;
};

type AgentDefinition = {
  key: string;
  title: string;
  description: string;
  role: string;
};

type SkillDefinition = {
  key: string;
  title: string;
  description: string;
  phases: PrevcPhase[];
};

type PublicContract = {
  kind: string;
  name: string;
  location: string;
  detail: string;
};

type ModuleInsight = {
  path: string;
  role: string;
  files: string[];
  highlights: string[];
};

type ProjectFacts = {
  name: string;
  description: string;
  packageManager: string;
  projectType: ProjectType;
  primaryLanguage: string;
  scripts: Record<string, string>;
  dependencies: string[];
  packageKeywords: string[];
  topLevelEntries: string[];
  files: string[];
  sourceFiles: string[];
  testFiles: string[];
  documentationFiles: string[];
  configFiles: string[];
  entryPoints: string[];
  piExtensions: string[];
  piThemes: string[];
  readmeSummary: string[];
  readmeHeadings: string[];
  modules: ModuleInsight[];
  publicContracts: PublicContract[];
  securitySignals: string[];
  dataSignals: string[];
  reasoning: string[];
};

type FeedSelection = {
  phase?: PrevcPhase;
  agents: string[];
  docs: string[];
  skills: string[];
  reasons: string[];
};

type FeedFile = {
  label: "doc" | "agent" | "skill";
  relativePath: string;
  content: string;
  truncated: boolean;
};

type FeedForward = {
  initialized: boolean;
  selection: FeedSelection;
  files: FeedFile[];
  systemPromptAppendix: string;
  summary: string;
};

type WriteResult = {
  created: string[];
  overwritten: string[];
  skipped: string[];
};

const CONTEXT_DIR = ".context";
const MAX_FEEDFORWARD_CHARS = 24_000;
const MAX_FILE_CHARS = 6_000;
const MAX_SCAN_FILES = 500;

const EXCLUDED_SCAN_DIRS = new Set([
  ".git",
  ".pi",
  ".context",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

const DOCS: DocDefinition[] = [
  {
    key: "project-overview",
    file: "project-overview.md",
    title: "Project Overview",
    description: "High-level overview, purpose, stack and entry points",
  },
  {
    key: "architecture",
    file: "architecture.md",
    title: "Architecture",
    description: "System architecture, boundaries, modules and design decisions",
  },
  {
    key: "data-flow",
    file: "data-flow.md",
    title: "Data Flow",
    description: "How data, state and control move through the system",
  },
  {
    key: "api",
    file: "api.md",
    title: "API Reference",
    description: "Public interfaces, APIs, commands and integration contracts",
  },
  {
    key: "getting-started",
    file: "getting-started.md",
    title: "Getting Started",
    description: "Local setup, installation and onboarding path",
  },
  {
    key: "development-workflow",
    file: "development-workflow.md",
    title: "Development Workflow",
    description: "Branching, PREVC, contribution flow and delivery rules",
  },
  {
    key: "testing-strategy",
    file: "testing-strategy.md",
    title: "Testing Strategy",
    description: "Test commands, coverage expectations and validation approach",
  },
  {
    key: "tooling",
    file: "tooling.md",
    title: "Tooling",
    description: "Scripts, package manager, automation and productivity tools",
  },
  {
    key: "security",
    file: "security.md",
    title: "Security",
    description: "Security assumptions, secrets, permissions and threat surfaces",
  },
  {
    key: "deployment",
    file: "deployment.md",
    title: "Deployment",
    description: "Build, release, deployment and rollback process",
  },
  {
    key: "contributing",
    file: "contributing.md",
    title: "Contributing",
    description: "Code standards, review expectations and team conventions",
  },
  {
    key: "glossary",
    file: "glossary.md",
    title: "Glossary",
    description: "Domain terms, acronyms and project vocabulary",
  },
];

const AGENTS: AgentDefinition[] = [
  {
    key: "feature-developer",
    title: "Feature Developer",
    description: "Implements new features according to approved specifications",
    role: "developer",
  },
  {
    key: "bug-fixer",
    title: "Bug Fixer",
    description: "Investigates failures and applies focused fixes with regression checks",
    role: "developer",
  },
  {
    key: "code-reviewer",
    title: "Code Reviewer",
    description: "Reviews code for correctness, maintainability, safety and conventions",
    role: "reviewer",
  },
  {
    key: "test-writer",
    title: "Test Writer",
    description: "Creates and updates tests that prove behavior and prevent regressions",
    role: "qa",
  },
  {
    key: "documentation-writer",
    title: "Documentation Writer",
    description: "Keeps project docs, guides and handoff notes clear and current",
    role: "documenter",
  },
  {
    key: "refactoring-specialist",
    title: "Refactoring Specialist",
    description: "Improves structure safely without changing external behavior",
    role: "developer",
  },
  {
    key: "performance-optimizer",
    title: "Performance Optimizer",
    description: "Finds bottlenecks and validates measurable performance improvements",
    role: "qa",
  },
  {
    key: "security-auditor",
    title: "Security Auditor",
    description: "Audits secrets, auth, permissions, injection risks and safe defaults",
    role: "reviewer",
  },
  {
    key: "architect-specialist",
    title: "Architect Specialist",
    description: "Designs system structure, module boundaries and technical decisions",
    role: "architect",
  },
  {
    key: "backend-specialist",
    title: "Backend Specialist",
    description: "Works on server-side APIs, services, data access and integrations",
    role: "developer",
  },
  {
    key: "frontend-specialist",
    title: "Frontend Specialist",
    description: "Works on UI, components, state, accessibility and frontend ergonomics",
    role: "designer",
  },
  {
    key: "database-specialist",
    title: "Database Specialist",
    description: "Designs schemas, migrations, queries and persistence boundaries",
    role: "developer",
  },
  {
    key: "devops-specialist",
    title: "DevOps Specialist",
    description: "Handles CI/CD, releases, deployment, infrastructure and observability",
    role: "documenter",
  },
  {
    key: "mobile-specialist",
    title: "Mobile Specialist",
    description: "Works on native or cross-platform mobile application concerns",
    role: "developer",
  },
];

const SKILLS: SkillDefinition[] = [
  {
    key: "commit-message",
    title: "Commit Message",
    description: "Use when preparing concise conventional commit messages and release notes.",
    phases: ["E", "C"],
  },
  {
    key: "pr-review",
    title: "PR Review",
    description: "Use when reviewing a pull request, diff or merge readiness.",
    phases: ["R", "V"],
  },
  {
    key: "code-review",
    title: "Code Review",
    description: "Use when auditing code quality, correctness and maintainability.",
    phases: ["R", "V"],
  },
  {
    key: "test-generation",
    title: "Test Generation",
    description: "Use when creating tests, regression checks or validation cases.",
    phases: ["E", "V"],
  },
  {
    key: "documentation",
    title: "Documentation",
    description: "Use when creating, updating or reviewing project documentation.",
    phases: ["P", "C"],
  },
  {
    key: "refactoring",
    title: "Refactoring",
    description: "Use when restructuring code safely while preserving behavior.",
    phases: ["E"],
  },
  {
    key: "bug-investigation",
    title: "Bug Investigation",
    description: "Use when diagnosing errors, regressions or unexpected behavior.",
    phases: ["E", "V"],
  },
  {
    key: "feature-breakdown",
    title: "Feature Breakdown",
    description: "Use when decomposing feature requests into implementation phases.",
    phases: ["P"],
  },
  {
    key: "api-design",
    title: "API Design",
    description: "Use when designing APIs, tool schemas, commands or integration contracts.",
    phases: ["P", "R"],
  },
  {
    key: "security-audit",
    title: "Security Audit",
    description: "Use when checking auth, secrets, permissions and security-sensitive code.",
    phases: ["R", "V"],
  },
];

const PHASE_TO_AGENTS: Record<PrevcPhase, string[]> = {
  P: ["architect-specialist", "documentation-writer", "frontend-specialist"],
  R: ["architect-specialist", "code-reviewer", "security-auditor"],
  E: ["feature-developer", "backend-specialist", "frontend-specialist", "bug-fixer"],
  V: ["test-writer", "code-reviewer", "security-auditor", "performance-optimizer"],
  C: ["documentation-writer", "devops-specialist"],
};

const PHASE_TO_DOCS: Record<PrevcPhase, string[]> = {
  P: ["project-overview", "architecture", "glossary"],
  R: ["architecture", "security", "data-flow", "contributing"],
  E: ["architecture", "api", "data-flow", "getting-started"],
  V: ["testing-strategy", "security", "api"],
  C: ["deployment", "project-overview", "contributing"],
};

const AGENT_TO_DOCS: Record<string, string[]> = {
  "code-reviewer": ["architecture", "contributing", "glossary"],
  "bug-fixer": ["architecture", "data-flow", "testing-strategy"],
  "feature-developer": ["architecture", "data-flow", "api", "getting-started"],
  "refactoring-specialist": ["architecture", "glossary", "contributing"],
  "test-writer": ["testing-strategy", "architecture", "api"],
  "documentation-writer": ["project-overview", "glossary", "architecture", "api"],
  "performance-optimizer": ["architecture", "data-flow", "deployment"],
  "security-auditor": ["security", "architecture", "api"],
  "backend-specialist": ["architecture", "api", "data-flow", "deployment"],
  "frontend-specialist": ["architecture", "data-flow", "getting-started"],
  "architect-specialist": ["architecture", "data-flow", "security", "deployment"],
  "devops-specialist": ["deployment", "security", "testing-strategy"],
  "database-specialist": ["architecture", "data-flow", "glossary"],
  "mobile-specialist": ["architecture", "api", "getting-started"],
};

const TASK_RULES: Array<{
  name: string;
  pattern: RegExp;
  phase?: PrevcPhase;
  agents?: string[];
  docs?: string[];
  skills?: string[];
}> = [
  {
    name: "planning",
    pattern: /\b(plan|planej|requisit|requirement|escopo|scope|spec|prd)\b/i,
    phase: "P",
    agents: ["architect-specialist", "documentation-writer"],
    docs: ["project-overview", "architecture", "glossary", "development-workflow"],
    skills: ["feature-breakdown", "documentation"],
  },
  {
    name: "review",
    pattern: /\b(review|revis|auditar|avaliar|pull request|\bpr\b|diff)\b/i,
    phase: "R",
    agents: ["code-reviewer", "security-auditor"],
    docs: ["architecture", "contributing", "security"],
    skills: ["code-review", "pr-review"],
  },
  {
    name: "implementation",
    pattern: /\b(implement|implementar|create|criar|add|adicionar|feature|build|desenvolver)\b/i,
    phase: "E",
    agents: ["feature-developer"],
    docs: ["architecture", "api", "getting-started"],
    skills: ["feature-breakdown"],
  },
  {
    name: "bugfix",
    pattern: /\b(bug|fix|corrigir|erro|error|falha|issue|regression|regressão|defeito)\b/i,
    phase: "E",
    agents: ["bug-fixer", "test-writer"],
    docs: ["data-flow", "testing-strategy", "architecture"],
    skills: ["bug-investigation", "test-generation"],
  },
  {
    name: "tests",
    pattern: /\b(test|teste|testing|coverage|cobertura|validar|validation|qa)\b/i,
    phase: "V",
    agents: ["test-writer", "code-reviewer"],
    docs: ["testing-strategy", "api", "architecture"],
    skills: ["test-generation", "code-review"],
  },
  {
    name: "docs",
    pattern: /\b(doc|docs|document|documenta|readme|guide|guia|manual)\b/i,
    phase: "C",
    agents: ["documentation-writer"],
    docs: ["project-overview", "glossary", "contributing", "tooling"],
    skills: ["documentation"],
  },
  {
    name: "refactor",
    pattern: /\b(refactor|refator|limpar|clean|reorganizar|estrutura)\b/i,
    phase: "E",
    agents: ["refactoring-specialist", "code-reviewer", "test-writer"],
    docs: ["architecture", "contributing", "testing-strategy"],
    skills: ["refactoring", "code-review"],
  },
  {
    name: "security",
    pattern: /\b(security|seguran|auth|autentica|autoriza|permission|permiss|secret|token|credential)\b/i,
    phase: "R",
    agents: ["security-auditor", "backend-specialist"],
    docs: ["security", "architecture", "api"],
    skills: ["security-audit", "api-design"],
  },
  {
    name: "performance",
    pattern: /\b(performance|desempenho|otimiz|optimi[sz]e|speed|memory|cache|latency)\b/i,
    phase: "V",
    agents: ["performance-optimizer", "architect-specialist"],
    docs: ["architecture", "data-flow", "deployment"],
    skills: ["code-review"],
  },
  {
    name: "api",
    pattern: /\b(api|endpoint|route|schema|contract|contrato|webhook|tool schema|command)\b/i,
    agents: ["backend-specialist", "documentation-writer"],
    docs: ["api", "architecture", "data-flow"],
    skills: ["api-design", "documentation"],
  },
  {
    name: "frontend",
    pattern: /\b(ui|frontend|component|componente|react|vue|angular|svelte|css|layout|acessibilidade|accessibility)\b/i,
    agents: ["frontend-specialist", "test-writer"],
    docs: ["architecture", "getting-started", "testing-strategy"],
    skills: ["feature-breakdown", "test-generation"],
  },
  {
    name: "database",
    pattern: /\b(database|db|sql|query|migration|schema|banco|dados|persist)\b/i,
    agents: ["database-specialist", "backend-specialist"],
    docs: ["data-flow", "architecture", "api"],
    skills: ["api-design", "test-generation"],
  },
  {
    name: "deployment",
    pattern: /\b(deploy|release|ci|cd|pipeline|docker|infra|publish|publicar|npm)\b/i,
    phase: "C",
    agents: ["devops-specialist", "documentation-writer"],
    docs: ["deployment", "tooling", "security"],
    skills: ["commit-message", "documentation"],
  },
];

export default function aicodersContextExtension(pi: ExtensionAPI): void {
  pi.registerFlag("dotcontext-feedforward", {
    description: "Inject .context docs/agents/skills before each agent turn",
    type: "boolean",
    default: true,
  });

  pi.on("resources_discover", async (event: any) => {
    const skillsDir = path.join(event.cwd, CONTEXT_DIR, "skills");
    if (!(await exists(skillsDir))) return undefined;
    return { skillPaths: [skillsDir] };
  });

  pi.on("before_agent_start", async (event: any) => {
    if (pi.getFlag("dotcontext-feedforward") === false) return undefined;

    const feed = await buildFeedForward(event.systemPromptOptions.cwd, event.prompt);
    return {
      systemPrompt: `${event.systemPrompt}\n\n${feed.systemPromptAppendix}`,
      message: {
        customType: "aicoders-context-feedforward",
        content: feed.summary,
        display: false,
        details: {
          initialized: feed.initialized,
          docs: feed.selection.docs,
          agents: feed.selection.agents,
          skills: feed.selection.skills,
          files: feed.files.map((file) => file.relativePath),
        },
      },
    };
  });

  pi.registerCommand("dotcontext", {
    description: "Inicializa e inspeciona o contexto .context da AICoders",
    handler: async (args: string, ctx: any) => {
      const tokens = parseArgs(args);
      const command = tokens[0] ?? "help";

      if (command === "init") {
        const force = tokens.includes("--force") || tokens.includes("-f");
        const result = await initializeContext(ctx.cwd, { force });
        ctx.ui.notify(formatInitResult(result, force), "info");
        return;
      }

      if (command === "status") {
        const status = await getContextStatus(ctx.cwd);
        ctx.ui.notify(formatStatus(status), "info");
        return;
      }

      if (command === "feed") {
        const task = tokens.slice(1).join(" ").trim() || ctx.ui.getEditorText?.() || "";
        const feed = await buildFeedForward(ctx.cwd, task);
        ctx.ui.notify(formatFeedPreview(feed), "info");
        return;
      }

      ctx.ui.notify(dotcontextHelp(), "info");
    },
  });
}

async function buildFeedForward(cwd: string, prompt: string): Promise<FeedForward> {
  const selection = selectFeed(prompt);
  const contextRoot = path.join(cwd, CONTEXT_DIR);
  const initialized = await exists(contextRoot);

  if (!initialized) {
    const systemPromptAppendix = [
      "## AICoders Context Feedforward",
      "No `.context/` directory was found for this repository.",
      "Before non-trivial work, initialize the knowledge base with `/dotcontext init`, then run `/reload` so `.context/skills` are discoverable as pi skills.",
      "Until context is initialized, inspect repository docs such as README.md, AGENTS.md, CLAUDE.md and package manifests before changing code.",
    ].join("\n");

    return {
      initialized,
      selection,
      files: [],
      systemPromptAppendix,
      summary: "AICoders Context: .context ausente; sugerido /dotcontext init antes de trabalho não trivial.",
    };
  }

  const files = await loadSelectedFiles(cwd, selection);
  const lines: string[] = [
    "## AICoders Context Feedforward",
    "Use this project context before starting the user task. Prefer these local docs/playbooks over generic assumptions.",
    "If a referenced doc conflicts with the user's explicit instruction, ask for clarification before changing code.",
    "",
    `Routing: ${selection.phase ? `PREVC ${selection.phase}; ` : ""}${selection.reasons.join(", ") || "default project work"}`,
    `Selected agents: ${selection.agents.join(", ") || "none"}`,
    `Selected docs: ${selection.docs.map((doc) => `.context/docs/${docToFile(doc)}`).join(", ") || "none"}`,
    `Selected skills: ${selection.skills.map((skill) => `.context/skills/${skill}/SKILL.md`).join(", ") || "none"}`,
  ];

  if (files.length === 0) {
    lines.push(
      "",
      "No selected .context files exist yet. Run `/dotcontext init` to analyze the codebase and generate filled docs, agents and skills."
    );
  } else {
    lines.push("", "### Loaded context files");
    let remaining = MAX_FEEDFORWARD_CHARS;

    for (const file of files) {
      if (remaining <= 0) break;

      const header = `\n--- BEGIN ${file.relativePath} (${file.label}) ---\n`;
      const footer = `\n--- END ${file.relativePath} ---\n`;
      const available = Math.max(0, remaining - header.length - footer.length);
      if (available <= 0) break;

      const content = truncate(file.content, Math.min(MAX_FILE_CHARS, available));
      remaining -= header.length + content.text.length + footer.length;
      lines.push(header, content.text, footer);
    }
  }

  return {
    initialized,
    selection,
    files,
    systemPromptAppendix: lines.join("\n"),
    summary: `AICoders Context: feedforward carregou ${files.length} arquivo(s) para ${selection.agents.length} agente(s).`,
  };
}

function selectFeed(prompt: string): FeedSelection {
  const agents = new Set<string>();
  const docs = new Set<string>(["project-overview", "development-workflow"]);
  const skills = new Set<string>();
  const reasons: string[] = [];
  let phase: PrevcPhase | undefined;

  for (const rule of TASK_RULES) {
    if (!rule.pattern.test(prompt)) continue;
    reasons.push(rule.name);
    if (!phase && rule.phase) phase = rule.phase;
    for (const agent of rule.agents ?? []) agents.add(agent);
    for (const doc of rule.docs ?? []) docs.add(doc);
    for (const skill of rule.skills ?? []) skills.add(skill);
  }

  if (phase) {
    const activePhase = phase;
    for (const agent of PHASE_TO_AGENTS[activePhase]) agents.add(agent);
    for (const doc of PHASE_TO_DOCS[activePhase]) docs.add(doc);
    for (const skill of SKILLS.filter((item) => item.phases.includes(activePhase)).map((item) => item.key)) {
      skills.add(skill);
    }
  }

  if (agents.size === 0) {
    agents.add("feature-developer");
    agents.add("code-reviewer");
    docs.add("architecture");
    docs.add("testing-strategy");
    skills.add("code-review");
    reasons.push("default");
  }

  for (const agent of agents) {
    for (const doc of AGENT_TO_DOCS[agent] ?? []) docs.add(doc);
  }

  return {
    phase,
    agents: limitKnown([...agents], AGENTS.map((agent) => agent.key), 4),
    docs: limitKnown([...docs], DOCS.map((doc) => doc.key), 7),
    skills: limitKnown([...skills], SKILLS.map((skill) => skill.key), 4),
    reasons,
  };
}

async function loadSelectedFiles(cwd: string, selection: FeedSelection): Promise<FeedFile[]> {
  const specs: Array<{ label: FeedFile["label"]; relativePath: string }> = [];

  specs.push({ label: "doc", relativePath: path.posix.join(CONTEXT_DIR, "docs", "README.md") });
  for (const doc of selection.docs) {
    specs.push({ label: "doc", relativePath: path.posix.join(CONTEXT_DIR, "docs", docToFile(doc)) });
  }
  for (const agent of selection.agents) {
    specs.push({ label: "agent", relativePath: path.posix.join(CONTEXT_DIR, "agents", `${agent}.md`) });
  }
  for (const skill of selection.skills) {
    specs.push({ label: "skill", relativePath: path.posix.join(CONTEXT_DIR, "skills", skill, "SKILL.md") });
  }

  const seen = new Set<string>();
  const files: FeedFile[] = [];

  for (const spec of specs) {
    if (seen.has(spec.relativePath)) continue;
    seen.add(spec.relativePath);

    const absolutePath = path.join(cwd, spec.relativePath);
    const content = await readTextIfExists(absolutePath);
    if (!content) continue;

    const truncated = content.length > MAX_FILE_CHARS;
    files.push({ ...spec, content, truncated });
  }

  return files;
}

async function initializeContext(cwd: string, options: { force: boolean }): Promise<WriteResult> {
  const facts = await collectProjectFacts(cwd);
  const result: WriteResult = { created: [], overwritten: [], skipped: [] };
  const files = buildScaffoldFiles(facts);

  for (const file of files) {
    const absolutePath = path.join(cwd, CONTEXT_DIR, file.relativePath);
    await writeScaffoldFile(absolutePath, file.content, options.force, result, path.posix.join(CONTEXT_DIR, file.relativePath));
  }

  return result;
}

function buildScaffoldFiles(facts: ProjectFacts): Array<{ relativePath: string; content: string }> {
  const files: Array<{ relativePath: string; content: string }> = [];

  files.push({ relativePath: "docs/README.md", content: buildDocsIndex(facts) });
  files.push({ relativePath: "docs/codebase-map.json", content: JSON.stringify(buildCodebaseMap(facts), null, 2) + "\n" });

  for (const doc of DOCS) {
    files.push({ relativePath: `docs/${doc.file}`, content: buildDocTemplate(doc, facts) });
  }

  files.push({ relativePath: "agents/README.md", content: buildAgentsIndex(facts) });
  for (const agent of AGENTS) {
    files.push({ relativePath: `agents/${agent.key}.md`, content: buildAgentTemplate(agent, facts) });
  }

  files.push({ relativePath: "skills/README.md", content: buildSkillsIndex(facts) });
  for (const skill of SKILLS) {
    files.push({ relativePath: `skills/${skill.key}/SKILL.md`, content: buildSkillTemplate(skill, facts) });
  }

  return files;
}

async function collectProjectFacts(cwd: string): Promise<ProjectFacts> {
  const packageJson = await readJsonIfExists(path.join(cwd, "package.json"));
  const scripts = readRecord(packageJson?.scripts);
  const dependencies = Object.keys({
    ...readRecord(packageJson?.dependencies),
    ...readRecord(packageJson?.devDependencies),
    ...readRecord(packageJson?.peerDependencies),
    ...readRecord(packageJson?.optionalDependencies),
  }).sort();
  const packageKeywords = readStringArray(packageJson?.keywords);
  const piManifest = readPiManifest(packageJson?.pi);

  const [topLevelEntries, files, readme] = await Promise.all([readTopLevelEntries(cwd), scanFiles(cwd), analyzeReadme(cwd)]);
  const packageManager = await detectPackageManager(cwd, Boolean(packageJson));
  const primaryLanguage = detectPrimaryLanguage(files);
  const { projectType, reasoning } = classifyProject({ packageJson, dependencies, files, topLevelEntries });
  const sourceFiles = files.filter(isSourceFile);
  const testFiles = files.filter(isTestFile);
  const documentationFiles = files.filter(isDocumentationFile);
  const configFiles = files.filter(isConfigFile);
  const entryPoints = detectEntryPoints({ packageJson, files, piManifest });
  const publicContracts = await collectPublicContracts(cwd, { packageJson, piManifest, sourceFiles });
  const modules = buildModuleInsights(files, publicContracts, entryPoints);
  const securitySignals = detectSecuritySignals({ files, dependencies, publicContracts });
  const dataSignals = detectDataSignals({ files, publicContracts, modules });

  return {
    name: typeof packageJson?.name === "string" ? packageJson.name : path.basename(cwd),
    description: typeof packageJson?.description === "string" ? packageJson.description : readme.summary[0] ?? "",
    packageManager,
    projectType,
    primaryLanguage,
    scripts,
    dependencies,
    packageKeywords,
    topLevelEntries,
    files,
    sourceFiles,
    testFiles,
    documentationFiles,
    configFiles,
    entryPoints,
    piExtensions: piManifest.extensions,
    piThemes: piManifest.themes,
    readmeSummary: readme.summary,
    readmeHeadings: readme.headings,
    modules,
    publicContracts,
    securitySignals,
    dataSignals,
    reasoning,
  };
}

type ReadmeAnalysis = {
  summary: string[];
  headings: string[];
};

type PiManifest = {
  extensions: string[];
  themes: string[];
};

async function analyzeReadme(cwd: string): Promise<ReadmeAnalysis> {
  const content = await readTextIfExists(path.join(cwd, "README.md"));
  if (!content) return { summary: [], headings: [] };

  const headings: string[] = [];
  const summary: string[] = [];
  const paragraph: string[] = [];
  let inFence = false;
  let collectSummary = true;

  const flushParagraph = () => {
    const text = stripMarkdown(paragraph.join(" ").replace(/\s+/g, " ").trim());
    paragraph.length = 0;
    if (text.length >= 32 && summary.length < 4) summary.push(text);
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      flushParagraph();
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      if (heading[1].length <= 2 && summary.length > 0) collectSummary = false;
      headings.push(stripMarkdown(heading[2]).trim());
      continue;
    }

    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^<[^>]+>/.test(line) || /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^\|/.test(line)) {
      flushParagraph();
      continue;
    }

    if (collectSummary) paragraph.push(line.replace(/^>\s*/, ""));
  }

  flushParagraph();
  return { summary, headings };
}

function readPiManifest(value: unknown): PiManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { extensions: [], themes: [] };
  const record = value as Record<string, unknown>;
  return {
    extensions: readStringArray(record.extensions),
    themes: readStringArray(record.themes),
  };
}

function detectEntryPoints(input: {
  packageJson: Record<string, unknown> | undefined;
  files: string[];
  piManifest: PiManifest;
}): string[] {
  const entries = new Set<string>();
  for (const item of input.piManifest.extensions) entries.add(item);
  for (const item of input.piManifest.themes) entries.add(item);

  const packageJson = input.packageJson ?? {};
  for (const item of readStringArray(packageJson.main)) entries.add(item);
  for (const item of readStringArray(packageJson.module)) entries.add(item);
  for (const item of readStringArray(packageJson.types)) entries.add(item);
  for (const item of readPackageExports(packageJson.exports)) entries.add(item);
  for (const item of readPackageBin(packageJson.bin)) entries.add(item);

  const conventionalEntries = [
    "README.md",
    "package.json",
    "src/index.ts",
    "src/index.tsx",
    "index.ts",
    "index.tsx",
    "main.ts",
    "app.ts",
  ];
  for (const candidate of conventionalEntries) {
    if (input.files.includes(candidate)) entries.add(candidate);
  }

  for (const file of input.files) {
    if (/^extensions\/[^/]+\/index\.ts$/.test(file) || /^extensions\/[^/]+\.ts$/.test(file)) entries.add(file);
  }

  return [...entries].filter(Boolean).sort();
}

async function collectPublicContracts(
  cwd: string,
  input: { packageJson: Record<string, unknown> | undefined; piManifest: PiManifest; sourceFiles: string[] }
): Promise<PublicContract[]> {
  const contracts: PublicContract[] = [];
  const constants = new Map<string, string>();
  const sourceContents: Array<{ file: string; content: string }> = [];

  const add = (contract: PublicContract) => {
    const key = `${contract.kind}:${contract.name}:${contract.location}`;
    if (contracts.some((item) => `${item.kind}:${item.name}:${item.location}` === key)) return;
    contracts.push(contract);
  };

  for (const extension of input.piManifest.extensions) {
    add({ kind: "pi extension entry", name: extension, location: "package.json", detail: "Declared in package.json pi.extensions." });
  }
  for (const theme of input.piManifest.themes) {
    add({ kind: "pi theme entry", name: theme, location: "package.json", detail: "Declared in package.json pi.themes." });
  }
  for (const bin of readPackageBin(input.packageJson?.bin)) {
    add({ kind: "CLI binary", name: bin, location: "package.json", detail: "Declared in package.json bin." });
  }
  for (const exported of readPackageExports(input.packageJson?.exports)) {
    add({ kind: "package export", name: exported, location: "package.json", detail: "Declared in package.json exports." });
  }

  for (const file of input.sourceFiles.slice(0, 180)) {
    const content = await readTextIfExists(path.join(cwd, file));
    if (!content) continue;
    sourceContents.push({ file, content });
    for (const match of content.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g)) {
      constants.set(match[1], match[2]);
    }
  }

  for (const { file, content } of sourceContents) {
    collectRegistrations(content, file, constants, add);
  }

  return contracts.sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
}

function collectRegistrations(
  content: string,
  file: string,
  constants: Map<string, string>,
  add: (contract: PublicContract) => void
): void {
  for (const match of content.matchAll(/\.registerCommand\(\s*([^,\n)]+)/g)) {
    const name = resolveRegistrationName(match[1], constants);
    if (!name) continue;
    add({ kind: "slash command", name: `/${name}`, location: file, detail: extractDescription(content, match.index ?? 0) ?? "Command registered by an extension." });
  }

  for (const match of content.matchAll(/\.registerFlag\(\s*([^,\n)]+)/g)) {
    const name = resolveRegistrationName(match[1], constants);
    if (!name) continue;
    add({ kind: "CLI flag", name: `--${name}`, location: file, detail: extractDescription(content, match.index ?? 0) ?? "CLI flag registered by an extension." });
  }

  for (const match of content.matchAll(/\.on\(\s*["'`]([^"'`]+)["'`]/g)) {
    add({ kind: "pi event hook", name: match[1], location: file, detail: "Extension subscribes to this pi lifecycle/event hook." });
  }

  for (const match of content.matchAll(/\.registerTool\(\s*\{[\s\S]{0,1200}?name:\s*([^,\n}]+)/g)) {
    const name = resolveRegistrationName(match[1], constants);
    if (!name) continue;
    add({ kind: "LLM tool", name, location: file, detail: extractDescription(content, match.index ?? 0) ?? "Custom tool registered for the agent." });
  }

  for (const match of content.matchAll(/customType:\s*["'`]([^"'`]+)["'`]/g)) {
    add({ kind: "custom session message", name: match[1], location: file, detail: "Custom message type emitted into the pi session." });
  }
}

function buildModuleInsights(files: string[], contracts: PublicContract[], entryPoints: string[]): ModuleInsight[] {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const key = moduleKey(file);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(file);
    groups.set(key, list);
  }

  const insights = [...groups.entries()].map(([modulePath, moduleFiles]) => {
    const moduleContracts = contracts.filter((contract) => contract.location === modulePath || contract.location.startsWith(`${modulePath}/`));
    const moduleEntries = entryPoints.filter((entry) => entry === modulePath || entry.startsWith(`${modulePath}/`) || moduleFiles.includes(entry));
    const sourceCount = moduleFiles.filter(isSourceFile).length;
    const docCount = moduleFiles.filter(isDocumentationFile).length;
    const highlights = [
      sourceCount > 0 ? `${sourceCount} source file(s)` : undefined,
      docCount > 0 ? `${docCount} documentation file(s)` : undefined,
      moduleEntries.length > 0 ? `entry point(s): ${moduleEntries.slice(0, 3).join(", ")}` : undefined,
      moduleContracts.length > 0 ? `contracts: ${moduleContracts.slice(0, 5).map((contract) => `${contract.kind} ${contract.name}`).join(", ")}` : undefined,
    ].filter((item): item is string => Boolean(item));

    return {
      path: modulePath,
      role: inferModuleRole(modulePath, moduleContracts, moduleFiles),
      files: moduleFiles.slice(0, 12),
      highlights,
    };
  });

  return insights
    .sort((a, b) => scoreModule(b, entryPoints) - scoreModule(a, entryPoints) || a.path.localeCompare(b.path))
    .slice(0, 16);
}

function detectSecuritySignals(input: { files: string[]; dependencies: string[]; publicContracts: PublicContract[] }): string[] {
  const signals = new Set<string>();
  const contractNames = input.publicContracts.map((contract) => `${contract.kind}:${contract.name}:${contract.location}`).join("\n");

  if (/guardrails/i.test(contractNames) || input.files.some((file) => file.includes("guardrails"))) {
    signals.add("Guardrails extension protects .env files, generated/internal directories and destructive shell/package/git operations.");
  }
  if (input.publicContracts.some((contract) => contract.kind === "pi event hook" && ["tool_call", "user_bash"].includes(contract.name))) {
    signals.add("The code intercepts tool calls or user shell commands; fail-safe behavior should block when explicit approval is unavailable.");
  }
  if (input.publicContracts.some((contract) => contract.kind === "LLM tool")) {
    signals.add("Custom LLM tools are public agent capabilities and must validate inputs, preserve state shape and avoid unintended side effects.");
  }
  if (input.files.some((file) => /(^|\/)\.env(\.|$)/.test(file))) {
    signals.add("Environment files are present or referenced; never expose secrets in generated context.");
  }
  if (input.dependencies.some((dep) => /auth|oauth|token|jwt|secret/i.test(dep))) {
    signals.add("Authentication/security-related dependencies detected; review credential handling before changes.");
  }

  return [...signals];
}

function detectDataSignals(input: { files: string[]; publicContracts: PublicContract[]; modules: ModuleInsight[] }): string[] {
  const signals = new Set<string>();
  if (input.publicContracts.some((contract) => contract.kind === "slash command")) {
    signals.add("Slash commands receive user text, inspect repository files and report through ctx.ui.notify.");
  }
  if (input.publicContracts.some((contract) => contract.name === "before_agent_start")) {
    signals.add("before_agent_start hooks append contextual instructions/messages to the next agent turn.");
  }
  if (input.publicContracts.some((contract) => contract.name === "resources_discover")) {
    signals.add("resources_discover exposes generated .context skills/prompts/themes to pi resource loading.");
  }
  if (input.files.some((file) => file.startsWith(".context/")) || input.modules.some((module) => module.path === "extensions/context")) {
    signals.add("/dotcontext init writes .context docs, agent playbooks, skills and codebase-map.json from repository analysis.");
  }
  if (input.modules.some((module) => /prevc/i.test(module.path))) {
    signals.add("PREVC stores workflow state in session entries and can commit during the confirmation stage.");
  }
  return [...signals];
}

function classifyProject(input: {
  packageJson: Record<string, unknown> | undefined;
  dependencies: string[];
  files: string[];
  topLevelEntries: string[];
}): { projectType: ProjectType; reasoning: string[] } {
  const deps = new Set(input.dependencies.map((dep) => dep.toLowerCase()));
  const packageJson = input.packageJson ?? {};
  const reasoning: string[] = [];
  const detected = new Set<ProjectType>();

  const piManifest = readPiManifest(packageJson.pi);
  const keywords = readStringArray(packageJson.keywords).map((keyword) => keyword.toLowerCase());

  if (piManifest.extensions.length > 0 || piManifest.themes.length > 0 || keywords.includes("pi-extension") || keywords.includes("pi-package")) {
    detected.add("pi-extension");
    reasoning.push("pi package manifest or pi extension/theme keywords detected");
  }

  if (packageJson.workspaces || deps.has("lerna") || deps.has("nx") || deps.has("turbo") || input.topLevelEntries.includes("pnpm-workspace.yaml")) {
    detected.add("monorepo");
    reasoning.push("monorepo tooling/workspaces detected");
  }

  if (["react", "vue", "angular", "svelte", "next", "nextjs", "astro", "vite"].some((dep) => deps.has(dep))) {
    detected.add("web-frontend");
    reasoning.push("frontend framework dependency detected");
  }

  if (["express", "fastify", "koa", "hapi", "nestjs", "@nestjs/core"].some((dep) => deps.has(dep))) {
    detected.add("web-backend");
    reasoning.push("backend framework dependency detected");
  }

  if (["react-native", "expo", "ionic", "capacitor"].some((dep) => deps.has(dep))) {
    detected.add("mobile");
    reasoning.push("mobile framework dependency detected");
  }

  if (["electron", "tauri", "@tauri-apps/api"].some((dep) => deps.has(dep))) {
    detected.add("desktop");
    reasoning.push("desktop framework dependency detected");
  }

  if (packageJson.bin || ["commander", "yargs", "meow", "inquirer", "prompts", "oclif", "cac"].some((dep) => deps.has(dep))) {
    detected.add("cli");
    reasoning.push("CLI entrypoint or CLI library detected");
  }

  if ((packageJson.main || packageJson.exports) && !packageJson.bin && detected.size === 0) {
    detected.add("library");
    reasoning.push("package main/exports detected without app framework indicators");
  }

  if (detected.has("web-frontend") && detected.has("web-backend")) return { projectType: "full-stack", reasoning };

  const priority: ProjectType[] = ["monorepo", "pi-extension", "mobile", "desktop", "web-frontend", "web-backend", "cli", "library"];
  for (const type of priority) {
    if (detected.has(type)) return { projectType: type, reasoning };
  }

  reasoning.push("no strong project-type signals detected");
  return { projectType: "unknown", reasoning };
}

async function scanFiles(cwd: string): Promise<string[]> {
  const results: string[] = [];

  async function visit(dir: string, prefix: string): Promise<void> {
    if (results.length >= MAX_SCAN_FILES) return;

    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (results.length >= MAX_SCAN_FILES) return;
      if (entry.name.startsWith(".") && entry.name !== ".github") {
        if (EXCLUDED_SCAN_DIRS.has(entry.name)) continue;
      }

      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_SCAN_DIRS.has(entry.name)) continue;
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  await visit(cwd, "");
  return results;
}

async function readTopLevelEntries(cwd: string): Promise<string[]> {
  try {
    return (await fs.readdir(cwd)).sort();
  } catch {
    return [];
  }
}

async function detectPackageManager(cwd: string, hasPackageJson = false): Promise<string> {
  if (await exists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (await exists(path.join(cwd, "package-lock.json"))) return "npm";
  if (await exists(path.join(cwd, "bun.lockb"))) return "bun";
  return hasPackageJson ? "npm" : "unknown";
}

function detectPrimaryLanguage(files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[none]";
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }

  const preferred: Array<[string, string]> = [
    [".ts", "TypeScript"],
    [".tsx", "TypeScript/React"],
    [".js", "JavaScript"],
    [".jsx", "JavaScript/React"],
    [".py", "Python"],
    [".go", "Go"],
    [".rs", "Rust"],
    [".java", "Java"],
  ];

  for (const [extension, label] of preferred) {
    if ((counts.get(extension) ?? 0) > 0) return label;
  }

  return "unknown";
}

function buildDocsIndex(facts: ProjectFacts): string {
  return [
    "# Documentation Index",
    "",
    `Knowledge base for **${facts.name}** generated from repository analysis by the AICoders Context extension.`,
    "",
    "## Project Snapshot",
    "",
    projectFactsSummary(facts),
    "",
    "## Detected Public Surface",
    "",
    ...formatContracts(facts.publicContracts, () => true, 8, "No public commands, tools, events or package entries detected."),
    "",
    "## Core Guides",
    "",
    ...DOCS.map((doc) => `- [${doc.title}](./${doc.file}) — ${doc.description}`),
    "",
    "## Codebase Map",
    "",
    "- [codebase-map.json](./codebase-map.json) — machine-readable snapshot generated during initialization.",
    "",
    "## Usage",
    "",
    `- Use ${mdCode("/dotcontext feed <task>")} to preview which files would be injected for a task.`,
    "- The extension automatically injects relevant docs/agents/skills before every agent turn.",
    `- Run ${mdCode("/dotcontext init --force")} only when you intentionally want to regenerate generated context files, including manually edited files.`,
    "",
  ].join("\n");
}

function buildDocTemplate(doc: DocDefinition, facts: ProjectFacts): string {
  const today = new Date().toISOString().slice(0, 10);
  const frontmatter = [
    "---",
    "type: doc",
    `name: ${doc.key}`,
    `description: ${doc.description}`,
    `generated: ${today}`,
    "status: generated",
    "---",
  ].join("\n");

  const primaryFiles = facts.entryPoints.length > 0 ? facts.entryPoints : facts.files.slice(0, 20);
  const validationScripts = filterScripts(facts.scripts, /(test|lint|type|check|build)/i);
  const releaseScripts = filterScripts(facts.scripts, /(build|release|publish|deploy|pack|smoke)/i);

  let body: string[];

  switch (doc.key) {
    case "project-overview":
      body = [
        `# ${doc.title}`,
        "",
        projectFactsSummary(facts),
        "",
        "## Purpose",
        "",
        ...formatParagraphs(projectPurpose(facts), "No README or package description was found in the current scan."),
        "",
        "## What This Codebase Provides",
        "",
        ...formatModules(facts.modules, 8),
        "",
        "## Key Entry Points",
        "",
        ...formatCodeBullets(primaryFiles, "No source entry points detected.", 30),
        "",
        "## Public Surface",
        "",
        ...formatContracts(facts.publicContracts, () => true, 12, "No public contracts detected."),
        "",
        "## Next Reading",
        "",
        "- [Architecture](./architecture.md)",
        "- [API Reference](./api.md)",
        "- [Testing Strategy](./testing-strategy.md)",
      ];
      break;
    case "architecture":
      body = [
        `# ${doc.title}`,
        "",
        "## Current Signals",
        "",
        projectFactsSummary(facts),
        "",
        "## System Shape",
        "",
        ...formatParagraphs(architectureSummary(facts), "The repository layout does not expose enough source files to infer system shape."),
        "",
        "## Modules and Boundaries",
        "",
        ...formatModules(facts.modules, 12),
        "",
        "## Inferred Decisions",
        "",
        ...formatBullets(architectureDecisions(facts), "No architectural decisions were inferred from the scan."),
        "",
        "## Diagram",
        "",
        "```mermaid",
        "flowchart LR",
        "  User[User / agent turn] --> Pi[pi runtime]",
        "  Pi --> Manifest[package.json pi manifest]",
        "  Manifest --> Ext[Extension entrypoints]",
        "  Ext --> Contracts[Commands, tools and event hooks]",
        "  Contracts --> Output[UI notifications, session messages and files]",
        "```",
      ];
      break;
    case "data-flow":
      body = [
        `# ${doc.title}`,
        "",
        "## Inputs",
        "",
        ...formatBullets(dataInputs(facts), "No runtime inputs detected."),
        "",
        "## Transformations",
        "",
        ...formatBullets([...facts.dataSignals, ...dataTransformations(facts)], "No transformations inferred from the scan."),
        "",
        "## Outputs and Side Effects",
        "",
        ...formatBullets(dataOutputs(facts), "No generated outputs or side effects detected."),
        "",
        "## Persistence",
        "",
        ...formatBullets(dataPersistence(facts), "No persistence layer detected."),
      ];
      break;
    case "api":
      body = [
        `# ${doc.title}`,
        "",
        "## Slash Commands",
        "",
        ...formatContracts(facts.publicContracts, (contract) => contract.kind === "slash command", 20, "No slash commands detected."),
        "",
        "## LLM Tools and Flags",
        "",
        ...formatContracts(facts.publicContracts, (contract) => contract.kind === "LLM tool" || contract.kind === "CLI flag", 20, "No custom LLM tools or CLI flags detected."),
        "",
        "## Events and Session Messages",
        "",
        ...formatContracts(facts.publicContracts, (contract) => contract.kind === "pi event hook" || contract.kind === "custom session message", 30, "No pi events or custom session message types detected."),
        "",
        "## Package Integration",
        "",
        ...formatContracts(facts.publicContracts, (contract) => contract.kind.startsWith("pi ") || contract.kind === "package export" || contract.kind === "CLI binary", 20, "No package-level integration contracts detected."),
        "",
        "## Examples",
        "",
        ...formatUsageExamples(facts),
      ];
      break;
    case "getting-started":
      body = [
        `# ${doc.title}`,
        "",
        "## Setup",
        "",
        `Package manager: **${facts.packageManager}**`,
        "",
        "```bash",
        installCommand(facts.packageManager),
        "```",
        "",
        "## Local Pi Loading",
        "",
        ...formatBullets(localPiLoading(facts), "No pi extension/theme manifest was detected."),
        "",
        "## Useful Commands",
        "",
        formatScripts(facts.scripts),
        "",
        "## First Files To Read",
        "",
        ...formatCodeBullets(primaryFiles, "README.md", 30),
      ];
      break;
    case "development-workflow":
      body = [
        `# ${doc.title}`,
        "",
        "## Workflow",
        "",
        "Use PREVC for non-trivial work:",
        "",
        "1. **P — Planejar**: investigate in read-only mode and define scope, requirements, artifacts and checks.",
        "2. **R — Revisar**: validate approach, risks, architecture and acceptance criteria before editing.",
        "3. **E — Executar**: implement one approved phase at a time with focused file changes.",
        "4. **V — Validar**: run checks and capture objective evidence.",
        "5. **C — Confirmar**: summarize, hand off and commit only when appropriate.",
        "",
        "## Repository Commands",
        "",
        formatScripts(facts.scripts),
        "",
        "## Change Rules Inferred From The Codebase",
        "",
        ...formatBullets(developmentRules(facts), "No project-specific workflow rules detected."),
      ];
      break;
    case "testing-strategy":
      body = [
        `# ${doc.title}`,
        "",
        "## Test and Check Commands",
        "",
        formatScripts(validationScripts),
        "",
        "## Detected Test Files",
        "",
        ...formatCodeBullets(facts.testFiles, "No test files detected in the current scan.", 30),
        "",
        "## Recommended Validation",
        "",
        ...formatBullets(testingRecommendations(facts), "Add repository scripts for lint, typecheck and tests, then document them here."),
        "",
        "## Evidence Standard",
        "",
        "For every change, capture commands run, exit status, relevant logs and any manual verification steps.",
      ];
      break;
    case "tooling":
      body = [
        `# ${doc.title}`,
        "",
        "## Package Manager",
        "",
        `Detected: **${facts.packageManager}**`,
        "",
        "## Scripts",
        "",
        formatScripts(facts.scripts),
        "",
        "## Pi Manifest",
        "",
        ...formatPiManifest(facts),
        "",
        "## Configuration Files",
        "",
        ...formatCodeBullets(facts.configFiles, "No config files detected.", 40),
        "",
        "## Dependencies Snapshot",
        "",
        ...formatCodeBullets(facts.dependencies, "No package dependencies detected.", 80),
      ];
      break;
    case "security":
      body = [
        `# ${doc.title}`,
        "",
        "## Sensitive Areas",
        "",
        ...formatBullets(securityAreas(facts), "No security-sensitive areas detected."),
        "",
        "## Project-Specific Signals",
        "",
        ...formatBullets(facts.securitySignals, "No extra security signals inferred from the scan."),
        "",
        "## Review Gates",
        "",
        ...formatBullets(securityReviewGates(facts), "Review file-system writes, shell execution and package publishing before merging."),
      ];
      break;
    case "deployment":
      body = [
        `# ${doc.title}`,
        "",
        "## Build and Release Commands",
        "",
        formatScripts(releaseScripts),
        "",
        "## Distribution Model",
        "",
        ...formatBullets(distributionModel(facts), "No deployment/distribution model detected."),
        "",
        "## Release Notes",
        "",
        ...formatBullets(releaseNotes(facts), "No release automation detected; document manual publishing steps before release."),
      ];
      break;
    case "contributing":
      body = [
        `# ${doc.title}`,
        "",
        "## Standards",
        "",
        ...formatBullets(contributingStandards(facts), "Keep changes focused, documented and validated."),
        "",
        "## Review Checklist",
        "",
        ...formatBullets(reviewChecklist(facts), "Review behavior, docs and validation evidence before handoff."),
        "",
        "## Validation",
        "",
        "Before handing off, run relevant checks from [Testing Strategy](./testing-strategy.md) and record the evidence.",
      ];
      break;
    case "glossary":
      body = [
        `# ${doc.title}`,
        "",
        "## Terms",
        "",
        ...formatGlossary(facts),
      ];
      break;
    default:
      body = [`# ${doc.title}`, "", "Generated guide. Add project-specific details as the codebase evolves."];
      break;
  }

  return `${frontmatter}\n\n${body.join("\n")}\n`;
}

function projectPurpose(facts: ProjectFacts): string[] {
  return dedupeStrings([facts.description, ...facts.readmeSummary].filter(Boolean));
}

function architectureSummary(facts: ProjectFacts): string[] {
  const summary = [`${facts.name} is detected as a ${facts.projectType} project written primarily in ${facts.primaryLanguage}.`];
  if (facts.piExtensions.length > 0 || facts.piThemes.length > 0) {
    summary.push("The package is loaded by pi through package.json manifest entries for extensions and/or themes.");
  }
  if (facts.publicContracts.length > 0) {
    summary.push("Runtime behavior is exposed through ExtensionAPI registrations such as slash commands, tools, flags, event hooks and custom session messages.");
  }
  return summary;
}

function architectureDecisions(facts: ProjectFacts): string[] {
  return [
    facts.piExtensions.length > 0 ? "Use pi extension entrypoints instead of forking pi internals." : undefined,
    facts.modules.some((module) => module.path === "extensions/context") ? "Keep .context generation repository-local and preserve manually edited context files unless --force is requested." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "Keep PREVC state and formatting separated across domain, application and adapter modules." : undefined,
    facts.modules.some((module) => module.path === "extensions/guardrails") ? "Fail closed for sensitive operations when no UI confirmation is available." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function dataInputs(facts: ProjectFacts): string[] {
  return [
    facts.publicContracts.some((contract) => contract.kind === "slash command") ? "User slash-command arguments handled by registered commands." : undefined,
    facts.publicContracts.some((contract) => contract.kind === "pi event hook") ? "Pi lifecycle and tool events handled by extension hooks." : undefined,
    facts.files.includes("package.json") ? "package.json scripts, dependencies, keywords and pi manifest." : undefined,
    facts.documentationFiles.includes("README.md") ? "README.md and repository documentation used for generated context." : undefined,
    facts.sourceFiles.length > 0 ? "Source files scanned for registrations, modules and constants." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function dataTransformations(facts: ProjectFacts): string[] {
  return [
    facts.modules.some((module) => module.path === "extensions/context") ? "Context extension classifies tasks, selects docs/agents/skills and truncates loaded files to fit the system prompt budget." : undefined,
    facts.modules.some((module) => module.path === "extensions/guardrails") ? "Guardrails evaluate paths and shell commands into allow/block decisions." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "PREVC converts workflow tool actions into persisted stage transitions and validation evidence." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function dataOutputs(facts: ProjectFacts): string[] {
  return [
    facts.modules.some((module) => module.path === "extensions/context") ? "Generated .context/docs, .context/agents, .context/skills and codebase-map.json." : undefined,
    facts.publicContracts.some((contract) => contract.name === "before_agent_start") ? "System prompt appendices and hidden custom messages injected before agent turns." : undefined,
    facts.publicContracts.some((contract) => contract.kind === "slash command") ? "UI notifications for command results and status previews." : undefined,
    facts.modules.some((module) => module.path === "extensions/guardrails") ? "Blocked tool/user-bash results when explicit permission is not granted." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "Optional git commits during PREVC confirmation." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function dataPersistence(facts: ProjectFacts): string[] {
  return [
    facts.modules.some((module) => module.path === "extensions/context") ? ".context/ files persist generated knowledge in the target repository." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "PREVC workflow state is reconstructed from custom session entries." : undefined,
    facts.files.includes("themes/aicoders-claude.json") ? "Theme JSON is static package data discovered by pi." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function localPiLoading(facts: ProjectFacts): string[] {
  return [
    facts.piExtensions.length > 0 ? `Load locally with ${mdCode("pi -e .")} to test package extensions from ${mdCode("package.json")}.` : undefined,
    facts.piExtensions.length > 0 ? `Extension entrypoints: ${facts.piExtensions.map(mdCode).join(", ")}.` : undefined,
    facts.piThemes.length > 0 ? `Theme paths: ${facts.piThemes.map(mdCode).join(", ")}.` : undefined,
    facts.modules.some((module) => module.path === "extensions/context") ? `After ${mdCode("/dotcontext init")}, run ${mdCode("/reload")} so generated skills are discovered.` : undefined,
  ].filter((item): item is string => Boolean(item));
}

function developmentRules(facts: ProjectFacts): string[] {
  return [
    "Use PREVC for non-trivial work and keep implementation phases small.",
    facts.modules.some((module) => module.path === "extensions/context") ? "Do not overwrite user-edited .context files unless the user passes --force or the file is still a generated placeholder." : undefined,
    facts.modules.some((module) => module.path === "extensions/guardrails") ? "Ask for explicit permission before sensitive path, shell, git or dependency operations." : undefined,
    Object.keys(facts.scripts).length === 0 ? "No package scripts are currently declared; document ad-hoc validation commands in handoff notes." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function testingRecommendations(facts: ProjectFacts): string[] {
  return [
    Object.keys(filterScripts(facts.scripts, /(test|lint|type|check|build)/i)).length > 0 ? "Run the detected validation scripts that match the changed area." : "No automated validation scripts detected; add lint/typecheck/test scripts when the project grows.",
    facts.piExtensions.length > 0 ? `Smoke-test extension loading with ${mdCode("pi -e .")} in a disposable session.` : undefined,
    facts.modules.some((module) => module.path === "extensions/context") ? `Exercise ${mdCode("/dotcontext init")} and ${mdCode("/dotcontext feed <task>")} against a temporary repository before release.` : undefined,
    facts.modules.some((module) => module.path === "extensions/guardrails") ? "Test allow/block decisions for sensitive paths and destructive commands." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "Validate PREVC stage transitions with prevc_workflow actions and command flows." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function securityAreas(facts: ProjectFacts): string[] {
  return [
    "Secrets and environment files must not be read or echoed without explicit user permission.",
    facts.publicContracts.some((contract) => contract.name === "tool_call" || contract.name === "user_bash") ? "Tool-call and shell interception paths can block user/agent actions and should fail safe." : undefined,
    facts.modules.some((module) => module.path === "extensions/context") ? "Generated context may include codebase metadata; avoid collecting file contents that could contain secrets." : undefined,
    facts.modules.some((module) => module.path === "extensions/prevc") ? "PREVC confirmation can create commits; verify git status and commit message before enabling commit." : undefined,
    facts.dependencies.length > 0 ? "Package dependencies and peer dependencies are part of the trusted runtime surface." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function securityReviewGates(facts: ProjectFacts): string[] {
  return [
    "Review any change that expands filesystem reads/writes, shell execution, package mutation or git operations.",
    facts.publicContracts.some((contract) => contract.kind === "LLM tool") ? "Review custom tool schemas, input preparation and returned details for compatibility and safety." : undefined,
    facts.publicContracts.some((contract) => contract.kind === "pi event hook") ? "Review event hooks for fail-open behavior and unintended prompt/session mutation." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function distributionModel(facts: ProjectFacts): string[] {
  return [
    facts.piExtensions.length > 0 || facts.piThemes.length > 0 ? "Distributed as a pi package declared through package.json pi.extensions and pi.themes." : undefined,
    facts.packageKeywords.length > 0 ? `Package keywords: ${facts.packageKeywords.map(mdCode).join(", ")}.` : undefined,
    facts.readmeHeadings.some((heading) => /instala|install/i.test(heading)) ? "README includes installation guidance for local and git-based pi package loading." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function releaseNotes(facts: ProjectFacts): string[] {
  return [
    Object.keys(filterScripts(facts.scripts, /(release|publish|deploy|pack)/i)).length > 0 ? "Use release/publish scripts listed above and capture their output." : "No release/publish scripts detected in package.json.",
    facts.piExtensions.length > 0 ? "Before publishing, smoke-test extension discovery, command registration and resource discovery from a clean clone." : undefined,
    facts.piThemes.length > 0 ? "When theme files change, reload pi and select the theme from /settings for visual smoke testing." : undefined,
  ].filter((item): item is string => Boolean(item));
}

function contributingStandards(facts: ProjectFacts): string[] {
  return [
    `Primary implementation language: ${facts.primaryLanguage}.`,
    "Prefer small, reviewable changes aligned with existing extension/module boundaries.",
    facts.modules.some((module) => module.path === "extensions/context") ? "Generated docs should explain inferred behavior and replace generic placeholders." : undefined,
    "Keep README and generated context docs in sync when public commands, tools, flags or workflows change.",
  ].filter((item): item is string => Boolean(item));
}

function reviewChecklist(facts: ProjectFacts): string[] {
  return [
    "Does the change preserve existing user files and manual edits?",
    facts.publicContracts.length > 0 ? "Are public commands/tools/events documented in .context/docs/api.md and README when behavior changes?" : undefined,
    "Were relevant validation commands run and captured with exit status?",
    facts.securitySignals.length > 0 ? "Were security-sensitive paths and fail-safe behavior reviewed?" : undefined,
  ].filter((item): item is string => Boolean(item));
}

function formatUsageExamples(facts: ProjectFacts): string[] {
  const examples: string[] = [];
  if (facts.publicContracts.some((contract) => contract.name === "/dotcontext")) {
    examples.push(`- ${mdCode("/dotcontext init")} analyzes the repository and creates .context docs/agents/skills.`);
    examples.push(`- ${mdCode("/dotcontext feed implementar feature")} previews selected feedforward files for a task.`);
  }
  if (facts.publicContracts.some((contract) => contract.name === "/guardrails")) {
    examples.push(`- ${mdCode("/guardrails")} shows the active safety rules.`);
  }
  if (facts.publicContracts.some((contract) => contract.name === "/prevc")) {
    examples.push(`- ${mdCode("/prevc start <objetivo>")} starts the PREVC workflow.`);
  }
  return examples.length > 0 ? examples : ["- No command examples inferred from detected public contracts."];
}

function formatGlossary(facts: ProjectFacts): string[] {
  const terms = [
    "- **PREVC** — Planejar, Revisar, Executar, Validar, Confirmar workflow used for non-trivial changes.",
    "- **Feedforward** — repository context injected before work starts so the agent acts with local knowledge.",
    "- **dotcontext** — AICoders Context command family that generates and loads the .context knowledge base.",
    "- **Guardrails** — extension rules that block or ask permission for sensitive paths and commands.",
    "- **Pi package** — package.json manifest with pi.extensions and/or pi.themes loaded by the pi coding agent.",
    ...facts.publicContracts
      .filter((contract) => contract.kind === "slash command" || contract.kind === "LLM tool" || contract.kind === "CLI flag")
      .slice(0, 12)
      .map((contract) => `- **${contract.name}** — ${contract.kind} in ${mdCode(contract.location)}. ${contract.detail}`),
  ];
  return dedupeStrings(terms);
}

function formatParagraphs(items: string[], fallback: string): string[] {
  const values = dedupeStrings(items).filter(Boolean);
  if (values.length === 0) return [fallback];
  return values.flatMap((item, index) => (index === 0 ? [item] : ["", item]));
}

function formatBullets(items: string[], fallback: string, max = 12): string[] {
  const values = dedupeStrings(items).filter(Boolean).slice(0, max);
  if (values.length === 0) return [`- ${fallback}`];
  return values.map((item) => `- ${item}`);
}

function formatCodeBullets(items: string[], fallback: string, max = 20): string[] {
  const values = dedupeStrings(items).filter(Boolean).slice(0, max);
  if (values.length === 0) return [`- ${fallback}`];
  return values.map((item) => `- ${mdCode(item)}`);
}

function formatContracts(
  contracts: PublicContract[],
  predicate: (contract: PublicContract) => boolean,
  max: number,
  fallback: string
): string[] {
  const values = contracts.filter(predicate).slice(0, max);
  if (values.length === 0) return [`- ${fallback}`];
  return values.map((contract) => `- **${contract.kind}** ${mdCode(contract.name)} — ${contract.detail} (${mdCode(contract.location)})`);
}

function formatModules(modules: ModuleInsight[], max = 10): string[] {
  const values = modules.slice(0, max);
  if (values.length === 0) return ["- No modules inferred from the current scan."];
  return values.map((module) => {
    const highlights = module.highlights.length > 0 ? ` Highlights: ${module.highlights.join("; ")}.` : "";
    return `- **${module.path}** — ${module.role}${highlights}`;
  });
}

function formatPiManifest(facts: ProjectFacts): string[] {
  const lines = [
    facts.piExtensions.length > 0 ? `- Extensions: ${facts.piExtensions.map(mdCode).join(", ")}` : undefined,
    facts.piThemes.length > 0 ? `- Themes: ${facts.piThemes.map(mdCode).join(", ")}` : undefined,
  ].filter((item): item is string => Boolean(item));
  return lines.length > 0 ? lines : ["- No pi manifest entries detected."];
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function buildAgentsIndex(facts: ProjectFacts): string {
  return [
    "# Agent Handbook",
    "",
    "This directory contains dotcontext-style agent playbooks generated from the repository analysis.",
    "",
    "## Project Snapshot",
    "",
    projectFactsSummary(facts),
    "",
    "## Available Agents",
    "",
    ...AGENTS.map((agent) => `- [${agent.title}](./${agent.key}.md) — ${agent.description}`),
    "",
    "## How The Extension Uses Agents",
    "",
    "Before each agent turn, the extension selects playbooks that match the user's task and injects them with relevant docs and skills as feedforward context.",
    "",
  ].join("\n");
}

function buildAgentTemplate(agent: AgentDefinition, facts: ProjectFacts): string {
  const today = new Date().toISOString().slice(0, 10);
  const docs = AGENT_TO_DOCS[agent.key] ?? ["project-overview", "architecture"];
  const frontmatter = [
    "---",
    "type: agent",
    `name: ${agent.key}`,
    `description: ${agent.description}`,
    `role: ${agent.role}`,
    `generated: ${today}`,
    "status: generated",
    "---",
  ].join("\n");

  const body = [
    `# ${agent.title}`,
    "",
    "## Role",
    "",
    `${agent.description}.`,
    "",
    "## Load First",
    "",
    ...docs.map((doc) => `- ${mdCode(`.context/docs/${docToFile(doc)}`)}`),
    "",
    "## Responsibilities",
    "",
    "- Understand the active PREVC phase and task scope before acting.",
    "- Prefer project docs and existing patterns over generic assumptions.",
    "- Keep changes small, reviewable and backed by validation evidence.",
    "- Update docs or handoff notes when behavior, APIs or workflows change.",
    "",
    "## Workflow",
    "",
    "1. Read the selected feedforward docs and this playbook.",
    "2. Inspect the relevant source files before proposing or editing code.",
    "3. Execute only the current approved scope.",
    "4. Validate with the repository's documented commands.",
    "5. Report evidence, risks and follow-up work.",
    "",
    "## Project-Specific Notes",
    "",
    ...formatBullets(agentProjectNotes(agent, facts), `No project-specific notes inferred for ${agent.title}.`),
    "",
    "## Relevant Files",
    "",
    ...formatCodeBullets(agentRelevantFiles(agent, facts), "No role-specific files inferred.", 20),
  ];

  return `${frontmatter}\n\n${body.join("\n")}\n`;
}

function buildSkillsIndex(facts: ProjectFacts): string {
  return [
    "# Skills",
    "",
    "Task-specific skills generated from this repository's detected stack, public contracts and workflow.",
    "",
    "## Project Snapshot",
    "",
    projectFactsSummary(facts),
    "",
    ...SKILLS.map((skill) => `- [${skill.title}](./${skill.key}/SKILL.md) — ${skill.description}`),
    "",
  ].join("\n");
}

function buildSkillTemplate(skill: SkillDefinition, facts: ProjectFacts): string {
  const frontmatter = [
    "---",
    `name: ${skill.key}`,
    `description: ${skill.description}`,
    `phases: [${skill.phases.join(", ")}]`,
    "---",
  ].join("\n");

  const body = [
    `# ${skill.title}`,
    "",
    "## Procedure",
    "",
    "1. Confirm the task scope and active PREVC phase.",
    `2. Load the relevant project docs from ${mdCode(".context/docs/")}.`,
    "3. Apply the checklist below to the specific files in scope.",
    "4. Capture validation evidence and unresolved risks.",
    "",
    "## Checklist",
    "",
    "- Use repository-specific conventions, not generic defaults.",
    "- Reference concrete files, commands and outputs.",
    "- Keep recommendations actionable and prioritized.",
    "- If information is missing, inspect the codebase first, then ask a focused question only when needed.",
    "",
    "## Project Notes",
    "",
    ...formatBullets(skillProjectNotes(skill, facts), "No skill-specific repository notes inferred."),
    "",
    "## Useful Context",
    "",
    ...formatCodeBullets(skillRelevantDocs(skill), ".context/docs/project-overview.md", 10),
  ];

  return `${frontmatter}\n\n${body.join("\n")}\n`;
}

function agentProjectNotes(agent: AgentDefinition, facts: ProjectFacts): string[] {
  const notes = [`Project is detected as ${facts.projectType} with primary language ${facts.primaryLanguage}.`];
  if (agent.key.includes("security")) notes.push(...facts.securitySignals);
  if (agent.key.includes("documentation")) notes.push("Keep generated .context docs concrete: mention commands, files, modules and validation evidence.");
  if (agent.key.includes("test") || agent.key.includes("bug")) notes.push(...testingRecommendations(facts));
  if (agent.key.includes("devops") || agent.key.includes("performance")) notes.push(...releaseNotes(facts));
  if (agent.key.includes("architect") || agent.key.includes("refactoring")) notes.push(...architectureDecisions(facts));
  if (agent.key.includes("backend") || agent.key.includes("frontend") || agent.key.includes("feature")) {
    notes.push(...facts.publicContracts.slice(0, 6).map((contract) => `${contract.kind} ${contract.name} is part of the public surface in ${contract.location}.`));
  }
  if (notes.length === 1 && facts.modules.length > 0) notes.push(`Start with modules: ${facts.modules.slice(0, 4).map((module) => module.path).join(", ")}.`);
  return notes;
}

function agentRelevantFiles(agent: AgentDefinition, facts: ProjectFacts): string[] {
  const files = new Set<string>();
  for (const doc of AGENT_TO_DOCS[agent.key] ?? ["project-overview", "architecture"]) files.add(`.context/docs/${docToFile(doc)}`);
  for (const module of facts.modules.slice(0, 6)) {
    const shouldInclude =
      agent.key.includes("documentation") ||
      (agent.key.includes("security") && /guardrails|prevc|context/i.test(module.path)) ||
      (agent.key.includes("devops") && (module.path === "project-root" || module.path === "themes")) ||
      (!agent.key.includes("security") && !agent.key.includes("devops"));
    if (!shouldInclude) continue;
    for (const file of module.files.slice(0, 3)) files.add(file);
  }
  return [...files];
}

function skillProjectNotes(skill: SkillDefinition, facts: ProjectFacts): string[] {
  const notes = [`Use this skill against a ${facts.projectType} codebase with ${facts.primaryLanguage} as the primary language.`];
  if (skill.key.includes("review")) notes.push(...reviewChecklist(facts));
  if (skill.key.includes("test")) notes.push(...testingRecommendations(facts));
  if (skill.key.includes("security")) notes.push(...securityReviewGates(facts));
  if (skill.key.includes("api")) notes.push(...facts.publicContracts.slice(0, 8).map((contract) => `${contract.kind} ${contract.name}: ${contract.detail}`));
  if (skill.key.includes("documentation")) notes.push("Update .context docs when commands, tools, workflows or guardrails change.");
  if (skill.key.includes("commit")) notes.push("Commit only in PREVC C/confirmation stage and avoid including unrelated user changes.");
  if (skill.key.includes("refactoring")) notes.push(...architectureDecisions(facts));
  if (skill.key.includes("feature")) notes.push(...facts.modules.slice(0, 5).map((module) => `Likely feature impact area: ${module.path} — ${module.role}`));
  return notes;
}

function skillRelevantDocs(skill: SkillDefinition): string[] {
  const docs = new Set<string>([".context/docs/project-overview.md", ".context/docs/development-workflow.md"]);
  for (const phase of skill.phases) {
    for (const doc of PHASE_TO_DOCS[phase] ?? []) docs.add(`.context/docs/${docToFile(doc)}`);
  }
  if (skill.key.includes("api")) docs.add(".context/docs/api.md");
  if (skill.key.includes("test")) docs.add(".context/docs/testing-strategy.md");
  if (skill.key.includes("security")) docs.add(".context/docs/security.md");
  return [...docs];
}

function installCommand(packageManager: string): string {
  if (packageManager === "pnpm") return "pnpm install";
  if (packageManager === "yarn") return "yarn install";
  if (packageManager === "bun") return "bun install";
  return "npm install";
}

function mdCode(value: string): string {
  return "`" + value.replace(/`/g, "\\`") + "`";
}

function buildCodebaseMap(facts: ProjectFacts): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    generator: "aicoders-context-extension",
    project: {
      name: facts.name,
      description: facts.description,
      type: facts.projectType,
      primaryLanguage: facts.primaryLanguage,
      packageManager: facts.packageManager,
      reasoning: facts.reasoning,
      keywords: facts.packageKeywords,
    },
    scripts: facts.scripts,
    dependencies: facts.dependencies,
    entryPoints: facts.entryPoints,
    piManifest: {
      extensions: facts.piExtensions,
      themes: facts.piThemes,
    },
    readme: {
      summary: facts.readmeSummary,
      headings: facts.readmeHeadings,
    },
    modules: facts.modules,
    publicContracts: facts.publicContracts,
    securitySignals: facts.securitySignals,
    dataSignals: facts.dataSignals,
    topLevelEntries: facts.topLevelEntries,
    sourceFiles: facts.sourceFiles,
    testFiles: facts.testFiles,
    documentationFiles: facts.documentationFiles,
    configFiles: facts.configFiles,
    files: facts.files,
  };
}

async function writeScaffoldFile(
  absolutePath: string,
  content: string,
  force: boolean,
  result: WriteResult,
  relativePath: string
): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const alreadyExists = await exists(absolutePath);

  if (alreadyExists && !force) {
    const current = await readTextIfExists(absolutePath);
    if (!current || !isGeneratedPlaceholder(current)) {
      result.skipped.push(relativePath);
      return;
    }
  }

  await fs.writeFile(absolutePath, content, "utf8");
  if (alreadyExists) result.overwritten.push(relativePath);
  else result.created.push(relativePath);
}

function isGeneratedPlaceholder(content: string): boolean {
  const generatedByContext = /AICoders Context extension|aicoders-context-extension|dotcontext-style agent playbooks|Task-specific skills/i.test(content);
  const scaffoldStatus = /^status:\s*scaffold\s*$/m.test(content);
  const placeholderText = /TODO:|Describe what this project is|Document the main modules|List user inputs|customize this skill|replace this scaffold/i.test(content);
  return generatedByContext || scaffoldStatus || placeholderText;
}

async function getContextStatus(cwd: string): Promise<{
  initialized: boolean;
  docs: string[];
  agents: string[];
  skills: string[];
  facts: ProjectFacts;
}> {
  const contextRoot = path.join(cwd, CONTEXT_DIR);
  const facts = await collectProjectFacts(cwd);

  if (!(await exists(contextRoot))) {
    return { initialized: false, docs: [], agents: [], skills: [], facts };
  }

  const docs = await listMarkdownFiles(path.join(contextRoot, "docs"));
  const agents = await listMarkdownFiles(path.join(contextRoot, "agents"));
  const skills = await listSkillFiles(path.join(contextRoot, "skills"));

  return { initialized: true, docs, agents, skills, facts };
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

async function listSkillFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${entry.name}/SKILL.md`)
      .sort();
  } catch {
    return [];
  }
}

function formatInitResult(result: WriteResult, force: boolean): string {
  const lines = [
    "AICoders Context inicializado com análise da codebase.",
    `Criados: ${result.created.length}`,
    `Atualizados: ${result.overwritten.length}${force ? "" : " (somente placeholders gerados; use --force para sobrescrever edições manuais)"}`,
    `Preservados: ${result.skipped.length}`,
    "",
    "Dica: execute /reload para o pi descobrir .context/skills como skills.",
  ];

  if (result.created.length > 0) lines.push(`Primeiros arquivos: ${result.created.slice(0, 5).join(", ")}`);
  return lines.join("\n");
}

function formatStatus(status: Awaited<ReturnType<typeof getContextStatus>>): string {
  if (!status.initialized) {
    return [
      "AICoders Context: .context ainda não existe.",
      `Projeto detectado: ${status.facts.projectType} (${status.facts.primaryLanguage})`,
      "Use /dotcontext init para criar docs, agents e skills.",
    ].join("\n");
  }

  return [
    "AICoders Context ativo.",
    `Projeto: ${status.facts.name}`,
    `Tipo: ${status.facts.projectType}`,
    `Docs: ${status.docs.length}`,
    `Agents: ${status.agents.length}`,
    `Skills: ${status.skills.length}`,
  ].join("\n");
}

function formatFeedPreview(feed: FeedForward): string {
  return [
    feed.initialized ? "Feedforward pronto." : "Feedforward sem .context inicializado.",
    `Fase: ${feed.selection.phase ?? "auto"}`,
    `Agentes: ${feed.selection.agents.join(", ") || "nenhum"}`,
    `Docs: ${feed.selection.docs.map((doc) => docToFile(doc)).join(", ") || "nenhum"}`,
    `Skills: ${feed.selection.skills.join(", ") || "nenhuma"}`,
    `Arquivos carregáveis: ${feed.files.length}`,
  ].join("\n");
}

function dotcontextHelp(): string {
  return [
    "AICoders Context commands:",
    "/dotcontext init        analisa a codebase e cria .context preenchido",
    "/dotcontext init --force regenera sobrescrevendo arquivos existentes",
    "/dotcontext status      mostra estado atual",
    "/dotcontext feed <task> simula seleção de feedforward",
  ].join("\n");
}

function projectFactsSummary(facts: ProjectFacts): string {
  return [
    `- **Project**: ${facts.name}`,
    `- **Type**: ${facts.projectType}`,
    `- **Primary language**: ${facts.primaryLanguage}`,
    `- **Package manager**: ${facts.packageManager}`,
    `- **Detection**: ${facts.reasoning.join("; ")}`,
  ].join("\n");
}

function formatScripts(scripts: Record<string, string>): string {
  const entries = Object.entries(scripts);
  if (entries.length === 0) return "No package scripts detected yet.";
  return entries.map(([name, command]) => `- ${mdCode(name)}: ${mdCode(command)}`).join("\n");
}

function filterScripts(scripts: Record<string, string>, pattern: RegExp): Record<string, string> {
  return Object.fromEntries(Object.entries(scripts).filter(([name, command]) => pattern.test(name) || pattern.test(command)));
}

function docToFile(doc: string): string {
  return DOCS.find((item) => item.key === doc)?.file ?? `${doc}.md`;
}

function limitKnown(items: string[], known: string[], max: number): string[] {
  const knownSet = new Set(known);
  const deduped = items.filter((item, index) => knownSet.has(item) && items.indexOf(item) === index);
  return deduped.slice(0, max);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > 512_000) return undefined;
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | undefined> {
  const content = await readTextIfExists(filePath);
  if (!content) return undefined;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readPackageBin(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([name, target]) => (typeof target === "string" ? [`${name} -> ${target}`] : []))
    .sort();
}

function readPackageExports(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const entries = Object.entries(value as Record<string, unknown>);
  return entries
    .flatMap(([name, target]) => {
      if (typeof target === "string") return [`${name} -> ${target}`];
      if (!target || typeof target !== "object" || Array.isArray(target)) return [];
      return Object.entries(target as Record<string, unknown>).flatMap(([condition, conditionalTarget]) =>
        typeof conditionalTarget === "string" ? [`${name} (${condition}) -> ${conditionalTarget}`] : []
      );
    })
    .sort();
}

function isSourceFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|rs|java|kt|swift)$/i.test(file) && !/\.d\.ts$/i.test(file);
}

function isTestFile(file: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)\//i.test(file) || /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file);
}

function isDocumentationFile(file: string): boolean {
  return /(^|\/)(README|CHANGELOG|CONTRIBUTING|LICENSE|SECURITY)(\.[^.]+)?$/i.test(file) || /\.(md|mdx|adoc|rst)$/i.test(file);
}

function isConfigFile(file: string): boolean {
  return /(^|\/)(package\.json|tsconfig\.[^/]+|tsconfig\.json|vite\.config\.[jt]s|next\.config\.[jt]s|tailwind\.config\.[jt]s|eslint\.config\.[jt]s|\.eslintrc|prettier\.config\.[jt]s|\.prettierrc|dockerfile|compose\.ya?ml|\.github\/workflows\/[^/]+\.ya?ml)$/i.test(file);
}

function resolveRegistrationName(raw: string | undefined, constants: Map<string, string>): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/,$/, "");
  const literal = trimmed.match(/^["'`]([^"'`]+)["'`]$/);
  if (literal) return literal[1];
  const identifier = trimmed.match(/^([A-Z][A-Z0-9_]*)$/);
  if (identifier) return constants.get(identifier[1]) ?? identifier[1];
  return undefined;
}

function extractDescription(content: string, startIndex: number): string | undefined {
  const window = content.slice(startIndex, startIndex + 900);
  const match = window.match(/description:\s*["'`]([^"'`]+)["'`]/);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function moduleKey(file: string): string | undefined {
  const segments = file.split("/");
  if (segments.length === 0) return undefined;
  if (segments[0] === "extensions" && segments[1]) return `extensions/${segments[1]}`;
  if (segments[0] === "themes") return "themes";
  if (segments[0] === ".github") return ".github";
  if (segments[0] === "docs") return "docs";
  if (["README.md", "THEME-AICODERS-CLAUDE.md", "package.json", "tsconfig.json"].includes(file)) return "project-root";
  return segments[0] && !segments[0].startsWith(".") ? segments[0] : undefined;
}

function inferModuleRole(modulePath: string, contracts: PublicContract[], files: string[]): string {
  const commandNames = contracts.filter((contract) => contract.kind === "slash command").map((contract) => contract.name);
  const toolNames = contracts.filter((contract) => contract.kind === "LLM tool").map((contract) => contract.name);

  if (modulePath === "extensions/context" || commandNames.includes("/dotcontext")) {
    return "AICoders Context/dotcontext extension: analyzes the repository, generates .context knowledge files and injects selected feedforward context.";
  }
  if (modulePath === "extensions/guardrails" || commandNames.includes("/guardrails")) {
    return "Guardrails extension: blocks or confirms sensitive file, shell, git and package operations.";
  }
  if (modulePath === "extensions/prevc" || commandNames.includes("/prevc") || toolNames.includes("prevc_workflow")) {
    return "PREVC workflow extension: manages plan/review/execute/validate/confirm state, tools, events and git confirmation.";
  }
  if (modulePath === "themes") return "Theme assets discoverable by pi for the terminal UI.";
  if (modulePath === "project-root") return "Package metadata, README and top-level documentation for installing and loading the pi package.";
  if (modulePath === ".github") return "Repository automation and CI/CD configuration.";
  if (files.some(isSourceFile)) return "Source module inferred from repository layout.";
  if (files.some(isDocumentationFile)) return "Documentation module inferred from markdown/doc files.";
  return "Repository module inferred from file layout.";
}

function scoreModule(module: ModuleInsight, entryPoints: string[]): number {
  let score = module.files.length;
  if (entryPoints.some((entry) => entry === module.path || entry.startsWith(`${module.path}/`))) score += 100;
  if (module.highlights.some((highlight) => highlight.includes("contracts:"))) score += 50;
  if (module.path === "project-root") score += 25;
  return score;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function truncate(content: string, maxChars: number): { text: string; truncated: boolean } {
  if (content.length <= maxChars) return { text: content, truncated: false };
  const suffix = `\n\n[Truncated by AICoders Context: ${content.length - maxChars} chars omitted]`;
  return { text: content.slice(0, Math.max(0, maxChars - suffix.length)) + suffix, truncated: true };
}

function parseArgs(args: string): string[] {
  return args.trim().split(/\s+/).filter(Boolean);
}
