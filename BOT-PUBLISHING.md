# Grok 反馈自动发布到 MyIELTS

学习网址：**https://ourbeings.com/ielts/**

## 给使用者：首次接通

在学习网站「资料与设置」中，分别复制阅读和听力的 bot 配置指令，发给对应的 Grok Bot。让它连接 GitHub，并仅授予 `bgrj/myielts` 仓库所需写入权限。连接在 Grok 内完成，不需要把密码或 token 发到聊天里。

网站端已具备自动更新能力，但本站不能替你修改另一个账号中的 Grok bot 指令、连接或审批设置。每个 bot 完成一次真实发布，并回传提交链接后，才能确认这个 bot 已接通。截图和 bot 分享链接本身不能建立写入权限。

接通后的流程：像平时一样反馈难点 → bot 对照剑雅材料整理 → bot 提交对应内容源 → 手机网页自动获取 → 进入知识库、练习和每日新学/复习安排。无需逐次手动导入。

## 两个 bot 的边界

| bot | botId | 只允许更新的文件 |
|---|---|---|
| 雅思全套阅读练习指导大师 | `0eca5200-224b-4af8-b13a-6fd4f4762592` | `content/reading.json` |
| 十年雅思听力指导大师 | `e79fc4f8-184b-450b-b10e-a21f91070599` | `content/listening.json` |

GitHub 分支为 `main`。GitHub 的写入授权控制谁能发布，JSON 里的 botId 仅用于分类校验，并非密码。不要尝试访问其他仓库、修改网站代码或更改另一 bot 的文件。

## 根据用户反馈整理

阅读的输入包括生词清单、短语、语法问题和“再加几个”。追加到同一篇；对同一知识点补充解释时复用 id。现有 251 条知识卡可在 `web/data/cards.json` 查到。例如 `versatile` 是 `c17-t1-p2-126`，不要重复新建。`incorporated into` 和 `the remains of` 来自原题摘要，保留题干标识；原文、题干、脚注不能混称。

听力输入包括听不清的原片段、误听或漏听的词、At / Of、shall / should 等犹豫。保留用户反馈原样到 `feedback`，再用核实后的录音文本填写 `sentence`；解释连读、弱读、缩写、小词及词尾。**每条听力练习必须有对应的剑雅原声音频**，填写 `audio.url/start/end` 及 `audioSource`，URL 必须为 HTTPS，片段不超过 300 秒。严格使用用户指定片段；不得用 TTS 或合成语音代替。

先查 `content/audio-manifest.json` 复用已核实的38句原音；新反馈从实际录音裁剪，上传带哈希文件名的 MP3 到 `content/audio/`，验证线上片段可播放后再更新听力 JSON。原音发布地址为 `https://ourbeings.com/ielts/recordings/<文件名>.mp3`。听力 bot 可更新自己的 JSON、新原音和对应清单，不能更改阅读源、网页程序或整套母版。三遍模式由网页每遍间隔3秒播放；单句文件保留一遍原音。

完整真题目录已按用户要求纳入 Git LFS 上传，文件清单为 `MATERIALS.json`，读取方式为 `MATERIALS.md`。按实际练习选择所需 PDF、解析或原录音；不必每次下载整套资料。LFS 文件需要读取实际文件，不能把指针文本当原文或音频。

仅整理用户反馈的不熟悉内容。不推荐额外陌生词库，不自动推进下一篇。不把改写例句冒充剑雅原句。缺原句、出处或对应听力原音时先保留待补齐，不能编造 `sourceVerified:true` 或发布无原音的听力练习。音标、词源没有依据时留空。不得提交私人聊天或密钥；整套母版已经单独归档，不要重复上传。

## 数据格式

完整机器格式在 [content/schema.json](content/schema.json)。每条发布卡必须具备：

- 稳定且唯一的 `id`，类型 `kind`。
- 用户反馈 `feedback`、知识点 `target`、中文含义 `meaning`。
- 真实原句/片段 `sentence`、原样位于句中的 `focus`。
- 准确的 `source`、更精确的 `originalRef`、整句译文 `translation`。
- 针对反馈的 `note`；实际对照材料后才能设置 `sourceVerified: true`。
- 可选 `ipa`、`pronunciation`、`grammar`、`collocations`、`etymology`、`personalError`、`speaker`、`audio`。

听力的 `audio` 和 `audioSource` 为必填，其余类型按实际难点补充。

文件是累计快照，不是只保留本次新增。元数据含 `schemaVersion:1`、kind、botId、revision、ISO 格式 updatedAt、publisher 和 cards。`publisher:grok` 仅在 Grok 实际发布时使用；初始已核实资料使用 `verified-feedback`，不冒充 bot 已连接。

## 可靠发布步骤

1. 读取 `main` 分支最新的对应内容文件和 `web/data/cards.json`，记下该文件 SHA。
2. 对照 source/target 找已有知识点并复用 id。为本次增量构造 `{schemaVersion:1,kind,botId,cards:[...]}`。
3. 优先在已有安全 GitHub 登录下使用无运行时依赖的发布脚本：

```sh
node scripts/publish-feedback.mjs --input /tmp/feedback.json --check
node scripts/publish-feedback.mjs --input /tmp/feedback.json
```

脚本依赖 Node 和已登录的 GitHub CLI（`gh`），不接受明文 token 参数。校验模式不写远端；发布模式每次重读最新 SHA、合并新旧条目并增加 revision。409/422 冲突最多重读合并三次，不强推。

4. 若使用 Grok 的 GitHub app 写文件：在本地执行同样校验；从 app 读取最新 content 和 SHA，合并保留旧条目，把 revision 加 1、updatedAt 写为真实发布时刻，再使用 SHA 条件更新 `main` 上的对应文件。冲突后必须重读和重新合并，不能拿旧快照重试覆盖。
5. 发布后读取 `https://ourbeings.com/ielts/feeds/reading.json?v=<当前时间戳>` 或 listening 源，确认 revision 和本次 id。保留 GitHub 提交链接作为发布证据。
6. 回复用户“更新了哪些知识点、多少条、提交链接、学习网址”。不能只生成 JSON 后说已发布，也不能把 GitHub 写入成功当成 bot 权限永久有效。
7. 将验证成功的流程保存为长期规则/技能，每次反馈整理完成后执行。如 Grok 仍要求确认，明确展示其要求；用户完成那一步后继续。

## 网站如何获取内容

网站每次打开、回到前台，以及停留时每 60 秒检查阅读和听力发布源。发布源经 Vercel 同域代理读取 GitHub main 上的最新内容，带缓存破除参数；内容更新不依赖 Vercel 再次部署。通常约一分钟内出现，仍取决于网络与 GitHub 分发延迟。

每个源先完整校验再采用。版本倒退、同版内容变化、类型混写、缺原句或反馈等会被拒绝，保留已保存版本。离线时使用本地保存的最新有效内容。更新不改评分、收藏和排期；正在答题/编辑时延后应用，避免中途改变答案。用户自己的本地编辑优先，详情中可选择采用 bot 版本。

程序代码更新仍需正常发布；日常反馈只改 `content/reading.json` 或 `content/listening.json`，不需要安装 Vercel GitHub 集成或重新构建网站。

## 研究与产品能力依据

[Grok Bot 的电脑、GitHub 应用及连接方式](https://docs.x.ai/grok-bot/computer-and-apps)；[将成功流程保存为技能](https://docs.x.ai/grok-bot/skills-routines-and-automations)。网站不抓取私人历史，不假设仅凭 bot ID 可以读取或控制 bot。
