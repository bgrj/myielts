# Grok → MyIELTS 内容发布规则

学习网址：**https://ourbeings.com/ielts/**；仓库 `bgrj/myielts`，分支 `main`。

用户已确认两个Grok bot已连接GitHub并具备本仓库写权限。把 [阅读完整指令](prompts/reading.txt) 与 [听力完整指令](prompts/listening.txt) 分别发送给对应bot，保存为长期规则。网站不能代替Grok修改私人记忆或审批设置；bot实际返回提交链接后才算首次连接验证完成。

## 阅读：围绕用户反馈的难点

botId：`0eca5200-224b-4af8-b13a-6fd4f4762592`；只更新 `content/reading.json`。

根据生词、搭配、语法疑问及“再加几个”整理，不扩充未经反馈的陌生词库，不自动推进下一篇。知识点配真实剑雅原句、书册/Test/Passage、整句翻译和针对性解释，必要时补音标、发音、搭配、易错点；无依据的词源留空。原文、题干和脚注分开标明，核对材料后才标 `sourceVerified:true`。

初始阅读213条，见 `web/data/cards.json` 中kind为reading的记录；沿用稳定id，补充到同一篇。例如 `versatile` 为 `c17-t1-p2-126`。阅读发布要求 `feedback/note/originalRef/translation` 非空。

## 听力：完整原声逐句课程，包含播音员

botId：`e79fc4f8-184b-450b-b10e-a21f91070599`；负责 `content/listening.json`、必要的 `content/audio/` 原音和听力来源清单，不改阅读或网页代码。

**课程依据是完整原声，不是用户反馈的难片段清单。** ANNOUNCER的出版开场、考试规则、读题指令、示例说明、段间提示、结束检查提示，以及所有人物对话或讲述，全部逐句覆盖。按音频位置保留真实短答、重复示例与未说完的句子，不删播音员，也不补写原声不存在的句子。

目前只开放：

| lessonId | 场景 | 原声句数 | ANNOUNCER |
|---|---|---:|---:|
| self-drive | 自驾游预订 · 剑雅10 Test1 Section1 | 116 | 23 |
| leisure-club | 健身俱乐部 · 剑雅10 Test1 Section2 | 41 | 8 |

用户完成两场景一轮练习与复习后，**再明确要求第三场景**，才加入第三部分；禁止自动推进。新课程的release为user-request，releaseNote记录用户明确要求，保留前两课程。不能凭时间、聊天或仅完成听写推定已完成复习。

后续反馈只用于补充对应句子的 `feedback/personalError/ipa/pronunciation/grammar/note/collocations` 等，保留所有原句、id、lessonId、order、speaker、原音、出处和翻译，不能把157句课程改回38个片段。听力课程无需每句都有用户反馈。

`content/listening-source-transcripts.json` 保存完整双语文本与完整原声归档地址；`content/listening-audio-manifest.json` 保存157个片段的SHA256、来源与起止时间。先复用现有文件。旧 `content/audio-manifest.json` 的38片段仅是历史归档，不作为当前课程。

每句必填 `lessonId`、从1连续的order、speaker、真实sentence、translation、originalRef、audioSource与 `audio:{url,start,end}`。URL为HTTPS，片段0–300秒，严禁TTS或合成声音。新MP3先上传 `content/audio/<稳定id>-<哈希>.mp3` 并验证可播放，再发布JSON。播放URL为 `https://ourbeings.com/ielts/recordings/<文件名>.mp3`。每句文件放一遍，三遍且间隔3秒由网页处理。lessons的sentenceCount/announcerCount必须与真实完整课程匹配。

## 材料与权限

用户指定的整套真题按原目录通过Git LFS归档，见 [MATERIALS.md](MATERIALS.md) 和MATERIALS.json。读取实际文件，不把LFS指针当音频或教材；按当前练习定位，不重复上传整套资料。

用户授权两个bot在各自范围直接发布整理后的学习内容，无需逐次复制JSON。不能改网页代码、母版或另一bot内容，不上传整段私人聊天及凭据。botId只是分类字段，不是认证密码。如果Grok仍要求权限确认，请展示具体连接卡步骤，不索取明文token，不虚称已发布。

## 发布与核对

完整格式见 `content/schema.json`；运行校验在 `web/publishing.js`、`web/listening.js`。内容文件为累计快照。

1. 读取main最新JSON及SHA，沿用已有稳定id。
2. 增量为 `{schemaVersion:1,kind,botId,cards:[...]}`；新增听力课程时还传合并后的完整lessons清单。
3. 在已有安全GitHub登录下执行：

```sh
node scripts/publish-feedback.mjs --input /tmp/feedback.json --check
node scripts/publish-feedback.mjs --input /tmp/feedback.json
```

脚本使用已登录gh，不接受token参数。重读SHA、合并、revision加1、updatedAt用真实时间；409/422最多重读三次。用GitHub app时遵守相同校验和SHA条件写入，不强推旧快照。

4. 写入后读取 `https://ourbeings.com/ielts/feeds/<reading或listening>.json?v=<时间戳>` 核对revision和id；听力同时核对完整句序及播音员句数。
5. 返回真实提交链接、更新数、学习网址；失败保留草稿并说明原因，不能只生成JSON便声称已同步。

网站打开、回前台及每60秒检查GitHub内容源，不需要Vercel重新部署。拒绝倒退、同版变化、缺原文、听力缺原音或完整句序的更新；离线保留有效版本。作答编辑期间延后应用，保留评分、收藏、个人编辑和排期。学习进度在本人浏览器，不自动传给bot或其他设备，可用完整备份迁移。

复习结合主动回忆和间隔阶梯：忘了10分钟重学；记住按1、3、7、14、30、60、120天拉开，吃力缩短、轻松跳阶。固定天数只是起点，不是个人遗忘曲线的精确预测。
