/** 主索引最多保留的行数（超出部分压成摘要行）。 */
export declare const MAX_INDEX_ENTRIES = 10;
/** memory/ 目录最多保留的每日文件数（更旧的压成摘要）。 */
export declare const KEEP_DAILY_FILES = 5;
/** Compress the MEMORY.md index table: keep the newest rows, fold the rest into summary rows. */
export declare function compressMemoryIndex(filePath: string, keepCount?: number): boolean;
/** Compress old daily memory files beyond the keep window into one-line conclusions. */
export declare function compressMemoryDir(dirPath: string, keepCount?: number): {
    compressed: number;
};
/** Compress one project: the MEMORY.md index and the memory/ directory. */
export declare function runCompression(cwd: string): {
    index: boolean;
    daily: {
        compressed: number;
    };
};
