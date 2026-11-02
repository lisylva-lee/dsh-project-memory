/**
 * 手动刷新三棵树索引（不依赖 DSH 运行时，可直接用 node 跑）：
 *   node --experimental-strip-types scripts/refresh-indexes.ts [cwd] [--force]
 */
import { refreshIndexes } from '../src/core/indexes.ts'

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const target = argv.find(arg => !arg.startsWith('--')) ?? process.cwd()

const results = refreshIndexes(target, {}, force)
if (results.length === 0) {
  console.log('索引无变化（指纹一致），未写盘：' + target)
} else {
  for (const result of results) {
    console.log((result.changed ? '更新 ' : '未变 ') + result.kind + ' → ' + result.path)
  }
}