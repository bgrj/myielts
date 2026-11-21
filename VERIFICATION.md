# 验证记录

日期：2026-11-21（北京时间）

正式网站：https://ourbeings.com/ielts/

备用地址：https://myielts-five.vercel.app/

Vercel 项目：bgrjs-projects / myielts（prj_6gt0m5pae8w8xHZvmdGvPxoeXcqJ）

部署状态：READY，production。部署 ID：dpl_2K8Wn9G7bf6Tb7FXpk3EpprEXghj。

以上部署 ID 是初版的历史记录。自有域名与自动内容发布升级的代码、验证及部署见下文与后续提交。

## 已通过

- 12 项 Node 核心测试：251 条卡片数据契约、原句焦点与完整翻译、四档排期、阶梯上限、失败重学、新学量与到期优先、北京时间边界、答案比较、备份合并、异常导入拒绝。
- 生产构建成功；GitHub Actions 最新验证通过：[工作流](https://github.com/bgrj/myielts/actions/runs/44909043804)。
- Chrome 手机尺寸 390×844 和 360×780 无横向溢出；桌面 1440×1000 正常。
- 真实线上完整复习：作答、揭晓、评分、撤销、完成五条、刷新后保留排期和历史。
- 搜索 housing、打开题干出处、收藏；精听听写可进入并揭晓；自由练习不改变正式复习安排。
- 导出完整备份，在新浏览器上下文恢复，保留卡片、五条评分和每日新学设置。
- 无效批量导入不部分写入；导入文本按纯文本显示，HTML 不执行；新增知识卡成功。
- 线上资源均返回 HTTP 200，Service Worker 激活接管页面；离线刷新、搜索成功。首次缓存等待有一次超时，独立核对激活正常后重跑完整流程通过。
- 完整流程未记录浏览器脚本异常。

## 交付范围

251 条卡片来自用户本地资料：213 条阅读、38 句听力。附原句/片段、出处、整句中文辅助翻译及原有难点笔记。住房与遗迹等题干表达以及 amphitheatre 脚注明确标识。没有读取 Grok 私人对话；网站提供两个 bot 的入口及 JSON 整理指令和导入功能。

数据在浏览器本地，未实现跨设备自动同步和后台提醒。默认朗读为合成语音，原音可选择本地文件播放。本次没有在实体 iPhone / Safari 或 Android 手机上实测，手机验证使用 Chrome 视口模拟。

## 发布说明

GitHub Pages 未启用，保留手动备用流程。经用户明确授权，生产站改用 Vercel；当前 Vercel GitHub 集成未安装，因此本次采用与仓库提交一致的文件部署，后续 GitHub 推送暂不自动更新 Vercel。

未改动 ourbeings.com DNS，未提交原始 PDF、MP3 或私人聊天。没有后台账号、外部 API 密钥或运行时付费服务依赖。

## 自有域名与自动内容发布升级

- 已在现有 ourbeing 主站项目发布两条限定 `/ielts` 与 `/ielts/*` 的路由，详情见 ops/ourbeings-routes.json。自有域名学习页和样式均返回 HTTP 200，主站首页仍返回原站 HTTP 200；未修改 Cloudflare DNS。
- 24 项核心/发布单元测试通过。原手机/桌面完整浏览器测试通过；新增实时更新浏览器测试通过：读取两源、同 id 更新、作答/编辑期间延后应用、个人编辑优先、采用 bot 版本、进度保持、无效源保留旧版、离线最新版、备份恢复后继续接收更新。
- 浏览器测试发现并修复 fetch 默认绑定及后台刷新替换文件选择框的问题；重新验证通过，无脚本异常。
- 根据用户截图，将 just、acoustics、salt depot、incorporated into、the remains of、versatile 六个阅读反馈及 At/Of、shall/should 两个听力反馈映射到原有卡片。发布者标记为 verified-feedback，没有冒充 Grok bot 已发布。
- 用户确认 Grok 已连接 GitHub 并有本仓库写权限。网站提供两个 bot 的一次性长期规则；尚未进入 Grok 私人会话执行该规则，需各 bot 完成一次真实提交后再确认其自动发布已接通。
- 升级后的线上内容链路将在发布后验证并追加记录。
