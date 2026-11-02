import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
//#region src/core/guidance.ts
/**
* Model-facing copy for dsh-project-memory: the announcement, the turn-end
* auto-maintain steering prompt, and the runtime-skill metadata.
*/
/** Model-facing announcement: the project default memory workflow. */
const GUIDANCE = "本机已安装 dsh-project-memory 插件（项目记忆，开关开启中）：本项目默认使用 project-memory 记忆模板做记忆并分类——项目根 MEMORY.md 是 Wiki 索引（项目概况/索引表/最近摘要，恒 ≤10K），memory/YYYY-MM-DD.md 是每日详情（背景/改动/结论/关联），会话开始时已按模板自动初始化。工作流：开始任务前先读项目根 MEMORY.md 了解背景与最近进展（省 token：只读索引和摘要）；任务结束后按模板写/更新 memory/YYYY-MM-DD.md（当天多次任务合并到一个文件、分节记录），并更新 MEMORY.md 索引表（#标签 关键词分类、日期倒序只加不删、最近摘要最多 3 条，超了压缩最旧条目）。用户提到「项目记忆 / 记忆模板 / 更新 MEMORY.md / 写每日记忆 / 初始化记忆 / 人眼查看项目记忆」时按此执行；插件开关关闭时，仅在用户明确要求时才使用记忆模板。";
/** Turn-end auto-maintain steering prompt (kept stable across versions). */
const MAINTAIN_PROMPT = "（dsh-project-memory 自动收尾）本轮工作已结束，请把本轮沉淀进本项目的人读版记忆：\n1. 若本轮有实质产出、踩坑结论或下一步安排：在 memory/YYYY-MM-DD.md 追加/创建本轮的「背景 / 改动 / 结论 / 关联」小节（当天合并到同一文件、分节记录），并更新 MEMORY.md 索引表（日期倒序加一行、只加不删，关键词用 #标签 分类）与最近记录摘要（最多 3 条）；\n2. 若本轮已写过记忆、或没有值得沉淀的内容，直接回复「本轮无需沉淀」，不要调用任何工具。\n最终回复保持一句话以内，不要展开。";
/** 轮末结构变化提醒的开头：只在结构指纹 diff 时发出，常态零 token。 */
const INDEX_DRIFT_PROMPT_PREFIX = "（dsh-project-memory 索引漂移）检测到工作区结构变化：";
/** Runtime-skill description shown in the skill catalog. */
const SKILL_DESCRIPTION = "人读版项目记忆体系（手工 MEMORY.md 主索引 + memory/YYYY-MM-DD.md 每日详情），由 dsh-project-memory 插件自动初始化并维护。当用户要求\"使用记忆模板 / 创建项目记忆 / 初始化记忆 / 维护记忆 / 更新 MEMORY.md / 写每日记忆 / 人眼查看项目记忆\"或提到 F:\\xiangmu\\infra\\templates\\memory-template 时，先加载本技能再行动。";
/** Runtime-skill whenToUse guidance. */
const SKILL_WHEN_TO_USE = "用户要求为任意项目建立或维护人读版记忆体系（MEMORY.md + memory/），或要求记忆可被肉眼查看/提交 git 时。";
//#endregion
//#region src/core/home.ts
/**
* DSH home resolution shared by the config store and the skill/template
* lookup. The harness convention is `${DSH_HOME:-$HOME/.dsh}` — DSH_HOME
* already IS the `.dsh` directory, so callers join directly against it
* (`<home>/dsh-project-memory.json`, `<home>/skills/project-memory`, ...).
*/
/** Resolve the dsh home directory: $DSH_HOME when set, else ~/.dsh. */
function dshHome() {
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
//#endregion
//#region src/core/indexes.ts
/**
* 三棵树索引生成器：NAVIGATION.md（空间轴）/ SKILLS.md（能力轴）/ TOOLS.md（环境轴）。
*
* 设计约束：
* - 只依赖 node 内置模块，不引入第三方依赖（可在无 node_modules 的环境直接跑）。
* - 每个索引文件由「AUTO 段（可重生成）+ 手写段（永不覆盖）」组成，AUTO 段用注释标记包起来。
* - 先算指纹，指纹没变就不写盘、不打扰模型 —— 这是「自发更新不烧 token」的关键。
* - 工具清单是机器级缓存（<dsh home>/env/tools.json），项目内 TOOLS.md 只放指针与摘要。
*/
const AUTO_BEGIN = "<!-- AUTO:BEGIN 由 dsh-project-memory 自动生成；手写内容请放在 AUTO:END 之后 -->";
const AUTO_END = "<!-- AUTO:END -->";
/** 索引文件本身：生成它们会改变根目录文件列表，必须排除在指纹之外（否则每次刷新都自触发）。 */
const INDEX_FILES = /* @__PURE__ */ new Set([
	"NAVIGATION.md",
	"SKILLS.md",
	"TOOLS.md"
]);
/** 生成索引时跳过的重目录（可重建产物 / 依赖 / 版本库内部）。 */
const SKIP_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"build",
	"dist",
	"target",
	".gradle",
	"__pycache__",
	".dart_tool",
	".cxx",
	"obj",
	".next",
	".venv",
	".idea",
	".vscode",
	".pnpm-store",
	"bin",
	"lib"
]);
function sha1(text) {
	return createHash("sha1").update(text).digest("hex").slice(0, 16);
}
function safeReaddir(path) {
	try {
		return readdirSync(path).sort();
	} catch {
		return [];
	}
}
function isDir(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
function statePath(home) {
	return join(home, "dsh-project-memory.indexes.json");
}
function loadState(home) {
	try {
		const raw = JSON.parse(readFileSync(statePath(home), "utf8"));
		return {
			fingerprints: typeof raw.fingerprints === "object" && raw.fingerprints !== null ? raw.fingerprints : {},
			toolsProbedAt: typeof raw.toolsProbedAt === "number" ? raw.toolsProbedAt : 0
		};
	} catch {
		return {
			fingerprints: {},
			toolsProbedAt: 0
		};
	}
}
function saveState(home, state) {
	try {
		mkdirSync(home, { recursive: true });
		writeFileSync(statePath(home), JSON.stringify(state, null, 2), "utf8");
	} catch {}
}
/** 把内容写进文件的 AUTO 段；手写段保持原样。 */
function writeAutoSection(file, title, autoBody) {
	const block = "<!-- AUTO:BEGIN 由 dsh-project-memory 自动生成；手写内容请放在 AUTO:END 之后 -->\n" + autoBody.trimEnd() + "\n<!-- AUTO:END -->";
	const existing = existsSync(file) ? readFileSync(file, "utf8") : void 0;
	if (existing === void 0) {
		writeFileSync(file, title + "\n\n" + block + "\n\n## 手写区（插件永不覆盖）\n\n- （在这里补充本项目特有的说明）\n", "utf8");
		return true;
	}
	const begin = existing.indexOf(AUTO_BEGIN);
	const end = existing.indexOf(AUTO_END);
	let next;
	if (begin >= 0 && end > begin) next = existing.slice(0, begin) + block + existing.slice(end + 17);
	else next = existing.trimEnd() + "\n\n" + block + "\n";
	if (next === existing) return false;
	writeFileSync(file, next, "utf8");
	return true;
}
/** 只读一层：顶层目录 + 每个顶层目录的直接子目录名（不递归，避免百万文件级扫描）。 */
function navSnapshot(cwd, opts = {}) {
	const limit = opts.subdirsPerDir ?? 12;
	const maxTop = opts.maxTopDirs ?? 80;
	const entries = safeReaddir(cwd);
	const topDirs = [];
	const files = [];
	for (const name of entries) {
		if (name.startsWith(".")) continue;
		const full = join(cwd, name);
		if (isDir(full)) {
			const subs = safeReaddir(full).filter((s) => !s.startsWith("."));
			topDirs.push({
				name,
				subdirs: subs.slice(0, limit),
				subdirCount: subs.length
			});
		} else if (!INDEX_FILES.has(name)) files.push(name);
	}
	const shown = topDirs.slice(0, maxTop);
	return {
		fingerprint: sha1(shown.map((d) => d.name + ":" + d.subdirs.join(",")).join("|") + "#" + files.sort().join(",")),
		topDirs: shown,
		files: files.sort()
	};
}
function renderNavigation(cwd, snap) {
	const lines = [];
	lines.push("## 目录树（实测快照 " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "）");
	lines.push("");
	lines.push("项目根：`" + cwd + "`");
	lines.push("");
	if (snap.topDirs.length === 0) lines.push("- （空目录）");
	for (const dir of snap.topDirs) {
		const subs = dir.subdirs.length === 0 ? "" : "  →  " + dir.subdirs.join(" · ") + (dir.subdirCount > dir.subdirs.length ? " …共 " + dir.subdirCount + " 项" : "");
		lines.push("- `" + dir.name + "/`" + subs);
	}
	if (snap.files.length > 0) {
		lines.push("");
		lines.push("根文件：" + snap.files.map((f) => "`" + f + "`").join(" · "));
	}
	lines.push("");
	lines.push("> 找东西顺序：本文件定位表 → 目标目录的 MEMORY.md → 该目录内的细节文件。");
	return lines.join("\n");
}
function buildNavigation(cwd, opts = {}) {
	const target = resolve(cwd);
	const snap = navSnapshot(target, opts);
	const file = join(target, "NAVIGATION.md");
	return {
		kind: "navigation",
		path: file,
		changed: writeAutoSection(file, "# NAVIGATION.md — " + basename(target) + " 目录导航树", renderNavigation(target, snap)),
		summary: "NAVIGATION.md（" + snap.topDirs.length + " 个顶层目录）"
	};
}
function frontmatterField(text, field) {
	const match = text.match(new RegExp("^" + field + ":\\s*(.+)$", "m"));
	return match === null ? "" : match[1].trim().replace(/^["']|["']$/g, "");
}
function scanSkillRoot(root, status) {
	const out = [];
	for (const name of safeReaddir(root)) {
		const dir = join(root, name);
		if (!isDir(dir)) continue;
		const skillFile = join(dir, "SKILL.md");
		if (!existsSync(skillFile)) continue;
		let text = "";
		try {
			text = readFileSync(skillFile, "utf8").slice(0, 4e3);
		} catch {
			text = "";
		}
		const description = frontmatterField(text, "description") || frontmatterField(text, "whenToUse");
		out.push({
			name,
			description: description.slice(0, 120),
			status,
			path: dir
		});
	}
	return out;
}
/**
* 发现项目内（含子目录）的 .dsh/skills 根，最多下探 depth 层。
* 目的：把散在各子项目里的技能库（例如 <cwd>/DSH/破译/.dsh/skills）也纳入清单，
* 同时明确标注它们「未注册、不能 skill() 加载」。
*/
function findNestedSkillRoots(cwd, depth = 3) {
	const roots = [];
	const walk = (dir, level) => {
		if (level > depth) return;
		for (const name of safeReaddir(dir)) {
			if (name.startsWith(".") && name !== ".dsh") continue;
			if (SKIP_DIRS.has(name)) continue;
			const full = join(dir, name);
			if (!isDir(full)) continue;
			if (name === ".dsh") {
				const skills = join(full, "skills");
				if (isDir(skills)) roots.push(skills);
				continue;
			}
			walk(full, level + 1);
		}
	};
	walk(resolve(cwd), 1);
	return roots;
}
function collectSkills(cwd, opts = {}) {
	const home = opts.home ?? dshHome();
	const seen = /* @__PURE__ */ new Set();
	const all = [];
	const ownRoot = join(resolve(cwd), ".dsh", "skills");
	const roots = [[join(home, "skills"), "registered"]];
	if (isDir(ownRoot)) roots.push([ownRoot, "project"]);
	for (const nested of findNestedSkillRoots(cwd)) if (nested !== ownRoot) roots.push([nested, "library"]);
	for (const extra of opts.skillRoots ?? []) roots.push([extra, "library"]);
	for (const [root, status] of roots) for (const entry of scanSkillRoot(root, status)) {
		if (seen.has(entry.name)) continue;
		seen.add(entry.name);
		all.push(entry);
	}
	return all.sort((a, b) => a.name.localeCompare(b.name));
}
function renderSkills(entries) {
	const registered = entries.filter((e) => e.status === "registered");
	const project = entries.filter((e) => e.status === "project");
	const library = entries.filter((e) => e.status === "library");
	const lines = [];
	lines.push("## 技能清单（实测快照 " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "）");
	lines.push("");
	lines.push("| 档位 | 数量 | 能否 skill() 加载 |");
	lines.push("|---|---:|---|");
	lines.push("| 已注册（本会话可用） | " + registered.length + " | ✅ 能 |");
	lines.push("| 项目 .dsh/skills（未注册） | " + project.length + " | ❌ 只能当文本读 |");
	lines.push("| 其他库根（未注册） | " + library.length + " | ❌ 只能当文本读 |");
	lines.push("");
	const table = (title, list, note, compact = false) => {
		if (list.length === 0) return;
		lines.push("### " + title + "（" + list.length + "）");
		lines.push("");
		lines.push(note);
		lines.push("");
		if (compact && list.length > 30) {
			for (let i = 0; i < list.length; i += 8) lines.push("- " + list.slice(i, i + 8).map((entry) => "`" + entry.name + "`").join(" · "));
			lines.push("");
			return;
		}
		for (const entry of list) lines.push("- `" + entry.name + "` — " + (entry.description === "" ? "（无描述）" : entry.description));
		lines.push("");
	};
	table("已注册 · 可直接 skill() 加载", registered, "直接调用 `skill({ name })`。");
	table("项目级 · 未注册", project, "要真正可用需注册到 dsh home 的 skills 目录；否则只能按路径读 SKILL.md。");
	table("其他技能库", library, "库资产，非本会话能力；需要用时先注册或按路径读 SKILL.md。", true);
	return lines.join("\n");
}
function buildSkills(cwd, opts = {}) {
	const target = resolve(cwd);
	const entries = collectSkills(target, opts);
	const file = join(target, "SKILLS.md");
	return {
		kind: "skills",
		path: file,
		changed: writeAutoSection(file, "# SKILLS.md — " + basename(target) + " 技能清单", renderSkills(entries)),
		summary: "SKILLS.md（可加载 " + entries.filter((e) => e.status === "registered").length + " / 库 " + entries.length + "）"
	};
}
const TOOL_CANDIDATES = [
	"java",
	"javac",
	"node",
	"npm",
	"pnpm",
	"python",
	"pip",
	"go",
	"git",
	"adb",
	"gradle",
	"ffmpeg",
	"dotnet",
	"flutter",
	"dart",
	"docker",
	"jadx",
	"frida",
	"apktool",
	"7z",
	"rg",
	"pwsh",
	"code",
	"wsl",
	"nvidia-smi",
	"curl",
	"gh",
	"winget"
];
const VERSION_ARGS = {
	java: ["-version"],
	node: ["-v"],
	python: ["--version"],
	go: ["version"],
	git: ["--version"],
	ffmpeg: ["-version"],
	dotnet: ["--version"],
	adb: ["version"],
	docker: ["--version"]
};
function runVersion(name, exe) {
	const args = VERSION_ARGS[name];
	if (args === void 0) return "";
	try {
		const out = execFileSync(exe, args, {
			encoding: "utf8",
			timeout: 8e3,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const line = String(out).split("\n")[0].trim().slice(0, 60);
		return /[0-9]/.test(line) ? line : "";
	} catch (error) {
		const stderr = error.stderr;
		return typeof stderr === "string" && stderr !== "" ? stderr.split("\n")[0].trim().slice(0, 60) : "";
	}
}
/** PATH 探测：where.exe（Windows）/ which。 */
function whichAll(names) {
	const found = {};
	const isWindows = process.platform === "win32";
	for (const name of names) try {
		const out = execFileSync(isWindows ? "where.exe" : "which", [name], {
			encoding: "utf8",
			timeout: 5e3,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		});
		const first = String(out).split("\n")[0].trim();
		if (first !== "") found[name] = first;
	} catch {}
	return found;
}
function envTools() {
	const out = {};
	for (const [env, name] of [
		["JAVA_HOME", "java"],
		["ANDROID_HOME", "adb"],
		["ANDROID_SDK_ROOT", "adb"],
		["GOPATH", "go"],
		["FLUTTER_HOME", "flutter"]
	]) {
		const value = process.env[env];
		if (typeof value !== "string" || value === "" || out[name] !== void 0) continue;
		out[name] = value;
	}
	return out;
}
/** 机器级工具缓存：<home>/env/tools.json，带 TTL。 */
function probeTools(home = dshHome(), ttlHours = 24, force = false) {
	const file = join(home, "env", "tools.json");
	const state = loadState(home);
	const ageMs = Date.now() - state.toolsProbedAt;
	if (!force && existsSync(file) && ageMs < ttlHours * 3600 * 1e3) try {
		const cached = JSON.parse(readFileSync(file, "utf8"));
		if (Array.isArray(cached.tools)) return {
			file,
			tools: cached.tools,
			probedAt: cached.probedAt ?? state.toolsProbedAt,
			fresh: false
		};
	} catch {}
	const onPath = whichAll(TOOL_CANDIDATES);
	const fromEnv = envTools();
	const tools = [];
	for (const name of TOOL_CANDIDATES) {
		const exe = onPath[name];
		if (exe !== void 0) {
			tools.push({
				name,
				path: exe,
				version: runVersion(name, exe),
				how: "how"
			});
			continue;
		}
		const envPath = fromEnv[name];
		if (envPath !== void 0) tools.push({
			name,
			path: envPath,
			version: "",
			how: "env"
		});
	}
	const probedAt = Date.now();
	try {
		mkdirSync(join(home, "env"), { recursive: true });
		writeFileSync(file, JSON.stringify({
			probedAt,
			platform: process.platform,
			tools
		}, null, 2), "utf8");
	} catch {}
	state.toolsProbedAt = probedAt;
	saveState(home, state);
	return {
		file,
		tools,
		probedAt,
		fresh: true
	};
}
function renderTools(tools, cacheFile, missing) {
	const lines = [];
	lines.push("## 工具清单（机器级缓存 " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "）");
	lines.push("");
	lines.push("缓存文件：`" + cacheFile + "`（全项目共享，TTL 过期才重探）");
	lines.push("");
	lines.push("| 工具 | 版本 | 绝对路径 | 调用方式 |");
	lines.push("|---|---|---|---|");
	for (const tool of tools) {
		const howLabel = tool.how === "how" ? "PATH" : tool.how === "env" ? "ENV" : "FULL";
		lines.push("| `" + tool.name + "` | " + (tool.version === "" ? "—" : tool.version) + " | `" + tool.path + "` | " + howLabel + " |");
	}
	if (missing.length > 0) {
		lines.push("");
		lines.push("**未找到（本身是结论，避免重复搜索）**：" + missing.map((m) => "`" + m + "`").join(" · "));
	}
	lines.push("");
	lines.push("> 调用方式：PATH = 直接敲命令；ENV = 需经环境变量（JAVA_HOME 等）定位。");
	return lines.join("\n");
}
function buildTools(cwd, opts = {}) {
	const probe = probeTools(opts.home ?? dshHome(), opts.toolsTtlHours ?? 24);
	const missing = TOOL_CANDIDATES.filter((name) => !probe.tools.some((tool) => tool.name === name));
	const file = join(resolve(cwd), "TOOLS.md");
	return {
		kind: "tools",
		path: file,
		changed: writeAutoSection(file, "# TOOLS.md — " + basename(resolve(cwd)) + " 工具与环境清单", renderTools(probe.tools, probe.file, missing)),
		summary: "TOOLS.md（" + probe.tools.length + " 个可用 / " + missing.length + " 个未找到）"
	};
}
/** 结构指纹：目录树 + 技能数量。用于「只在变化时才提醒模型」。 */
function structureFingerprint(cwd, opts = {}) {
	const target = resolve(cwd);
	const nav = navSnapshot(target, opts);
	const skills = collectSkills(target, opts);
	return {
		navigation: nav.fingerprint,
		skills: sha1(skills.map((s) => s.name + ":" + s.status).join(","))
	};
}
/** 是否与上次记录的结构指纹不同（不写盘，纯比较）。 */
function structureChanged(cwd, opts = {}) {
	const home = opts.home ?? dshHome();
	const target = resolve(cwd);
	const prev = loadState(home).fingerprints[target] ?? {};
	const now = structureFingerprint(target, opts);
	const changed = [];
	for (const [kind, value] of Object.entries(now)) if (prev[kind] !== value) changed.push(kind);
	return changed;
}
/**
* 刷新三棵树索引。默认只重建指纹已变化的文件（force 时全部重建）。
* 返回结果里 changed=false 表示「没变化、没写盘」。
*/
function refreshIndexes(cwd, opts = {}, force = false) {
	const home = opts.home ?? dshHome();
	const target = resolve(cwd);
	const state = loadState(home);
	const before = structureFingerprint(target, opts);
	const prev = state.fingerprints[target] ?? {};
	const results = [];
	const wanted = [];
	const files = {
		navigation: join(target, "NAVIGATION.md"),
		skills: join(target, "SKILLS.md")
	};
	for (const kind of ["navigation", "skills"]) if (force || prev[kind] !== before[kind] || needsBuild(files[kind])) wanted.push(kind);
	if (wanted.includes("navigation")) results.push(buildNavigation(target, opts));
	if (wanted.includes("skills")) results.push(buildSkills(target, opts));
	const toolsResult = buildTools(target, opts);
	if (toolsResult.changed || force) results.push(toolsResult);
	const latest = loadState(home);
	latest.fingerprints[target] = before;
	saveState(home, latest);
	return results;
}
/** 索引文件缺失、或 AUTO 段是空的（文件被删/被重写）→ 必须重建。 */
function needsBuild(file) {
	if (!existsSync(file)) return true;
	try {
		const text = readFileSync(file, "utf8");
		const begin = text.indexOf(AUTO_BEGIN);
		const end = text.indexOf(AUTO_END);
		if (begin < 0 || end <= begin) return true;
		return text.slice(begin + 65, end).trim() === "";
	} catch {
		return true;
	}
}
/** 一行 system prompt 摘要（≤160 字符）。 */
function indexHint(cwd) {
	const target = resolve(cwd);
	const parts = [];
	if (existsSync(join(target, "NAVIGATION.md"))) parts.push("NAVIGATION.md 目录树");
	if (existsSync(join(target, "SKILLS.md"))) parts.push("SKILLS.md 技能清单");
	if (existsSync(join(target, "TOOLS.md"))) parts.push("TOOLS.md 工具清单");
	if (parts.length === 0) return "";
	return "本工作区已有索引：" + parts.join(" · ") + "。找东西先看 NAVIGATION.md；不要为此扫全盘。";
}
//#endregion
//#region src/core/contract.ts
/** Defaults applied when a config document (file or request) omits a field. */
const DEFAULT_CONFIG = {
	enabled: true,
	autoInit: true,
	autoMaintain: true,
	announceToAgent: true,
	autoCompress: true,
	compressInterval: 5,
	sessions: {},
	counts: {},
	workflow: {
		enabled: true,
		autoScaffold: true,
		turnCheck: true,
		boardInject: true
	},
	indexes: {
		enabled: true,
		autoRefresh: true,
		turnCheck: true,
		toolsTtlHours: 24
	}
};
/** Defaults for the index sub-switches (used by the normalizer). */
const DEFAULT_INDEXES = {
	enabled: true,
	autoRefresh: true,
	turnCheck: true,
	toolsTtlHours: 24
};
/** Defaults for the workflow sub-switches (used by the normalizer). */
const DEFAULT_WORKFLOW = {
	enabled: true,
	autoScaffold: true,
	turnCheck: true,
	boardInject: true
};
/** Config file name under ~/.dsh/. */
const CONFIG_FILE_NAME = "dsh-project-memory.json";
/** The session-scope "off" note when the per-session switch disables the workflow. */
const WORKFLOW_OFF_GUIDANCE = "（dsh-agent-workflow）本会话的工作流开关已关闭：不自动铺 AGENT_WORKFLOW.md / STATUS.md / _work/，也不做每轮自检；仅在用户明确要求时才使用工作流规范。";
/** The session-scope "off" note when the per-session switch disables memory. */
const MEMORY_OFF_GUIDANCE = "（dsh-project-memory）本会话的项目记忆开关已关闭：不自动初始化/维护 MEMORY.md 与 memory/，仅在用户明确要求时才使用记忆模板。";
//#endregion
//#region src/core/workflow.ts
/**
* Agent-workflow automation (policy file + board + per-task scratch spaces).
*
* Pure node, no harness services, so it is unit-testable: asset resolution,
* idempotent per-project scaffolding, board summary extraction and the
* per-turn checks used by the host half of the plugin.
*/
/** Runtime-skill name registered by the plugin. */
const WORKFLOW_SKILL_NAME = "agent-workflow";
/** In-repo policy file (the WORKFLOW.md analogue). */
const POLICY_FILE = "AGENT_WORKFLOW.md";
/** In-repo status board. */
const BOARD_FILE = "STATUS.md";
/** Per-task scratch root. */
const WORK_ROOT = "_work";
/**
* Resolve the bundled workflow assets for one module URL.
*
* The module is bundled into lib/index.js, where "../assets/workflow/"
* resolves to the package root; running from src/ (dev + tests) needs
* "../../assets/workflow/". Probe both so the same code is correct in either
* layout - a wrong guess here used to be fatal, because it threw at plugin
* mount time and the loader aborted the whole profile.
*/
function workflowAssetsRootFor(moduleUrl) {
	const candidates = [new URL("../assets/workflow/", moduleUrl), new URL("../../assets/workflow/", moduleUrl)];
	for (const url of candidates) {
		const dir = fileURLToPath(url);
		if (existsSync(join(dir, "SKILL.md"))) return dir;
	}
	return fileURLToPath(candidates[0]);
}
/** Absolute path of the bundled workflow assets (SKILL.md + templates + checks). */
function packageWorkflowAssetsRoot() {
	return workflowAssetsRootFor(import.meta.url);
}
/** Default user skill root: ~/.dsh/skills/agent-workflow. */
function defaultWorkflowSkillDir(home = dshHome()) {
	return join(home, "skills", WORKFLOW_SKILL_NAME);
}
/** Resolve the workflow skill root: the user skill dir when present, else bundled assets. */
function resolveWorkflowSkillDir(home = dshHome()) {
	const user = defaultWorkflowSkillDir(home);
	return existsSync(join(user, "SKILL.md")) ? user : packageWorkflowAssetsRoot();
}
/** Resolve the workflow templates directory: the user skill's, else bundled. */
function resolveWorkflowTemplateDir(home = dshHome()) {
	const user = defaultWorkflowSkillDir(home);
	if (existsSync(join(user, "templates", "AGENT_WORKFLOW.md"))) return join(user, "templates");
	return join(packageWorkflowAssetsRoot(), "templates");
}
/** Load the workflow skill body: the user skill's SKILL.md, else the bundled copy. */
function loadWorkflowSkillContent(home = dshHome()) {
	const candidate = join(defaultWorkflowSkillDir(home), "SKILL.md");
	return existsSync(candidate) ? readFileSync(candidate, "utf8") : readFileSync(join(packageWorkflowAssetsRoot(), "SKILL.md"), "utf8");
}
/** Helper scripts copied into _work/. */
const WORK_SCRIPTS = [
	"new-task.sh",
	"log.sh",
	"sanitize-env.sh"
];
/** Check scripts copied into _work/checks/. */
const WORK_CHECKS = [
	"check-evidence.sh",
	"check-status.sh",
	"check-tempfiles.sh"
];
function copyIfMissing(src, dst, created) {
	if (!existsSync(src) || existsSync(dst)) return;
	mkdirSync(dirname(dst), { recursive: true });
	copyFileSync(src, dst);
	created.push(dst);
	try {
		chmodSync(dst, 493);
	} catch {}
}
/**
* Idempotent per-project workflow scaffold: AGENT_WORKFLOW.md + STATUS.md +
* _work/ (README, _template/**, helper scripts, checks). Never overwrites.
* @returns the created paths (empty when nothing was created).
*/
function ensureWorkflowInit(cwd, templateDir) {
	const created = [];
	if (typeof cwd !== "string" || cwd === "") return created;
	const target = resolve(cwd);
	try {
		if (!existsSync(target) || !statSync(target).isDirectory()) return created;
	} catch {
		return created;
	}
	try {
		copyIfMissing(join(templateDir, POLICY_FILE), join(target, POLICY_FILE), created);
		copyIfMissing(join(templateDir, BOARD_FILE), join(target, BOARD_FILE), created);
		const work = join(target, WORK_ROOT);
		mkdirSync(work, { recursive: true });
		copyIfMissing(join(templateDir, WORK_ROOT, "README.md"), join(work, "README.md"), created);
		const tplDir = join(templateDir, WORK_ROOT, "_template");
		if (existsSync(tplDir)) {
			const rels = [
				"README.md",
				"notes.md",
				"run.log",
				join("evidence", "README.md")
			];
			for (const rel of rels) copyIfMissing(join(tplDir, rel), join(work, "_template", rel), created);
		}
		for (const name of WORK_SCRIPTS) copyIfMissing(join(templateDir, WORK_ROOT, name), join(work, name), created);
		for (const name of WORK_CHECKS) copyIfMissing(join(templateDir, WORK_ROOT, "checks", name), join(work, "checks", name), created);
	} catch {
		return created;
	}
	return created;
}
/** Parse the markdown table rows of STATUS.md (header/separator skipped). */
function parseBoard(text) {
	const rows = [];
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("|")) continue;
		const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
		if (cells.length < 4) continue;
		if (/^-{2,}$/.test(cells[0] ?? "")) continue;
		if (cells[0] === "任务 id" || cells[0] === "时间" || cells[0] === "资产") continue;
		rows.push({ cells });
	}
	return rows;
}
/** Task rows (first cell looks like a task id or a date) that are not finished. */
function unfinishedRows(text) {
	return parseBoard(text).filter((row) => {
		const id = row.cells[0] ?? "";
		if (!/^(\d{8}|\d{4}-\d{2}-\d{2})/.test(id)) return false;
		const status = row.cells[2] ?? "";
		return !/完成|中止|取消|done/i.test(status);
	});
}
/** Compact board summary for prompt injection (undefined when nothing to show). */
function readBoardSummary(cwd, maxLines = 10) {
	try {
		const board = join(resolve(cwd), BOARD_FILE);
		if (!existsSync(board)) return void 0;
		const rows = unfinishedRows(readFileSync(board, "utf8"));
		if (rows.length === 0) return void 0;
		return rows.slice(0, maxLines).map((row) => {
			const cells = row.cells;
			const id = cells[0] ?? "";
			const title = cells[1] ?? "";
			const status = cells[2] ?? "";
			const next = cells[3] ?? "";
			const evidence = cells[4] ?? "";
			const need = cells[5] ?? "";
			const bits = [
				"-",
				id,
				title.slice(0, 40),
				"[" + status + "]"
			];
			if (next !== "") bits.push("下一步=" + next.slice(0, 40));
			if (evidence !== "") bits.push("证据=" + evidence.slice(0, 40));
			if (need !== "" && need !== "无") bits.push("待用户=" + need.slice(0, 40));
			return bits.join(" ");
		}).join("\n");
	} catch {
		return;
	}
}
const TEMP_NAME = /^(_[A-Za-z0-9_-]+\.(png|jpg|jpeg|tmp)|nul|NUL|\.tmp)$/;
/** Cheap, read-only per-turn checks over the project workflow state. */
function checkWorkflow(cwd) {
	const findings = [];
	const target = resolve(cwd);
	try {
		const policyExists = existsSync(join(target, POLICY_FILE));
		const boardPath = join(target, BOARD_FILE);
		const boardExists = existsSync(boardPath);
		const work = join(target, WORK_ROOT);
		if (policyExists && !boardExists) findings.push({
			kind: "board-missing",
			detail: "STATUS.md 缺失（AGENT_WORKFLOW.md 已在）"
		});
		if (policyExists) {
			const missing = [];
			const required = [
				"README.md",
				join("_template", "README.md"),
				...WORK_SCRIPTS
			];
			for (const rel of required) if (!existsSync(join(work, rel))) missing.push(rel);
			if (missing.length > 0) findings.push({
				kind: "scaffold-incomplete",
				detail: "_work/ 缺: " + missing.join(", ")
			});
		}
		if (boardExists) {
			const text = readFileSync(boardPath, "utf8");
			for (const row of unfinishedRows(text)) {
				const cells = row.cells;
				const id = cells[0] ?? "";
				const status = cells[2] ?? "";
				const need = cells[5] ?? "";
				if (/阻塞/.test(status) && (need === "" || need === "无")) findings.push({
					kind: "blocked-without-reason",
					detail: id + " 标记阻塞但未写「需要用户决定」"
				});
				const taskDir = join(work, id);
				if (existsSync(taskDir)) {
					let files = 0;
					try {
						files = readdirSync(join(taskDir, "evidence")).filter((name) => name !== "README.md").length;
					} catch {}
					if (files === 0) findings.push({
						kind: "task-without-evidence",
						detail: id + " 无证据文件（_work/" + id + "/evidence/）"
					});
				}
			}
		}
		const strays = [];
		try {
			for (const name of readdirSync(target)) if (TEMP_NAME.test(name)) strays.push(name);
		} catch {}
		if (strays.length > 0) findings.push({
			kind: "stray-temp-files",
			detail: "项目根散落临时文件: " + strays.slice(0, 5).join(", ")
		});
	} catch {
		return findings;
	}
	return findings;
}
//#endregion
//#region src/core/workflow-guidance.ts
/**
* Model-facing copy for the agent-workflow surface (policy file + board +
* per-task scratch spaces). Mirrors core/guidance.ts of the memory half.
*/
/** Session-start announcement for the workflow surface. */
const WORKFLOW_GUIDANCE = "本机已安装 dsh-agent-workflow（工作流规范，开关开启中）：本项目使用 AGENT_WORKFLOW.md（策略：并发上限 / 任务隔离 / 开工与收尾钩子 / 证据门槛 / 凭据与危险动作边界）、STATUS.md（状态看板：进行中 / 阻塞 / 完成 + 证据指针 + 需要用户决定的事项）与 _work/<YYYYMMDD-短名>/（每任务隔离目录：notes.md、run.log、evidence/、backup/）。工作流：开工前先读 AGENT_WORKFLOW.md 与 STATUS.md，建立/进入任务目录（bash _work/new-task.sh <任务id> \"<标题>\"）；过程用 bash _work/log.sh <任务id> \"<动作>\" \"<结果>\" 记日志、证据放 _work/<任务id>/evidence/ 并在 run.log 登记复现命令；收尾更新 STATUS.md 与记忆、清理临时物。完成的口径是「可复现命令 + 输出证据 + 影响面说明」；危险动作（删除/覆盖、改系统状态、外发网络、推送、花钱）必须先备份并先问用户；凭据禁止写入任何文件或日志。";
/** Runtime-skill description shown in the skill catalog. */
const WORKFLOW_SKILL_DESCRIPTION = "代理工作流规范（策略进仓库 + 状态看板 + 每任务隔离工作区 + 证据门槛 + 凭据与危险动作边界），由 dsh-agent-workflow 插件自动铺开并自检。当用户要求\"建立/查看工作流规范 / 任务看板 / 建任务目录 / 记录证据 / 自检工作流\"或提到 AGENT_WORKFLOW.md、STATUS.md、_work/ 时，先加载本技能再行动。";
/** Runtime-skill whenToUse guidance. */
const WORKFLOW_SKILL_WHEN_TO_USE = "用户要求为任意项目建立或维护代理工作流（策略文件 + 状态看板 + 每任务隔离目录 + 证据门槛），或要求按工作流自检时。";
//#endregion
//#region src/core/templates.ts
/**
* Template rendering and per-project init for the human-readable memory
* system (MEMORY.md index + memory/YYYY-MM-DD.md details). Mirrors the
* original project-memory skill's init-memory.sh behavior.
*/
/** Absolute path of this package's assets directory (SKILL.md + templates). */
function packageAssetsRoot() {
	const candidates = [new URL("../assets/", import.meta.url), new URL("../../assets/", import.meta.url)];
	for (const url of candidates) {
		const dir = fileURLToPath(url);
		if (existsSync(join(dir, "SKILL.md"))) return dir;
	}
	return fileURLToPath(candidates[0]);
}
/** Default user skill root: <dsh home>/skills/project-memory (single source of truth). */
function defaultSkillDir(home = dshHome()) {
	return join(home, "skills", "project-memory");
}
/** Resolve the skill root: the user skill dir when present, else the bundled assets. */
function resolveSkillDir(home = dshHome()) {
	const user = defaultSkillDir(home);
	return existsSync(join(user, "SKILL.md")) ? user : packageAssetsRoot();
}
/** Resolve the templates directory: the user skill's templates, else bundled. */
function resolveTemplateDir(home = dshHome()) {
	const user = defaultSkillDir(home);
	if (existsSync(join(user, "templates", "MEMORY.md"))) return join(user, "templates");
	return join(packageAssetsRoot(), "templates");
}
/** Load the skill body: the user skill's SKILL.md, else the bundled copy. */
function loadSkillContent(home = dshHome()) {
	const candidate = join(defaultSkillDir(home), "SKILL.md");
	return existsSync(candidate) ? readFileSync(candidate, "utf8") : readFileSync(join(packageAssetsRoot(), "SKILL.md"), "utf8");
}
/** Local-timezone YYYY-MM-DD (the skill's date convention). */
function localToday(now = /* @__PURE__ */ new Date()) {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return y + "-" + m + "-" + d;
}
/** Strip the "首次使用时整段删除" usage block from the MEMORY.md template. */
function stripUsageBlock(text) {
	return text.replace(/^> \*\*使用说明（首次使用时整段删除）：\*\*[\s\S]*?^> 6\.[^\n]*\n?/m, "");
}
/** Render the MEMORY.md index from the template (mirrors init-memory.sh). */
function renderIndex(template, projectName, today = localToday()) {
	return stripUsageBlock(template).replaceAll("{项目名}", projectName).replaceAll("{YYYY-MM-DD}", today).replaceAll("{一句话说明项目要做什么}", "（待补充——一句话说明项目要做什么）").replaceAll("{如有}", "（待补充）").replaceAll("{简短标题}", "初始化项目记忆").replaceAll("{标题}", "初始化项目记忆").replaceAll("#{tag1} #{tag2}", "#记忆体系").replaceAll("{一行结论}", "按记忆模板初始化：MEMORY.md 索引 + memory/ 每日详情。");
}
/** Render a daily memory file from the daily template. */
function renderDaily(template, today = localToday(), title = "初始化项目记忆") {
	return template.replaceAll("{YYYY-MM-DD}", today).replaceAll("{简短标题}", title);
}
/**
* Idempotent per-project init: create MEMORY.md, memory/_TEMPLATE.md and
* memory/<today>.md when missing; never overwrite existing files.
* @returns the created paths (empty when nothing was created).
*/
function ensureMemoryInit(cwd, templateDir, now = /* @__PURE__ */ new Date()) {
	const created = [];
	if (typeof cwd !== "string" || cwd === "") return created;
	const target = resolve(cwd);
	try {
		if (!existsSync(target) || !statSync(target).isDirectory()) return created;
	} catch {
		return created;
	}
	mkdirSync(join(target, "memory"), { recursive: true });
	const today = localToday(now);
	const memPath = join(target, "MEMORY.md");
	if (!existsSync(memPath)) {
		const tplPath = join(templateDir, "MEMORY.md");
		if (existsSync(tplPath)) {
			writeFileSync(memPath, renderIndex(readFileSync(tplPath, "utf8"), basename(target), today), "utf8");
			created.push(memPath);
		}
	}
	const tplFile = join(target, "memory", "_TEMPLATE.md");
	if (!existsSync(tplFile)) {
		const src = join(templateDir, "memory", "_TEMPLATE.md");
		if (existsSync(src)) {
			copyFileSync(src, tplFile);
			created.push(tplFile);
		}
	}
	const daily = join(target, "memory", today + ".md");
	if (!existsSync(daily)) {
		const src = join(templateDir, "memory", "_TEMPLATE.md");
		if (existsSync(src)) {
			writeFileSync(daily, renderDaily(readFileSync(src, "utf8"), today), "utf8");
			created.push(daily);
		}
	}
	return created;
}
/** Compress the MEMORY.md index table: keep the newest rows, fold the rest into summary rows. */
function compressMemoryIndex(filePath, keepCount = 10) {
	if (!existsSync(filePath)) return false;
	const lines = readFileSync(filePath, "utf8").split("\n");
	let tableStart = -1;
	let tableEnd = -1;
	for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("| 日期 | 标题 | 关键词 | 子记忆 |")) {
		tableStart = i;
		break;
	}
	if (tableStart === -1) return false;
	tableEnd = tableStart + 1;
	while (tableEnd < lines.length && lines[tableEnd].startsWith("|")) tableEnd++;
	const headerRows = tableStart + 2;
	const rows = [];
	for (let i = headerRows; i < tableEnd; i++) {
		const row = lines[i].trim();
		if (row.startsWith("|") && row.endsWith("|")) rows.push(row);
	}
	if (rows.length <= keepCount) return false;
	const keepRows = rows.slice(0, keepCount);
	const compressedSummary = rows.slice(keepCount).map((row) => {
		const parts = row.split("|").filter((part) => part.trim());
		return `| ${parts[0]?.trim() || "?"} | [压缩] ${parts[1]?.trim() || "?"} | ${parts[2]?.trim() || ""} | （详情已压缩，见原始文件） |`;
	});
	const before = lines.slice(0, tableStart + 1).join("\n");
	const separator = lines[tableStart + 1];
	const after = lines.slice(tableEnd).join("\n");
	writeFileSync(filePath, [
		before,
		separator,
		...keepRows,
		...compressedSummary,
		after
	].join("\n"), "utf8");
	return true;
}
/** Compress old daily memory files beyond the keep window into one-line conclusions. */
function compressMemoryDir(dirPath, keepCount = 5) {
	if (!existsSync(dirPath)) return { compressed: 0 };
	let compressed = 0;
	const toCompress = readdirSync(dirPath).filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file)).sort().reverse().slice(keepCount);
	for (const file of toCompress) {
		const filePath = join(dirPath, file);
		const textLines = readFileSync(filePath, "utf8").split("\n");
		let conclusion = "";
		let inConclusion = false;
		for (const line of textLines) {
			if (line.startsWith("## 结论")) {
				inConclusion = true;
				continue;
			}
			if (inConclusion) {
				if (line.startsWith("## ")) break;
				if (line.trim() && !line.startsWith(">")) {
					conclusion = line.trim();
					break;
				}
			}
		}
		if (!conclusion) conclusion = "（已自动压缩，详情见原始文件）";
		writeFileSync(filePath, `# ${file.slice(0, 10)} — 压缩摘要\n\n> 原始文件已压缩，结论：${conclusion}\n\n`, "utf8");
		compressed++;
	}
	return { compressed };
}
/** Compress one project: the MEMORY.md index and the memory/ directory. */
function runCompression(cwd) {
	return {
		index: compressMemoryIndex(join(cwd, "MEMORY.md")),
		daily: compressMemoryDir(join(cwd, "memory"))
	};
}
//#endregion
//#region src/routes.ts
/**
* The /api/dsh-project-memory route family: GET/PUT the plugin config, PUT
* one session override (memory and/or compression), GET the per-project
* compression counter and POST a manual compression. Every route carries the
* same loopback-only trust fence as the dsh-ssh / dsh-desktop-launcher routes
* — this endpoint writes files on the host machine, so LAN-exposed dsh web
* deployments must not serve it.
*/
/** Whether a request arrived over a loopback socket. */
function isLoopbackRequest(req) {
	const address = req.socket.remoteAddress ?? "";
	return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
/** Write one JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
const MAX_BODY_BYTES = 64 * 1024;
/** Read and JSON-parse a bounded request body; null on failure. */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > MAX_BODY_BYTES) return null;
		chunks.push(buffer);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		return null;
	}
}
/** Whether the body's named value is a boolean or null. */
function isBoolOrNull(value) {
	return value === null || typeof value === "boolean";
}
/**
* Build the config route family.
* @param store - the config store.
* @param onChange - invoked after a successful write (re-syncs plugin surfaces).
* @returns the routes.
*/
function makeRoutes(store, onChange) {
	return [
		{
			kind: "exact",
			path: "/api/dsh-project-memory/config",
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				const method = req.method ?? "GET";
				if (method === "GET") {
					writeJson(res, 200, store.load() ?? DEFAULT_CONFIG);
					return;
				}
				if (method === "PUT") {
					const body = await readJsonBody(req);
					if (typeof body !== "object" || body === null || Array.isArray(body)) {
						writeJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					const patch = body;
					const clean = {};
					for (const key of [
						"enabled",
						"autoInit",
						"autoMaintain",
						"announceToAgent",
						"autoCompress"
					]) if (typeof patch[key] === "boolean") clean[key] = patch[key];
					if (typeof patch.compressInterval === "number" && Number.isInteger(patch.compressInterval) && patch.compressInterval >= 1) clean.compressInterval = patch.compressInterval;
					if (typeof patch.workflow === "object" && patch.workflow !== null && !Array.isArray(patch.workflow)) {
						const raw = patch.workflow;
						const workflow = {};
						for (const key of [
							"enabled",
							"autoScaffold",
							"turnCheck",
							"boardInject"
						]) if (typeof raw[key] === "boolean") workflow[key] = raw[key];
						if (Object.keys(workflow).length > 0) clean.workflow = workflow;
					}
					if (typeof patch.indexes === "object" && patch.indexes !== null && !Array.isArray(patch.indexes)) {
						const raw = patch.indexes;
						const indexes = {};
						for (const key of [
							"enabled",
							"autoRefresh",
							"turnCheck"
						]) if (typeof raw[key] === "boolean") indexes[key] = raw[key];
						if (typeof raw.toolsTtlHours === "number" && Number.isInteger(raw.toolsTtlHours) && raw.toolsTtlHours >= 1) indexes.toolsTtlHours = raw.toolsTtlHours;
						if (Object.keys(indexes).length > 0) clean.indexes = indexes;
					}
					const next = store.updateGlobal(clean);
					onChange();
					writeJson(res, 200, next);
					return;
				}
				writeJson(res, 405, { error: "method not allowed: " + method });
			}
		},
		{
			kind: "exact",
			path: "/api/dsh-project-memory/session",
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				const method = req.method ?? "GET";
				if (method !== "PUT") {
					writeJson(res, 405, { error: "method not allowed: " + method });
					return;
				}
				const body = await readJsonBody(req);
				if (typeof body !== "object" || body === null || Array.isArray(body)) {
					writeJson(res, 400, { error: "invalid JSON body" });
					return;
				}
				const { sessionId, enabled, compress } = body;
				if (typeof sessionId !== "string" || sessionId === "") {
					writeJson(res, 400, { error: "sessionId required" });
					return;
				}
				if (enabled === void 0 && compress === void 0) {
					writeJson(res, 400, { error: "enabled or compress required" });
					return;
				}
				if (enabled !== void 0 && !isBoolOrNull(enabled)) {
					writeJson(res, 400, { error: "enabled must be a boolean (or null to clear)" });
					return;
				}
				if (compress !== void 0 && !isBoolOrNull(compress)) {
					writeJson(res, 400, { error: "compress must be a boolean (or null to clear)" });
					return;
				}
				let next = store.load() ?? DEFAULT_CONFIG;
				if (enabled !== void 0) next = store.setSession(sessionId, enabled);
				if (compress !== void 0) next = store.setSessionCompress(sessionId, compress);
				onChange();
				writeJson(res, 200, next);
			}
		},
		{
			kind: "exact",
			path: "/api/dsh-project-memory/count",
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				if ((req.method ?? "GET") !== "GET") {
					writeJson(res, 405, { error: "method not allowed: " + (req.method ?? "GET") });
					return;
				}
				const cwd = new URL(req.url ?? "/", "http://x").searchParams.get("cwd");
				const config = store.load() ?? DEFAULT_CONFIG;
				writeJson(res, 200, {
					cwd,
					count: cwd ? config.counts[cwd] ?? 0 : 0,
					interval: config.compressInterval
				});
			}
		},
		{
			kind: "exact",
			path: "/api/dsh-project-memory/compress-now",
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				const method = req.method ?? "GET";
				if (method !== "POST") {
					writeJson(res, 405, { error: "method not allowed: " + method });
					return;
				}
				const body = await readJsonBody(req);
				if (typeof body !== "object" || body === null || Array.isArray(body)) {
					writeJson(res, 400, { error: "invalid JSON body" });
					return;
				}
				const { cwd } = body;
				if (typeof cwd !== "string" || cwd === "" || !existsSync(join(cwd, "MEMORY.md"))) {
					writeJson(res, 400, { error: "invalid cwd" });
					return;
				}
				const results = runCompression(cwd);
				store.setCount(cwd, 0);
				writeJson(res, 200, results);
			}
		}
	];
}
//#endregion
//#region src/store.ts
/**
* File-backed config store at ~/.dsh/dsh-project-memory.json (mode 0600,
* atomic tmp+rename writes). The file is the GUI-edited source of truth;
* a missing file means "no user config yet".
*/
/** Resolve the config file path under the dsh home. */
function configPath(home = dshHome()) {
	return join(home, CONFIG_FILE_NAME);
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toBool(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function toInterval(value, fallback) {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : fallback;
}
/** Normalize the nested workflow sub-switches (missing = defaults). */
function toWorkflow(raw) {
	const base = DEFAULT_WORKFLOW;
	if (!isRecord(raw)) return { ...base };
	return {
		enabled: toBool(raw.enabled, base.enabled),
		autoScaffold: toBool(raw.autoScaffold, base.autoScaffold),
		turnCheck: toBool(raw.turnCheck, base.turnCheck),
		boardInject: toBool(raw.boardInject, base.boardInject)
	};
}
/** Normalize the nested index sub-switches (missing = defaults). */
function toIndexes(raw) {
	const base = DEFAULT_INDEXES;
	if (!isRecord(raw)) return { ...base };
	return {
		enabled: toBool(raw.enabled, base.enabled),
		autoRefresh: toBool(raw.autoRefresh, base.autoRefresh),
		turnCheck: toBool(raw.turnCheck, base.turnCheck),
		toolsTtlHours: toInterval(raw.toolsTtlHours, base.toolsTtlHours)
	};
}
function toCounts(raw) {
	const counts = {};
	if (isRecord(raw)) {
		for (const [cwd, value] of Object.entries(raw)) if (cwd !== "" && typeof value === "number" && Number.isInteger(value) && value >= 0) counts[cwd] = value;
	}
	return counts;
}
/** Validate/normalize an untrusted config document (file or request body). */
function normalizeConfig(raw) {
	const base = { ...DEFAULT_CONFIG };
	if (!isRecord(raw)) return base;
	const sessions = {};
	if (isRecord(raw.sessions)) for (const [id, entry] of Object.entries(raw.sessions)) {
		if (id === "" || !isRecord(entry)) continue;
		const override = {};
		if (typeof entry.enabled === "boolean") override.enabled = entry.enabled;
		if (typeof entry.compressEnabled === "boolean") override.compressEnabled = entry.compressEnabled;
		if (typeof entry.workflowEnabled === "boolean") override.workflowEnabled = entry.workflowEnabled;
		if (override.enabled !== void 0 || override.compressEnabled !== void 0 || override.workflowEnabled !== void 0) sessions[id] = override;
	}
	return {
		enabled: toBool(raw.enabled, base.enabled),
		autoInit: toBool(raw.autoInit, base.autoInit),
		autoMaintain: toBool(raw.autoMaintain, base.autoMaintain),
		announceToAgent: toBool(raw.announceToAgent, base.announceToAgent),
		autoCompress: toBool(raw.autoCompress, base.autoCompress),
		compressInterval: toInterval(raw.compressInterval, base.compressInterval),
		sessions,
		counts: toCounts(raw.counts),
		workflow: toWorkflow(raw.workflow),
		indexes: toIndexes(raw.indexes)
	};
}
/** Fields of the workflow sub-switch patch. */
const WORKFLOW_KEYS = [
	"enabled",
	"autoScaffold",
	"turnCheck",
	"boardInject"
];
/** Merge a partial workflow patch over the current value, dropping invalid entries. */
function mergeWorkflow(current, patch) {
	if (!isRecord(patch)) return current;
	const next = { ...current };
	for (const key of WORKFLOW_KEYS) {
		const value = patch[key];
		if (typeof value === "boolean") next[key] = value;
	}
	return next;
}
/** Fields of the index sub-switch patch. */
const INDEXES_KEYS = [
	"enabled",
	"autoRefresh",
	"turnCheck",
	"toolsTtlHours"
];
/** Merge a partial index patch over the current value, dropping invalid entries. */
function mergeIndexes(current, patch) {
	if (!isRecord(patch)) return current;
	const next = { ...current };
	for (const key of INDEXES_KEYS) {
		const value = patch[key];
		if (key === "toolsTtlHours") {
			if (typeof value === "number" && Number.isInteger(value) && value >= 1) next.toolsTtlHours = value;
			continue;
		}
		if (typeof value === "boolean") next[key] = value;
	}
	return next;
}
/** Atomic file store for the plugin config. */
var MemoryStore = class {
	path;
	/** @param path - config file path (test seam; defaults to ~/.dsh/dsh-project-memory.json). */
	constructor(path = configPath()) {
		this.path = path;
	}
	/** Whether a user config document exists on disk. */
	exists() {
		return existsSync(this.path);
	}
	/** Load the config document; undefined when no file exists (or it is unreadable). */
	load() {
		try {
			if (!existsSync(this.path)) return void 0;
			return normalizeConfig(JSON.parse(readFileSync(this.path, "utf8")));
		} catch {
			return;
		}
	}
	/** Persist a full config document (atomic tmp+rename, mode 0600). */
	save(config) {
		mkdirSync(dirname(this.path), { recursive: true });
		const tmp = this.path + ".tmp-" + process.pid;
		writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", {
			encoding: "utf8",
			mode: 384
		});
		renameSync(tmp, this.path);
	}
	/** Merge global switches into the document and persist. */
	updateGlobal(patch) {
		const current = this.load() ?? DEFAULT_CONFIG;
		const next = normalizeConfig({
			...current,
			...patch.enabled !== void 0 ? { enabled: patch.enabled } : {},
			...patch.autoInit !== void 0 ? { autoInit: patch.autoInit } : {},
			...patch.autoMaintain !== void 0 ? { autoMaintain: patch.autoMaintain } : {},
			...patch.announceToAgent !== void 0 ? { announceToAgent: patch.announceToAgent } : {},
			...patch.autoCompress !== void 0 ? { autoCompress: patch.autoCompress } : {},
			...patch.compressInterval !== void 0 ? { compressInterval: patch.compressInterval } : {},
			...patch.workflow !== void 0 ? { workflow: mergeWorkflow(current.workflow, patch.workflow) } : {},
			...patch.indexes !== void 0 ? { indexes: mergeIndexes(current.indexes, patch.indexes) } : {}
		});
		this.save(next);
		return next;
	}
	/** Set (boolean) or clear (null) one session memory override, then persist. */
	setSession(sessionId, enabled) {
		const current = this.load() ?? DEFAULT_CONFIG;
		const sessions = { ...current.sessions };
		const entry = { ...sessions[sessionId] };
		if (enabled === null) delete entry.enabled;
		else entry.enabled = enabled;
		if (entry.enabled === void 0 && entry.compressEnabled === void 0) delete sessions[sessionId];
		else sessions[sessionId] = entry;
		const next = normalizeConfig({
			...current,
			sessions
		});
		this.save(next);
		return next;
	}
	/** Set (boolean) or clear (null) one session compression override, then persist. */
	setSessionCompress(sessionId, compressEnabled) {
		const current = this.load() ?? DEFAULT_CONFIG;
		const sessions = { ...current.sessions };
		const entry = { ...sessions[sessionId] };
		if (compressEnabled === null) delete entry.compressEnabled;
		else entry.compressEnabled = compressEnabled;
		if (entry.enabled === void 0 && entry.compressEnabled === void 0) delete sessions[sessionId];
		else sessions[sessionId] = entry;
		const next = normalizeConfig({
			...current,
			sessions
		});
		this.save(next);
		return next;
	}
	/** Set (boolean) or clear (null) one session workflow override, then persist. */
	setSessionWorkflow(sessionId, workflowEnabled) {
		const current = this.load() ?? DEFAULT_CONFIG;
		const sessions = { ...current.sessions };
		const entry = { ...sessions[sessionId] };
		if (workflowEnabled === null) delete entry.workflowEnabled;
		else entry.workflowEnabled = workflowEnabled;
		if (entry.enabled === void 0 && entry.compressEnabled === void 0 && entry.workflowEnabled === void 0) delete sessions[sessionId];
		else sessions[sessionId] = entry;
		const next = normalizeConfig({
			...current,
			sessions
		});
		this.save(next);
		return next;
	}
	/** Set one per-project session counter (0 removes the key), then persist. */
	setCount(cwd, count) {
		const current = this.load() ?? DEFAULT_CONFIG;
		const counts = { ...current.counts };
		if (count <= 0) delete counts[cwd];
		else counts[cwd] = count;
		const next = normalizeConfig({
			...current,
			counts
		});
		this.save(next);
		return next;
	}
};
//#endregion
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "project-memory";
/** Services required before the plugin surfaces can mount. */
const inject = [
	"skills",
	"systemPrompt",
	"webServer"
];
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150;
function resolveDefaults(config) {
	const rawWorkflow = config?.workflow;
	const rawIndexes = config?.indexes;
	return {
		enabled: typeof config?.enabled === "boolean" ? config.enabled : true,
		autoInit: typeof config?.autoInit === "boolean" ? config.autoInit : true,
		autoMaintain: typeof config?.autoMaintain === "boolean" ? config.autoMaintain : true,
		announceToAgent: typeof config?.announceToAgent === "boolean" ? config.announceToAgent : true,
		autoCompress: typeof config?.autoCompress === "boolean" ? config.autoCompress : true,
		compressInterval: typeof config?.compressInterval === "number" && Number.isInteger(config.compressInterval) && config.compressInterval >= 1 ? config.compressInterval : 5,
		indexes: {
			enabled: typeof rawIndexes?.enabled === "boolean" ? rawIndexes.enabled : DEFAULT_INDEXES.enabled,
			autoRefresh: typeof rawIndexes?.autoRefresh === "boolean" ? rawIndexes.autoRefresh : DEFAULT_INDEXES.autoRefresh,
			turnCheck: typeof rawIndexes?.turnCheck === "boolean" ? rawIndexes.turnCheck : DEFAULT_INDEXES.turnCheck,
			toolsTtlHours: typeof rawIndexes?.toolsTtlHours === "number" && Number.isInteger(rawIndexes.toolsTtlHours) && rawIndexes.toolsTtlHours >= 1 ? rawIndexes.toolsTtlHours : DEFAULT_INDEXES.toolsTtlHours
		},
		workflow: {
			enabled: typeof rawWorkflow?.enabled === "boolean" ? rawWorkflow.enabled : DEFAULT_WORKFLOW.enabled,
			autoScaffold: typeof rawWorkflow?.autoScaffold === "boolean" ? rawWorkflow.autoScaffold : DEFAULT_WORKFLOW.autoScaffold,
			turnCheck: typeof rawWorkflow?.turnCheck === "boolean" ? rawWorkflow.turnCheck : DEFAULT_WORKFLOW.turnCheck,
			boardInject: typeof rawWorkflow?.boardInject === "boolean" ? rawWorkflow.boardInject : DEFAULT_WORKFLOW.boardInject
		}
	};
}
/** Scan the tail of a session log for one turn's tool activity. */
function turnActivity(events, turn) {
	let worked = false;
	const candidates = [...events].reverse();
	for (const event of candidates) {
		const data = event?.data;
		if (data === void 0 || typeof data.turn !== "number") continue;
		if (data.turn < turn) break;
		if (data.turn !== turn) continue;
		if (event.type === "tool/call") worked = true;
	}
	return { worked };
}
/** Subagent sessions (and any nested delegation) never get auto-init/maintain. */
function isSubagentSession(agent) {
	const header = agent?.session?.header;
	return header?.origin === "subagent" || (header?.delegationDepth ?? 0) > 0;
}
/** Apply the host half. */
function apply(ctx, config) {
	const store = new MemoryStore();
	const defaults = resolveDefaults(config);
	/** Resolve the live config: the GUI-edited file over the composition defaults. */
	const resolve = () => {
		const file = store.load();
		return {
			enabled: file?.enabled ?? defaults.enabled,
			autoInit: file?.autoInit ?? defaults.autoInit,
			autoMaintain: file?.autoMaintain ?? defaults.autoMaintain,
			announceToAgent: file?.announceToAgent ?? defaults.announceToAgent,
			autoCompress: file?.autoCompress ?? defaults.autoCompress,
			compressInterval: file?.compressInterval ?? defaults.compressInterval,
			sessions: file?.sessions ?? {},
			counts: file?.counts ?? {},
			workflow: file?.workflow ?? defaults.workflow,
			indexes: file?.indexes ?? defaults.indexes
		};
	};
	/**
	* Effective per-session automation: the global switch is a hard master;
	* the per-session override (default on) refines it per session.
	*/
	const sessionActive = (sessionId) => {
		const value = resolve();
		if (!value.enabled) return false;
		if (sessionId === void 0) return value.enabled;
		return value.sessions[sessionId]?.enabled ?? true;
	};
	/**
	* Effective per-session compression: the global autoCompress is a hard gate;
	* the per-session compressEnabled override (default on) refines it.
	*/
	const sessionCompressActive = (sessionId) => {
		const value = resolve();
		if (!value.enabled || !value.autoCompress) return false;
		if (sessionId === void 0) return true;
		return value.sessions[sessionId]?.compressEnabled ?? true;
	};
	/**
	* Effective per-session workflow automation: the workflow master switch is a
	* hard gate; the per-session override (default on) refines it per session.
	*/
	const sessionWorkflowActive = (sessionId) => {
		const value = resolve();
		if (!value.enabled || !value.workflow.enabled) return false;
		if (sessionId === void 0) return true;
		return value.sessions[sessionId]?.workflowEnabled ?? true;
	};
	let disposeSkill;
	let disposeSection;
	let disposeWorkflowSkill;
	let disposeWorkflowSection;
	const sync = () => {
		if (disposeSkill !== void 0) {
			disposeSkill();
			disposeSkill = void 0;
		}
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		if (disposeWorkflowSkill !== void 0) {
			disposeWorkflowSkill();
			disposeWorkflowSkill = void 0;
		}
		if (disposeWorkflowSection !== void 0) {
			disposeWorkflowSection();
			disposeWorkflowSection = void 0;
		}
		const value = resolve();
		if (!value.enabled) return;
		try {
			mountSurfaces(value);
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: mounting plugin surfaces failed: " + String(error));
		}
	};
	/** Register the prompt sections and runtime skills for the live config. */
	const mountSurfaces = (value) => {
		if (value.announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-project-memory",
			order: SECTION_ORDER,
			text: (context) => {
				const live = resolve();
				const header = context.agent?.session?.header;
				const id = header?.id;
				if (id !== void 0 && live.sessions[id]?.enabled === false) return MEMORY_OFF_GUIDANCE;
				const hint = typeof header?.cwd === "string" && live.indexes.enabled ? indexHint(header.cwd) : "";
				return hint === "" ? GUIDANCE : "本机已安装 dsh-project-memory 插件（项目记忆，开关开启中）：本项目默认使用 project-memory 记忆模板做记忆并分类——项目根 MEMORY.md 是 Wiki 索引（项目概况/索引表/最近摘要，恒 ≤10K），memory/YYYY-MM-DD.md 是每日详情（背景/改动/结论/关联），会话开始时已按模板自动初始化。工作流：开始任务前先读项目根 MEMORY.md 了解背景与最近进展（省 token：只读索引和摘要）；任务结束后按模板写/更新 memory/YYYY-MM-DD.md（当天多次任务合并到一个文件、分节记录），并更新 MEMORY.md 索引表（#标签 关键词分类、日期倒序只加不删、最近摘要最多 3 条，超了压缩最旧条目）。用户提到「项目记忆 / 记忆模板 / 更新 MEMORY.md / 写每日记忆 / 初始化记忆 / 人眼查看项目记忆」时按此执行；插件开关关闭时，仅在用户明确要求时才使用记忆模板。\n" + hint;
			}
		});
		disposeSkill = ctx.skills.register({
			name: "project-memory",
			description: SKILL_DESCRIPTION,
			whenToUse: SKILL_WHEN_TO_USE,
			content: loadSkillContent(),
			resourceBase: {
				kind: "directory",
				path: resolveSkillDir()
			},
			source: "plugin:dsh-project-memory"
		});
		if (!value.workflow.enabled) return;
		if (value.workflow.boardInject) disposeWorkflowSection = ctx.systemPrompt.section({
			name: "plugin:dsh-agent-workflow",
			order: 151,
			text: (context) => {
				const live = resolve();
				if (!live.enabled || !live.workflow.enabled) return "";
				const header = context.agent?.session?.header;
				const id = header?.id;
				if (id !== void 0 && live.sessions[id]?.workflowEnabled === false) return WORKFLOW_OFF_GUIDANCE;
				const cwd = header?.cwd;
				const board = typeof cwd === "string" && cwd !== "" ? readBoardSummary(cwd) : void 0;
				return board === void 0 ? WORKFLOW_GUIDANCE : "本机已安装 dsh-agent-workflow（工作流规范，开关开启中）：本项目使用 AGENT_WORKFLOW.md（策略：并发上限 / 任务隔离 / 开工与收尾钩子 / 证据门槛 / 凭据与危险动作边界）、STATUS.md（状态看板：进行中 / 阻塞 / 完成 + 证据指针 + 需要用户决定的事项）与 _work/<YYYYMMDD-短名>/（每任务隔离目录：notes.md、run.log、evidence/、backup/）。工作流：开工前先读 AGENT_WORKFLOW.md 与 STATUS.md，建立/进入任务目录（bash _work/new-task.sh <任务id> \"<标题>\"）；过程用 bash _work/log.sh <任务id> \"<动作>\" \"<结果>\" 记日志、证据放 _work/<任务id>/evidence/ 并在 run.log 登记复现命令；收尾更新 STATUS.md 与记忆、清理临时物。完成的口径是「可复现命令 + 输出证据 + 影响面说明」；危险动作（删除/覆盖、改系统状态、外发网络、推送、花钱）必须先备份并先问用户；凭据禁止写入任何文件或日志。\n当前看板（未完成项）：\n" + board;
			}
		});
		disposeWorkflowSkill = ctx.skills.register({
			name: WORKFLOW_SKILL_NAME,
			description: WORKFLOW_SKILL_DESCRIPTION,
			whenToUse: WORKFLOW_SKILL_WHEN_TO_USE,
			content: loadWorkflowSkillContent(),
			resourceBase: {
				kind: "directory",
				path: resolveWorkflowSkillDir()
			},
			source: "plugin:dsh-agent-workflow"
		});
	};
	ctx.effect(() => {
		const disposers = makeRoutes(store, sync).map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "dsh-project-memory: routes");
	ctx.on("agent/created", (payload) => {
		try {
			const agent = payload?.agent;
			if (!agent || isSubagentSession(agent)) return;
			const header = agent.session?.header;
			const cwd = header?.cwd;
			if (typeof cwd !== "string" || cwd === "") return;
			const sessionId = header?.id;
			const newConversation = payload.source === "startup" || payload.source === "clear";
			const value = resolve();
			if (!value.enabled) return;
			if (value.autoInit && sessionActive(sessionId)) {
				const created = ensureMemoryInit(cwd, resolveTemplateDir());
				if (created.length > 0) ctx.logger?.info?.("dsh-project-memory: initialized memory in " + cwd + ": " + created.join(", "));
			}
			if (value.indexes.enabled && value.indexes.autoRefresh && sessionActive(sessionId)) {
				const refreshed = refreshIndexes(cwd, { toolsTtlHours: value.indexes.toolsTtlHours });
				if (refreshed.length > 0) ctx.logger?.info?.("dsh-project-memory: refreshed indexes in " + cwd + ": " + refreshed.map((r) => r.kind).join(", "));
			}
			if (value.workflow.enabled && value.workflow.autoScaffold && sessionWorkflowActive(sessionId)) {
				const scaffolded = ensureWorkflowInit(cwd, resolveWorkflowTemplateDir());
				if (scaffolded.length > 0) ctx.logger?.info?.("dsh-agent-workflow: scaffolded workflow in " + cwd + ": " + scaffolded.length + " files");
			}
			if (newConversation && sessionCompressActive(sessionId)) {
				const next = (value.counts[cwd] ?? 0) + 1;
				if (next >= value.compressInterval) {
					const results = runCompression(cwd);
					store.setCount(cwd, 0);
					ctx.logger?.info?.("dsh-project-memory: compressed memory in " + cwd + ": MEMORY.md=" + results.index + ", memory/=" + results.daily.compressed + " files");
				} else store.setCount(cwd, next);
			}
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: session init/compress failed: " + String(error));
		}
	});
	const gate = /* @__PURE__ */ new Map();
	ctx.on("agent/turn-stopping", (payload) => {
		try {
			const value = resolve();
			if (!value.enabled || !value.autoMaintain) return;
			const agent = payload?.agent;
			if (!agent || isSubagentSession(agent)) return;
			if (payload.signal?.aborted) return;
			const events = agent.session?.snapshotEvents() ?? [];
			const turn = payload.turn ?? -1;
			if (!turnActivity(events, turn).worked) return;
			const sessionId = agent.session?.header?.id;
			if (!sessionActive(sessionId)) return;
			const agentId = agent.id ?? sessionId ?? "unknown";
			let steered = gate.get(agentId);
			if (steered === void 0) {
				steered = /* @__PURE__ */ new Set();
				gate.set(agentId, steered);
			}
			if (steered.has(turn)) return;
			steered.add(turn);
			for (const t of [...steered]) if (t < turn - 100) steered.delete(t);
			agent.steer?.(createUserMessage({
				content: [{
					type: "text",
					text: MAINTAIN_PROMPT
				}],
				source: { kind: "dsh-project-memory" }
			}));
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: auto-maintain steer failed: " + String(error));
		}
	});
	const workflowGate = /* @__PURE__ */ new Map();
	ctx.on("agent/turn-stopping", (payload) => {
		try {
			const value = resolve();
			if (!value.enabled || !value.workflow.enabled || !value.workflow.turnCheck) return;
			const agent = payload?.agent;
			if (!agent || isSubagentSession(agent)) return;
			if (payload.signal?.aborted) return;
			const events = agent.session?.snapshotEvents() ?? [];
			const turn = payload.turn ?? -1;
			if (!turnActivity(events, turn).worked) return;
			const sessionId = agent.session?.header?.id;
			if (!sessionWorkflowActive(sessionId)) return;
			const cwd = agent.session?.header?.cwd;
			if (typeof cwd !== "string" || cwd === "") return;
			const findings = checkWorkflow(cwd);
			if (findings.length === 0) return;
			const agentId = agent.id ?? sessionId ?? "unknown";
			let steered = workflowGate.get(agentId);
			if (steered === void 0) {
				steered = /* @__PURE__ */ new Set();
				workflowGate.set(agentId, steered);
			}
			if (steered.has(turn)) return;
			steered.add(turn);
			for (const t of [...steered]) if (t < turn - 100) steered.delete(t);
			const text = "（dsh-agent-workflow 收尾自检）检测到本轮工作流项未完成：\n" + findings.map((finding) => "- " + finding.detail).join("\n") + "\n若已处理请忽略；未处理请补齐（证据进 _work/<任务>/evidence/、更新 STATUS.md、临时文件归位），然后回复一句话说明处理结果。";
			agent.steer?.(createUserMessage({
				content: [{
					type: "text",
					text
				}],
				source: { kind: "dsh-agent-workflow" }
			}));
		} catch (error) {
			ctx.logger?.warn?.("dsh-agent-workflow: workflow check steer failed: " + String(error));
		}
	});
	const indexGate = /* @__PURE__ */ new Map();
	ctx.on("agent/turn-stopping", (payload) => {
		try {
			const value = resolve();
			if (!value.enabled || !value.indexes.enabled || !value.indexes.turnCheck) return;
			const agent = payload?.agent;
			if (!agent || isSubagentSession(agent)) return;
			if (payload.signal?.aborted) return;
			const sessionId = agent.session?.header?.id;
			if (!sessionActive(sessionId)) return;
			const cwd = agent.session?.header?.cwd;
			if (typeof cwd !== "string" || cwd === "") return;
			const changed = structureChanged(cwd, { toolsTtlHours: value.indexes.toolsTtlHours });
			if (changed.length === 0) return;
			const refreshed = refreshIndexes(cwd, { toolsTtlHours: value.indexes.toolsTtlHours });
			const turn = payload.turn ?? -1;
			const agentId = agent.id ?? sessionId ?? "unknown";
			let steered = indexGate.get(agentId);
			if (steered === void 0) {
				steered = /* @__PURE__ */ new Set();
				indexGate.set(agentId, steered);
			}
			if (steered.has(turn)) return;
			steered.add(turn);
			for (const t of [...steered]) if (t < turn - 100) steered.delete(t);
			const text = INDEX_DRIFT_PROMPT_PREFIX + changed.join("、") + "。\nAUTO 段已由插件按最新结构自动重建（" + refreshed.map((r) => r.kind).join("、") + "），无需手改；若要补充语义说明（例如新目录是干什么的），写进对应文件末尾的「手写区」即可。索引说明：NAVIGATION.md（目录树）/ SKILLS.md（技能清单，标注能否 skill() 加载）/ TOOLS.md（工具与版本）；AUTO 段由插件维护、勿手改，需要补充说明写「手写区」。";
			agent.steer?.(createUserMessage({
				content: [{
					type: "text",
					text
				}],
				source: { kind: "dsh-project-memory" }
			}));
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: index drift steer failed: " + String(error));
		}
	});
	sync();
	ctx.effect(() => () => {
		if (disposeSkill !== void 0) disposeSkill();
		if (disposeSection !== void 0) disposeSection();
		if (disposeWorkflowSkill !== void 0) disposeWorkflowSkill();
		if (disposeWorkflowSection !== void 0) disposeWorkflowSection();
	}, "dsh-project-memory: teardown");
}
//#endregion
export { apply, inject, isSubagentSession, name, turnActivity };
