window.__ModuleLoader__.load({
	id: "@linxin666/dsh-project-memory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/**
		* dsh-project-memory browser-half dictionaries. The zh dictionary is the key
		* source; en mirrors the full key set. Includes the family-shared card
		* chrome vocabulary (settings.collapse ... settings.off) so the plugin-config
		* card renders exactly like the task-board / desktop-launcher cards.
		*/
		/** Chinese copy (key source). */
		const zh = {
			"settings.collapse": "收起设置",
			"settings.expand": "展开设置",
			"settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。",
			"settings.unsaved": "未保存",
			"settings.readOnly": "当前部署的设置只读。",
			"settings.saveFailed": "部署未接受这些值，已保留供你修改。",
			"settings.discard": "放弃",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.invalidNumber": "请输入数字，留空则使用默认值。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.title": "项目记忆 (project-memory)",
			"settings.description": "人读版项目记忆：每个项目默认使用记忆模板（MEMORY.md + memory/YYYY-MM-DD.md）自动记忆并分类。",
			"settings.loading": "加载中...",
			"settings.enabled": "主开关",
			"settings.enabledHint": "关闭后技能注册、指引注入、自动初始化与自动收尾全部停用。",
			"settings.autoInit": "自动初始化",
			"settings.autoInitHint": "会话开始时自动创建 MEMORY.md 与 memory/ 模板（幂等，不覆盖已有文件）。",
			"settings.autoMaintain": "自动收尾",
			"settings.autoMaintainHint": "每轮实际工作结束后引导模型写/更新当日记忆并更新索引。",
			"settings.announce": "向 Agent 注入指引",
			"settings.announceHint": "在系统提示中注入\"本项目默认使用记忆模板\"的工作流。",
			"switch.label": "项目记忆",
			"switch.on": "已开启",
			"switch.off": "已关闭",
			"switch.hintOn": "本会话启用项目记忆（自动初始化 + 自动收尾）",
			"switch.hintOff": "本会话已关闭项目记忆",
			"switch.error": "读写配置失败"
		};
		/** English copy (full key-set mirror). */
		const en = {
			"settings.collapse": "Hide settings",
			"settings.expand": "Show settings",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES allowlist and restart.",
			"settings.unsaved": "Unsaved",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.discard": "Discard",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.title": "Project Memory (project-memory)",
			"settings.description": "Human-readable per-project memory: every project uses the memory template (MEMORY.md + memory/YYYY-MM-DD.md) by default, auto-remembered and categorized.",
			"settings.loading": "Loading...",
			"settings.enabled": "Master switch",
			"settings.enabledHint": "Off disables skill registration, guidance, auto-init and auto-maintain entirely.",
			"settings.autoInit": "Auto-init",
			"settings.autoInitHint": "Create MEMORY.md and the memory/ templates at session start (idempotent, never overwrites).",
			"settings.autoMaintain": "Auto-maintain",
			"settings.autoMaintainHint": "Steer the model to write/update the daily memory and the index after each worked turn.",
			"settings.announce": "Announce to agent",
			"settings.announceHint": "Inject the \"this project uses the memory template by default\" workflow into the system prompt.",
			"switch.label": "Project memory",
			"switch.on": "On",
			"switch.off": "Off",
			"switch.hintOn": "This session uses project memory (auto-init + auto-maintain)",
			"switch.hintOff": "Project memory is off for this session",
			"switch.error": "Failed to read/write config"
		};
		/** Locale namespace owned by the browser half. */
		const NS = "dsh-project-memory";
		/** Registered dictionaries. */
		const dictionaries = {
			zh,
			en
		};
		//#endregion
		//#region src/client/api.ts
		/** Read the route's JSON error message when present. */
		function errorOf(body) {
			if (typeof body === "object" && body !== null && typeof body.error === "string") return body.error;
		}
		async function request(path, init) {
			const response = await fetch(path, {
				headers: { "content-type": "application/json" },
				...init
			});
			let body;
			try {
				body = await response.json();
			} catch {
				throw new Error("HTTP " + response.status + ": invalid JSON response");
			}
			if (!response.ok) throw new Error(errorOf(body) ?? "HTTP " + response.status);
			return body;
		}
		/** Read the full config. */
		function fetchConfig() {
			return request("/api/dsh-project-memory/config");
		}
		/** Patch the global switches. */
		function updateConfig(patch) {
			return request("/api/dsh-project-memory/config", {
				method: "PUT",
				body: JSON.stringify(patch)
			});
		}
		/** Set (true/false) one session override. */
		function updateSession(sessionId, enabled) {
			return request("/api/dsh-project-memory/session", {
				method: "PUT",
				body: JSON.stringify({
					sessionId,
					enabled
				})
			});
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-project-memory/src/client/settings-card.module.css.mjs
		const css$1 = ".vwVljq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.vwVljq_card:hover{border-color:var(--dsw-alias-label-dimmed)}.vwVljq_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.vwVljq_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.vwVljq_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.vwVljq_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.vwVljq_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.vwVljq_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.vwVljq_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.vwVljq_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.vwVljq_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.vwVljq_chevronOpen{transform:rotate(180deg)}.vwVljq_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.vwVljq_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.vwVljq_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.vwVljq_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.vwVljq_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.vwVljq_discard,.vwVljq_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.vwVljq_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.vwVljq_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.vwVljq_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.vwVljq_discard:disabled,.vwVljq_save:disabled{opacity:.4;cursor:default}.vwVljq_discard:focus-visible,.vwVljq_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.vwVljq_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.vwVljq_field+.vwVljq_field{border-top:1px solid var(--dsw-alias-border-l2)}.vwVljq_head{align-items:center;gap:8px;display:flex}.vwVljq_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.vwVljq_badges{align-items:center;gap:8px;display:inline-flex}.vwVljq_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.vwVljq_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.vwVljq_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.vwVljq_reset:disabled{cursor:default}.vwVljq_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.vwVljq_input,.vwVljq_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.vwVljq_input:focus-visible,.vwVljq_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.vwVljq_input:disabled,.vwVljq_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.vwVljq_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.vwVljq_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.vwVljq_selectWrap{position:relative}.vwVljq_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.vwVljq_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.vwVljq_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.vwVljq_selectChevronOpen{transform:rotate(180deg)}.vwVljq_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.vwVljq_selectPopupOpen{opacity:1;transform:none}.vwVljq_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.vwVljq_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.vwVljq_selectOption:hover,.vwVljq_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.vwVljq_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.vwVljq_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.vwVljq_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.vwVljq_card,.vwVljq_header,.vwVljq_chevron,.vwVljq_chevronOpen,.vwVljq_discard,.vwVljq_save,.vwVljq_selectChevron,.vwVljq_selectChevronOpen,.vwVljq_selectPopup{transition:none}}";
		const tagId$1 = "@linxin666/dsh-project-memory/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-project-memory";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "vwVljq_badge",
			"badges": "vwVljq_badges",
			"body": "vwVljq_body",
			"card": "vwVljq_card",
			"cardOpen": "vwVljq_cardOpen",
			"chevron": "vwVljq_chevron",
			"chevronOpen": "vwVljq_chevronOpen",
			"description": "vwVljq_description",
			"discard": "vwVljq_discard",
			"failed": "vwVljq_failed",
			"field": "vwVljq_field",
			"footer": "vwVljq_footer",
			"head": "vwVljq_head",
			"headText": "vwVljq_headText",
			"header": "vwVljq_header",
			"headerStatic": "vwVljq_headerStatic",
			"hint": "vwVljq_hint",
			"input": "vwVljq_input",
			"inputInvalid": "vwVljq_inputInvalid",
			"invalid": "vwVljq_invalid",
			"label": "vwVljq_label",
			"name": "vwVljq_name",
			"notExposed": "vwVljq_notExposed",
			"pending": "vwVljq_pending",
			"readOnly": "vwVljq_readOnly",
			"reset": "vwVljq_reset",
			"save": "vwVljq_save",
			"select": "vwVljq_select",
			"selectButton": "vwVljq_selectButton",
			"selectChevron": "vwVljq_selectChevron",
			"selectChevronOpen": "vwVljq_selectChevronOpen",
			"selectLabel": "vwVljq_selectLabel",
			"selectOption": "vwVljq_selectOption",
			"selectOptionActive": "vwVljq_selectOptionActive",
			"selectOptionSelected": "vwVljq_selectOptionSelected",
			"selectPopup": "vwVljq_selectPopup",
			"selectPopupClose": "vwVljq_selectPopupClose",
			"selectPopupOpen": "vwVljq_selectPopupOpen",
			"selectWrap": "vwVljq_selectWrap"
		};
		//#endregion
		//#region src/client/PluginSettingsCard.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		/**
		* The project-memory plugin-config card, rendered inside the Web UI Plugins
		* group (web-ui.plugin.item). Uses the family-shared collapsible card chrome
		* (PluginSettingsCard) and the shared BooleanField control, exactly like the
		* task-board / desktop-launcher cards — no custom styling. Unlike those
		* cards, the values are read/written through the plugin's own config routes
		* (~/.dsh/dsh-project-memory.json) instead of a settings namespace, so the
		* card adapts the route state onto the shared chrome's CardShell contract.
		*/
		/** The boolean fields this card edits. */
		const FIELD_IDS = [
			"enabled",
			"autoInit",
			"autoMaintain",
			"announceToAgent"
		];
		/** Read one boolean field off the config. */
		function valueOf(config, id) {
			return config[id];
		}
		/** The plugin-config card (family chrome, collapsed by default). */
		function SettingsCard(props) {
			const { t } = props;
			const [config, setConfig] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let alive = true;
				fetchConfig().then((value) => {
					if (!alive) return;
					setConfig(value);
					setDraft(value);
				}).catch((cause) => {
					if (alive) setFailed(cause instanceof Error ? cause.message : String(cause));
				});
				return () => {
					alive = false;
				};
			}, []);
			if (config === null || draft === null) return null;
			const dirty = FIELD_IDS.some((id) => valueOf(draft, id) !== valueOf(config, id));
			const shell = {
				available: true,
				exposed: true,
				writable: true,
				dirty,
				invalid: false,
				saving: busy,
				failed: failed !== void 0,
				...failed !== void 0 ? { failedReason: failed } : {}
			};
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled: busy
			};
			const fieldState = (id) => ({
				text: String(valueOf(draft, id)),
				overridden: false,
				invalid: false
			});
			const onEdit = (id) => (text) => {
				setFailed(void 0);
				setDraft({
					...draft,
					[id]: text === "false" ? false : true
				});
			};
			const onReset = (id) => () => {
				setFailed(void 0);
				setDraft({
					...draft,
					[id]: true
				});
			};
			const save = async () => {
				if (busy || !dirty) return;
				setBusy(true);
				setFailed(void 0);
				try {
					const next = await updateConfig({
						enabled: draft.enabled,
						autoInit: draft.autoInit,
						autoMaintain: draft.autoMaintain,
						announceToAgent: draft.announceToAgent
					});
					setConfig(next);
					setDraft(next);
				} catch (cause) {
					setFailed(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const discard = () => {
				setDraft(config);
				setFailed(void 0);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				defaultOpen: false,
				state: shell,
				onSave: () => {
					save();
				},
				onDiscard: discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-project-memory-enabled",
						label: t("settings.enabled"),
						hint: t("settings.enabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...fieldState("enabled"),
						onEdit: onEdit("enabled"),
						onReset: onReset("enabled")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-project-memory-auto-init",
						label: t("settings.autoInit"),
						hint: t("settings.autoInitHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...fieldState("autoInit"),
						onEdit: onEdit("autoInit"),
						onReset: onReset("autoInit")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-project-memory-auto-maintain",
						label: t("settings.autoMaintain"),
						hint: t("settings.autoMaintainHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...fieldState("autoMaintain"),
						onEdit: onEdit("autoMaintain"),
						onReset: onReset("autoMaintain")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-project-memory-announce",
						label: t("settings.announce"),
						hint: t("settings.announceHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...fieldState("announceToAgent"),
						onEdit: onEdit("announceToAgent"),
						onReset: onReset("announceToAgent")
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-project-memory/src/client/memory.module.css.mjs
		const css = ".Ul-pmG_card{flex-direction:column;gap:10px;padding:4px 0;display:flex}.Ul-pmG_cardHead{cursor:pointer;text-align:left;width:100%;color:inherit;background:0 0;border:none;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 2px;display:flex}.Ul-pmG_cardHeadText{flex-direction:column;gap:2px;min-width:0;display:flex}.Ul-pmG_cardTitle{color:var(--dsw-alias-text-1,inherit);margin:0;font-size:14px;font-weight:600}.Ul-pmG_cardDesc{color:var(--dsw-alias-text-2,#888);margin:0;font-size:12px;line-height:1.5}.Ul-pmG_pending{color:var(--dsw-alias-warn,#b8860b);flex:none;font-size:11px}.Ul-pmG_cardBody{flex-direction:column;gap:10px;display:flex}.Ul-pmG_row{border-bottom:1px solid var(--dsw-alias-border,#80808033);justify-content:space-between;align-items:center;gap:12px;padding:8px 0;display:flex}.Ul-pmG_row:last-of-type{border-bottom:none}.Ul-pmG_rowText{flex-direction:column;gap:2px;min-width:0;display:flex}.Ul-pmG_rowLabel{color:var(--dsw-alias-text-1,inherit);font-size:13px}.Ul-pmG_rowHint{color:var(--dsw-alias-text-2,#888);font-size:12px;line-height:1.4}.Ul-pmG_switch{appearance:none;background:var(--dsw-alias-bg-muted,#ccc);cursor:pointer;border-radius:10px;flex:none;width:34px;height:20px;margin:0;transition:background .12s;position:relative}.Ul-pmG_switch:after{content:\"\";background:#fff;border-radius:50%;width:16px;height:16px;transition:transform .12s;position:absolute;top:2px;left:2px}.Ul-pmG_switch:checked{background:var(--dsw-alias-accent,#4f7cff)}.Ul-pmG_switch:checked:after{transform:translate(14px)}.Ul-pmG_switch:disabled{opacity:.45;cursor:not-allowed}.Ul-pmG_footer{align-items:center;gap:10px;margin-top:4px;display:flex}.Ul-pmG_save{background:var(--dsw-alias-accent,#4f7cff);color:#fff;cursor:pointer;border:none;border-radius:6px;padding:5px 14px;font-size:13px}.Ul-pmG_save:disabled{opacity:.5;cursor:not-allowed}.Ul-pmG_status{color:var(--dsw-alias-text-2,#888);font-size:12px}.Ul-pmG_error{color:var(--dsw-alias-danger,#d9534f);font-size:12px}.Ul-pmG_dock{flex-direction:column;align-items:flex-end;gap:4px;padding:2px 12px;font-size:12px;display:flex}.Ul-pmG_dockHeader{cursor:pointer;color:var(--dsw-alias-text-2,#888);background:0 0;border:none;align-items:center;gap:6px;padding:4px 6px;display:flex}.Ul-pmG_dockHeader:hover{color:var(--dsw-alias-text-1,inherit)}.Ul-pmG_dockText{align-items:center;gap:6px;display:flex}.Ul-pmG_dockText strong{color:var(--dsw-alias-text-1,inherit);font-weight:500}.Ul-pmG_dockState{opacity:.85;font-size:11px}.Ul-pmG_dockBody{align-items:center;gap:10px;padding:2px 6px 6px;display:flex}.Ul-pmG_dockLabel{cursor:pointer;align-items:center;gap:8px;display:flex}.Ul-pmG_dockHint{color:var(--dsw-alias-text-2,#888)}.Ul-pmG_dockError{color:var(--dsw-alias-danger,#d9534f);font-size:11px}.Ul-pmG_chevron{flex:none;transition:transform .12s}.Ul-pmG_chevronOpen{flex:none;transition:transform .12s;transform:rotate(180deg)}";
		const tagId = "@linxin666/dsh-project-memory/memory.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-project-memory";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var memory_module_css_default = {
			"card": "Ul-pmG_card",
			"cardBody": "Ul-pmG_cardBody",
			"cardDesc": "Ul-pmG_cardDesc",
			"cardHead": "Ul-pmG_cardHead",
			"cardHeadText": "Ul-pmG_cardHeadText",
			"cardTitle": "Ul-pmG_cardTitle",
			"chevron": "Ul-pmG_chevron",
			"chevronOpen": "Ul-pmG_chevronOpen",
			"dock": "Ul-pmG_dock",
			"dockBody": "Ul-pmG_dockBody",
			"dockError": "Ul-pmG_dockError",
			"dockHeader": "Ul-pmG_dockHeader",
			"dockHint": "Ul-pmG_dockHint",
			"dockLabel": "Ul-pmG_dockLabel",
			"dockState": "Ul-pmG_dockState",
			"dockText": "Ul-pmG_dockText",
			"error": "Ul-pmG_error",
			"footer": "Ul-pmG_footer",
			"pending": "Ul-pmG_pending",
			"row": "Ul-pmG_row",
			"rowHint": "Ul-pmG_rowHint",
			"rowLabel": "Ul-pmG_rowLabel",
			"rowText": "Ul-pmG_rowText",
			"save": "Ul-pmG_save",
			"status": "Ul-pmG_status",
			"switch": "Ul-pmG_switch"
		};
		//#endregion
		//#region src/client/SessionMemorySwitch.tsx
		/**
		* Per-session memory switch, mounted in the official conversation.input.dock
		* band — a row under the conversation, above the composer. Task-board style:
		* collapsed to a compact disclosure row by default (label + state + chevron),
		* expanding reveals the hint and the switch. It reads the live config through
		* the host routes and writes the session override on toggle.
		*/
		/** Chevron used by the disclosure header (mirrors the family card chrome). */
		function Chevron(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				className: props.open ? memory_module_css_default.chevronOpen : memory_module_css_default.chevron,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 9.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				})
			});
		}
		/** The dock row: collapsible disclosure with the session switch inside. */
		function SessionMemorySwitch(props) {
			const { t, session } = props;
			const sessionId = session?.sessionId;
			const [open, setOpen] = (0, react.useState)(false);
			const [loading, setLoading] = (0, react.useState)(true);
			const [globalEnabled, setGlobalEnabled] = (0, react.useState)(true);
			const [sessionOn, setSessionOn] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let alive = true;
				if (sessionId === void 0) {
					setLoading(false);
					return;
				}
				setLoading(true);
				fetchConfig().then((config) => {
					if (!alive) return;
					setGlobalEnabled(config.enabled);
					setSessionOn(config.sessions[sessionId]?.enabled ?? true);
					setLoading(false);
				}).catch((cause) => {
					if (!alive) return;
					setError(cause instanceof Error ? cause.message : String(cause));
					setLoading(false);
				});
				return () => {
					alive = false;
				};
			}, [sessionId]);
			if (sessionId === void 0 || loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-dsh-plugin": "project-memory",
				"data-dsh-part": "session-switch",
				className: memory_module_css_default.dock
			});
			const on = globalEnabled && sessionOn;
			const toggle = async () => {
				if (busy) return;
				setBusy(true);
				setError(void 0);
				try {
					const next = await updateSession(sessionId, !sessionOn);
					setSessionOn(next.sessions[sessionId]?.enabled ?? true);
					setGlobalEnabled(next.enabled);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-dsh-plugin": "project-memory",
				"data-dsh-part": "session-switch",
				className: memory_module_css_default.dock,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: memory_module_css_default.dockHeader,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: memory_module_css_default.dockText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("switch.label") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: memory_module_css_default.dockState,
							children: on ? t("switch.on") : t("switch.off")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: memory_module_css_default.dockBody,
					children: [error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: memory_module_css_default.dockError,
						children: [
							t("switch.error"),
							": ",
							error
						]
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: memory_module_css_default.dockLabel,
						title: on ? t("switch.hintOn") : t("switch.hintOff"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: memory_module_css_default.dockHint,
							children: on ? t("switch.hintOn") : t("switch.hintOff")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							role: "switch",
							className: memory_module_css_default.switch,
							checked: on,
							disabled: !globalEnabled || busy,
							onChange: () => {
								toggle();
							}
						})]
					})]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services. */
		const inject = ["slots", "locale"];
		/** Apply the browser half. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-project-memory: dictionaries");
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.input.dock", () => scope.slots.register({
					name: "conversation.input.dock",
					id: "project-memory-session-switch",
					order: 100,
					locale: NS
				}, SessionMemorySwitch));
				scope.slots.inject("web-ui.plugin.item", () => scope.slots.register({
					name: "web-ui.plugin.item",
					id: "project-memory",
					order: 110,
					locale: NS
				}, SettingsCard));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map