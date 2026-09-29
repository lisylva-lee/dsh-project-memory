# _work/ — 每任务隔离工作区

规则见 `../AGENT_WORKFLOW.md` §3/§4。要点：

1. 一个任务一个目录：`_work/YYYYMMDD-短名/`；所有临时产物只放这里。
2. 目录内约定：
   - `README.md`  任务头（id / 标题 / 目标 / 验收标准）
   - `notes.md`   计划、风险、备份与恢复方法、关键决策
   - `run.log`    逐行日志：`YYYY-MM-DD HH:MM | 动作 | 结果摘要`
   - `evidence/`  证据文件（`NN-简述.扩展名`），每条证据在 run.log 登记复现命令
   - `backup/`    破坏性操作前的备份
   - `archive/`   需要保留但不再使用的中间物
3. 新建任务：`bash _work/new-task.sh 20260929-示例 "任务标题"`
4. 追加日志：`bash _work/log.sh 20260929-示例 "执行了什么" "结果摘要"`
5. 需要剥离凭据地跑命令：`bash _work/sanitize-env.sh -- <命令...>`（自动 `env -u` 掉常见 token 变量）
6. 共享资产（如 `_tessdata/`）不得放入任务目录；如需新增共享资产，登记到 `../STATUS.md` 的「共享资产登记」。
