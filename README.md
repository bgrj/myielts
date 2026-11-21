# MyIELTS · 我的剑雅学习本

手机打开，在你的剑雅原句中学习、练习和复习。原生 HTML / CSS / JavaScript，零运行时第三方依赖，无账号、无广告。

在线地址：**https://bgrj.github.io/myielts/**

## 已有内容

从用户本地学习资料整理了 **251 条**不熟悉内容，均带原句、中文翻译、出处和个人笔记：

- 剑雅 17 · Test 1 · Passage 1，伦敦地下铁路的发展：87 条。
- 剑雅 17 · Test 1 · Passage 2，体育场的过去、现在与未来：126 条。
- 剑雅 10 · Test 1 · Section 1，旅行自驾游预订：38 句精听难点。

阅读学习稿的改写例句已回到原文 PDF 核对并替换。题干中的 housing、incorporated into、the remains of 标明题干出处，原文脚注单独注明。中文译文是学习辅助。原 PDF、音频和私人聊天不提交到公开仓库。LICENSE 适用于本项目原创程序代码，剑雅原文片段的权利归原权利人。

## 怎么用

1. 打开「今日学习」，默认每天加入 5 条尚未学习的个人难点，到期内容优先。
2. 阅读卡先填空；听力卡先听写。先回忆，再核对原句和解释。
3. 按真实情况选「忘了 / 吃力 / 记住 / 轻松」，安排下次复习；支持撤销上一条评分。
4. 「随手练习」提供原句填空、精听听写和中英回忆，自由练习不修改排期。
5. 「我的知识库」可搜索、按听力/阅读及出处筛选、收藏、查看和编辑。
6. 「资料与设置」可以新增内容、导入 Grok JSON、调整每日新学量、导出完整备份。

听写的默认声音是设备**合成语音**，不是剑雅考试录音。可在「随手练习」选择本地音频，用播放器定位；文件不上传，不跨会话保留。

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

网站不读取私人聊天，也不自动连接 Grok API。在「资料与设置」复制整理指令发给 bot，把输出的 JSON 粘贴或作为文件导入。每条必须有真实原句、出处、难点解释，以及原样出现在 sentence 中的 focus。导入全批通过校验才写入，同 id 更新内容而保留学习进度。

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
npm run build
```

浏览器测试在 Windows 默认调用本机 Chrome，CI 使用 Playwright Chromium。执行 CI 浏览器测试前运行 `npx playwright install --with-deps chromium`。`dist/` 为部署目录。站点相对路径同时支持 GitHub Pages 项目路径及独立域名。

`scripts/extract_materials.py` / `enrich_materials.py` 是一次性本地材料转换工具，需要 Python 与 pymupdf，仅在有原始个人资料的电脑上使用；网站构建不依赖它们。重提取后应执行两者并重新核对原句。

## 部署与域名

推送 `main` 自动执行测试、构建并部署 GitHub Pages。仓库 Settings → Pages 的 Source 使用 GitHub Actions。部署工作流见 [.github/workflows/pages.yml](.github/workflows/pages.yml)。

GitHub Pages 默认地址已足够使用，无需域名。以后可接入 `ielts.ourbeings.com`；先在 Pages 设置添加域名，再为子域添加指向 `bgrj.github.io` 的 CNAME 记录，等待验证并开启 HTTPS。不要为此替换已有根域站点或 nameserver。
