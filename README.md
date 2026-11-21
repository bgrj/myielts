# MyIELTS · 我的剑雅学习本

手机打开，在你的剑雅原句中学习、练习和复习。原生 HTML / CSS / JavaScript，零运行时第三方依赖，无账号、无广告。

**打开学习网站：https://ourbeings.com/ielts/**

已挂载到你现有主站的雅思学习板块。

网站部署在用户已授权的 Vercel `bgrjs-projects / myielts` 项目，生产状态 READY；源码保存在本仓库。[Vercel 项目](https://vercel.com/bgrjs-projects/myielts) · [验证记录](VERIFICATION.md)

## 已有内容

从用户本地学习资料整理了 **251 条**不熟悉内容，均带原句、中文翻译、出处和个人笔记：

- 剑雅 17 · Test 1 · Passage 1，伦敦地下铁路的发展：87 条。
- 剑雅 17 · Test 1 · Passage 2，体育场的过去、现在与未来：126 条。
- 剑雅 10 · Test 1 · Section 1，旅行自驾游预订：38 句精听难点。

阅读学习稿的改写例句已回到原文 PDF 核对并替换。题干中的 housing、incorporated into、the remains of 标明题干出处，原文脚注单独注明。中文译文是学习辅助。用户另行要求把完整真题目录纳入 Git LFS 归档，详见完成后的 MATERIALS.md 与逐文件校验清单。私人聊天不提交。LICENSE 适用于本项目原创程序代码，试题、解析和录音的原有权利归属不变。

## 怎么用

1. 打开「今日学习」，默认每天加入 5 条尚未学习的个人难点，到期内容优先。
2. 阅读卡先填空；听力卡先听写。先回忆，再核对原句和解释。
3. 按真实情况选「忘了 / 吃力 / 记住 / 轻松」，安排下次复习；支持撤销上一条评分。
4. 「随手练习」提供原句填空、精听听写和中英回忆，自由练习不修改排期。
5. 「我的知识库」可搜索、按听力/阅读及出处筛选、收藏、查看和编辑。
6. 「资料与设置」可以新增内容、导入 Grok JSON、调整每日新学量、导出完整备份。

听力练习使用**对应剑雅原录音**。38句难点均已按用户时间目录精确截取，原音片段共约1.69 MB，按需加载。支持原速、慢速、三遍跟练（每遍间隔3秒），播放后支持离线回听；播放源和SHA-256见 `content/audio-manifest.json`。新增听力反馈必须带可核实原音，不能以TTS替代。阅读卡可使用合成朗读辅助跟读。

首次联网打开并完成缓存后可离线使用。可在浏览器菜单添加到主屏幕。语音离线能力取决于手机已安装的声音。

## 复习规则

使用透明的阶梯排期，初始间隔为 **1、3、7、14、30、60、120 天**。

| 自评 | 下次安排 |
|---|---|
| 忘了 | 10 分钟后重学，回到起始阶梯 |
| 吃力 | 保持当前阶梯，间隔减半，至少 1 天 |
| 记住 | 进入下一阶梯 |
| 轻松 | 跳过一个阶梯 |

这是间隔复习的可调整起点，不是 FSRS，也不声称能精确预测个人遗忘。新学量按北京时间每日计算；同日反复学习不会增加连续天数。研究依据：[主动提取与分散练习](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html)。详细设计见 [PLAN.md](PLAN.md)。

## Grok 内容接入

- [阅读 bot](https://x.ai/bot/rCEjuGhF-TVFft_2pDkqB)
- [听力 bot](https://x.ai/bot/_m-HdAjjmGuyPPJH1ASnm)

网站已接入阅读、听力两个独立发布源。Grok bot 将你反馈后的知识点提交到对应的 `content/reading.json` / `content/listening.json`，网页每分钟及返回前台时自动获取，统一用于学习、练习和复习；日常反馈更新不需要重新部署网页。追加内容沿用稳定 id，保留复习进度。

首次在「资料与设置」复制各自的 bot 配置指令，分别发给阅读和听力 bot 一次，要求保存为长期规则。用户已确认 Grok GitHub 连接有仓库写权限；本站仍不能直接修改 bot 私人指令，需它们执行首次真实发布后，才能确认 bot 侧已经接通。[完整发布协议](BOT-PUBLISHING.md)

只发布个人反馈后的难点及已核对的剑雅原句，不抓取整段私人历史。网站保留手动 JSON 导入作为备用。

## 数据与备份

卡片修改、收藏、学习历史和设置仅保存在**当前浏览器**的 localStorage。电脑与手机**不自动同步**；可导出完整 JSON 备份到新设备合并恢复，保留各条较新的评分记录。清理浏览器数据或使用无痕窗口可能导致记录消失，请定期备份。关闭网页不会在后台主动提醒，重新打开后会显示到期内容。

本地新增的资料不会因为更新代码而上传 GitHub。若需要持久的跨设备自动同步，可在后续增加私有存储与身份验证。

## 开发与验证

需要 Node.js 22+。

```sh
npm ci
npm run dev
# http://127.0.0.1:4173/myielts/
npm test
npm run test:browser
npm run test:sync-browser
npm run test:audio-browser
npm run content:check
npm run build
```

浏览器测试在 Windows 默认调用本机 Chrome，CI 使用 Playwright Chromium。执行 CI 浏览器测试前运行 `npx playwright install --with-deps chromium`。`dist/` 为部署目录。站点相对路径同时支持 GitHub Pages 项目路径及独立域名。

`scripts/extract_materials.py` / `enrich_materials.py` 是一次性本地材料转换工具，需要 Python 与 pymupdf，仅在有原始个人资料的电脑上使用；网站构建不依赖它们。重提取后应执行两者并重新核对原句。

## 部署与域名

推送 `main` 自动执行测试和构建。生产网站使用 Vercel 静态托管，配置见 [vercel.json](vercel.json)。首次发布通过已连接的 Vercel 工具上传与 GitHub 提交一致的源码；当前账号未安装 Vercel GitHub integration，因此后续 GitHub 推送还不会自动部署到 Vercel。安装集成并关联 `bgrj/myielts` 后可启用 Git 自动发布。

仓库另保留 GitHub Pages 备用发布流程：先在 Settings → Pages 将 Source 设为 GitHub Actions，再手动运行 [.github/workflows/pages.yml](.github/workflows/pages.yml) 并勾选 `deploy_pages`。Pages 未启用时，正常推送仅验证，避免发布失败。备用网址是 `https://bgrj.github.io/myielts/`。

正式入口为 `https://ourbeings.com/ielts/`。通过主站 Vercel 项目的两条精确路由挂载：`/ielts` 跳到 `/ielts/`，`/ielts/*` 代理学习项目。主站首页及其他路径保持现有路由；Cloudflare DNS、邮箱和域名注册配置未修改。路由配置记录见 [ops/ourbeings-routes.json](ops/ourbeings-routes.json)。备用托管地址为 `https://myielts-five.vercel.app/`。

从旧 Vercel 地址迁移时，请先在旧地址导出完整备份，再在自有域名的「资料与设置」合并恢复。不同域名的浏览器本地进度不会自动迁移。

网站通过同域 `/feeds/reading.json` 和 `/feeds/listening.json` 代理 GitHub 内容源，动态内容不经过 Service Worker 静态缓存；验证通过后另存离线副本。更新程序代码需部署，更新两份反馈源则直接生效。
