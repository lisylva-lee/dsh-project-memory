/**
 * dsh-project-memory browser-half dictionaries. The zh dictionary is the key
 * source; en mirrors the full key set. Includes the family-shared card
 * chrome vocabulary (settings.collapse ... settings.off) so the plugin-config
 * card renders exactly like the task-board / desktop-launcher cards.
 */
/** Chinese copy (key source). */
export declare const zh: {
    'settings.collapse': string;
    'settings.expand': string;
    'settings.notExposed': string;
    'settings.unsaved': string;
    'settings.readOnly': string;
    'settings.saveFailed': string;
    'settings.discard': string;
    'settings.save': string;
    'settings.saving': string;
    'settings.overridden': string;
    'settings.reset': string;
    'settings.invalidNumber': string;
    'settings.inherit': string;
    'settings.on': string;
    'settings.off': string;
    'settings.title': string;
    'settings.description': string;
    'settings.loading': string;
    'settings.enabled': string;
    'settings.enabledHint': string;
    'settings.autoInit': string;
    'settings.autoInitHint': string;
    'settings.autoMaintain': string;
    'settings.autoMaintainHint': string;
    'settings.announce': string;
    'settings.announceHint': string;
    'settings.autoCompress': string;
    'settings.autoCompressHint': string;
    'switch.label': string;
    'switch.on': string;
    'switch.off': string;
    'switch.hintOn': string;
    'switch.hintOff': string;
    'switch.error': string;
    'switch.compressLabel': string;
    'switch.compressHintOn': string;
    'switch.compressHintOff': string;
};
/** English copy (full key-set mirror). */
export declare const en: Record<keyof typeof zh, string>;
/** Union of dictionary keys (the LocaleNamespaceMap value). */
export type ProjectMemoryKey = keyof typeof zh;
/** Locale namespace owned by the browser half. */
export declare const NS = "dsh-project-memory";
/** Registered dictionaries. */
export declare const dictionaries: {
    zh: {
        'settings.collapse': string;
        'settings.expand': string;
        'settings.notExposed': string;
        'settings.unsaved': string;
        'settings.readOnly': string;
        'settings.saveFailed': string;
        'settings.discard': string;
        'settings.save': string;
        'settings.saving': string;
        'settings.overridden': string;
        'settings.reset': string;
        'settings.invalidNumber': string;
        'settings.inherit': string;
        'settings.on': string;
        'settings.off': string;
        'settings.title': string;
        'settings.description': string;
        'settings.loading': string;
        'settings.enabled': string;
        'settings.enabledHint': string;
        'settings.autoInit': string;
        'settings.autoInitHint': string;
        'settings.autoMaintain': string;
        'settings.autoMaintainHint': string;
        'settings.announce': string;
        'settings.announceHint': string;
        'settings.autoCompress': string;
        'settings.autoCompressHint': string;
        'switch.label': string;
        'switch.on': string;
        'switch.off': string;
        'switch.hintOn': string;
        'switch.hintOff': string;
        'switch.error': string;
        'switch.compressLabel': string;
        'switch.compressHintOn': string;
        'switch.compressHintOff': string;
    };
    en: Record<"settings.collapse" | "settings.expand" | "settings.notExposed" | "settings.unsaved" | "settings.readOnly" | "settings.saveFailed" | "settings.discard" | "settings.save" | "settings.saving" | "settings.overridden" | "settings.reset" | "settings.invalidNumber" | "settings.inherit" | "settings.on" | "settings.off" | "settings.title" | "settings.description" | "settings.loading" | "settings.enabled" | "settings.enabledHint" | "settings.autoInit" | "settings.autoInitHint" | "settings.autoMaintain" | "settings.autoMaintainHint" | "settings.announce" | "settings.announceHint" | "settings.autoCompress" | "settings.autoCompressHint" | "switch.label" | "switch.on" | "switch.off" | "switch.hintOn" | "switch.hintOff" | "switch.error" | "switch.compressLabel" | "switch.compressHintOn" | "switch.compressHintOff", string>;
};
