import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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
/** Runtime-skill description shown in the skill catalog. */
const SKILL_DESCRIPTION = "人读版项目记忆体系（手工 MEMORY.md 主索引 + memory/YYYY-MM-DD.md 每日详情），由 dsh-project-memory 插件自动初始化并维护。当用户要求\"使用记忆模板 / 创建项目记忆 / 初始化记忆 / 维护记忆 / 更新 MEMORY.md / 写每日记忆 / 人眼查看项目记忆\"或提到 F:\\xiangmu\\记忆模板 时，先加载本技能再行动。";
/** Runtime-skill whenToUse guidance. */
const SKILL_WHEN_TO_USE = "用户要求为任意项目建立或维护人读版记忆体系（MEMORY.md + memory/），或要求记忆可被肉眼查看/提交 git 时。";
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
	counts: {}
};
/** Config file name under ~/.dsh/. */
const CONFIG_FILE_NAME = "dsh-project-memory.json";
/** The session-scope "off" note when the per-session switch disables memory. */
const MEMORY_OFF_GUIDANCE = "（dsh-project-memory）本会话的项目记忆开关已关闭：不自动初始化/维护 MEMORY.md 与 memory/，仅在用户明确要求时才使用记忆模板。";
//#endregion
//#region src/core/templates.ts
/**
* Template rendering and per-project init for the human-readable memory
* system (MEMORY.md index + memory/YYYY-MM-DD.md details). Mirrors the
* original project-memory skill's init-memory.sh behavior.
*/
/** Absolute path of this package's assets directory (SKILL.md + templates). */
function packageAssetsRoot() {
	return fileURLToPath(new URL("../../assets/", import.meta.url));
}
/** Default user skill root: ~/.dsh/skills/project-memory (single source of truth). */
function defaultSkillDir(home = homedir()) {
	return join(home, ".dsh", "skills", "project-memory");
}
/** Resolve the skill root: the user skill dir when present, else the bundled assets. */
function resolveSkillDir(home = homedir()) {
	const user = defaultSkillDir(home);
	return existsSync(join(user, "SKILL.md")) ? user : packageAssetsRoot();
}
/** Resolve the templates directory: the user skill's templates, else bundled. */
function resolveTemplateDir(home = homedir()) {
	const user = defaultSkillDir(home);
	if (existsSync(join(user, "templates", "MEMORY.md"))) return join(user, "templates");
	return join(packageAssetsRoot(), "templates");
}
/** Load the skill body: the user skill's SKILL.md, else the bundled copy. */
function loadSkillContent(home = homedir()) {
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
function configPath(home = homedir()) {
	return join(home, ".dsh", CONFIG_FILE_NAME);
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
		if (override.enabled !== void 0 || override.compressEnabled !== void 0) sessions[id] = override;
	}
	return {
		enabled: toBool(raw.enabled, base.enabled),
		autoInit: toBool(raw.autoInit, base.autoInit),
		autoMaintain: toBool(raw.autoMaintain, base.autoMaintain),
		announceToAgent: toBool(raw.announceToAgent, base.announceToAgent),
		autoCompress: toBool(raw.autoCompress, base.autoCompress),
		compressInterval: toInterval(raw.compressInterval, base.compressInterval),
		sessions,
		counts: toCounts(raw.counts)
	};
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
		const next = normalizeConfig({
			...this.load() ?? DEFAULT_CONFIG,
			...patch.enabled !== void 0 ? { enabled: patch.enabled } : {},
			...patch.autoInit !== void 0 ? { autoInit: patch.autoInit } : {},
			...patch.autoMaintain !== void 0 ? { autoMaintain: patch.autoMaintain } : {},
			...patch.announceToAgent !== void 0 ? { announceToAgent: patch.announceToAgent } : {},
			...patch.autoCompress !== void 0 ? { autoCompress: patch.autoCompress } : {},
			...patch.compressInterval !== void 0 ? { compressInterval: patch.compressInterval } : {}
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
	return {
		enabled: typeof config?.enabled === "boolean" ? config.enabled : true,
		autoInit: typeof config?.autoInit === "boolean" ? config.autoInit : true,
		autoMaintain: typeof config?.autoMaintain === "boolean" ? config.autoMaintain : true,
		announceToAgent: typeof config?.announceToAgent === "boolean" ? config.announceToAgent : true,
		autoCompress: typeof config?.autoCompress === "boolean" ? config.autoCompress : true,
		compressInterval: typeof config?.compressInterval === "number" && Number.isInteger(config.compressInterval) && config.compressInterval >= 1 ? config.compressInterval : 5
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
			counts: file?.counts ?? {}
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
	let disposeSkill;
	let disposeSection;
	const sync = () => {
		if (disposeSkill !== void 0) {
			disposeSkill();
			disposeSkill = void 0;
		}
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		const value = resolve();
		if (!value.enabled) return;
		if (value.announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-project-memory",
			order: SECTION_ORDER,
			text: (context) => {
				const live = resolve();
				const id = (context.agent?.session?.header)?.id;
				if (id !== void 0 && live.sessions[id]?.enabled === false) return MEMORY_OFF_GUIDANCE;
				return GUIDANCE;
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
	};
	ctx.effect(() => {
		const disposers = makeRoutes(store, sync).map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "dsh-project-memory: routes");
	ctx.on("agent/session-start", (payload) => {
		try {
			const agent = payload?.agent;
			if (!agent || isSubagentSession(agent)) return;
			const header = agent.session?.header;
			const cwd = header?.cwd;
			if (typeof cwd !== "string" || cwd === "") return;
			const sessionId = header?.id;
			const value = resolve();
			if (!value.enabled) return;
			if (value.autoInit && sessionActive(sessionId)) {
				const created = ensureMemoryInit(cwd, resolveTemplateDir());
				if (created.length > 0) ctx.logger?.info?.("dsh-project-memory: initialized memory in " + cwd + ": " + created.join(", "));
			}
			if (sessionCompressActive(sessionId)) {
				const next = (value.counts[cwd] ?? 0) + 1;
				if (next >= value.compressInterval) {
					const results = runCompression(cwd);
					store.setCount(cwd, 0);
					ctx.logger?.info?.("dsh-project-memory: compressed memory in " + cwd + ": MEMORY.md=" + results.index + ", memory/=" + results.daily.compressed + " files");
				} else store.setCount(cwd, next);
			}
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: session-start init/compress failed: " + String(error));
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
			const events = agent.session?.events ?? [];
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
				source: {
					kind: "plugin",
					plugin: "dsh-project-memory"
				}
			}));
		} catch (error) {
			ctx.logger?.warn?.("dsh-project-memory: auto-maintain steer failed: " + String(error));
		}
	});
	sync();
	ctx.effect(() => () => {
		if (disposeSkill !== void 0) disposeSkill();
		if (disposeSection !== void 0) disposeSection();
	}, "dsh-project-memory: teardown");
}
//#endregion
export { apply, inject, isSubagentSession, name, turnActivity };
