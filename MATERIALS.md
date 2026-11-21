# 完整剑雅资料目录

用户明确要求把本地 `剑桥雅思真题1-20【真题＋新方法解析＋音频】` 中全部资料推送到本仓库。当前清单有 **448 个文件、4,382,161,008 字节（约 4.08 GiB）**：410 个 MP3、36 个 PDF 和 2 个 JPG。

所有原文件保留目录结构，使用 **Git LFS** 保存。普通 Git 树里显示的是指针；实际完整文件存放在本仓库对应的 LFS 存储。没有拆小、降低音质或只上传目录清单。原文件的每项路径、大小、SHA-256 及实际下载地址见 [MATERIALS.json](MATERIALS.json)。

## 下载

在安装了 Git LFS 的电脑上：

```sh
git lfs install
git clone https://github.com/bgrj/myielts.git
cd myielts
git lfs pull
```

只取某份资料时，先跳过大文件自动下载，再按清单选择准确路径：

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/bgrj/myielts.git
cd myielts
git lfs pull --include="<MATERIALS.json 中的准确路径>"
```

也可使用清单中的 `downloadUrl` 获取实际文件。不要把普通 raw.githubusercontent.com 返回的 LFS 指针文本当成 PDF 或 MP3。GitHub 网页通常也会提供下载实际文件的入口。

## 给 Grok bot

优先读取清单，按用户正在练习的书册/Test/Passage/Section 获取需要的 PDF 或原音。无需每次下载全部 4.08 GiB。原音来自这些真实录音；合成语音不能用于替代听力练习。

当前听力按完整场景的原声顺序逐句听写，包含ANNOUNCER。短片段放在 `content/audio/`，正常Git保存，网页按需加载当前句，不在打开网页时下载整套资料。反馈用于补充对应句子的解释，不能删成反馈片段集。

新剪出的片段应使用带内容哈希的文件名，保留原音、精确边界与来源。当前157句及完整录音的索引见 `content/listening-audio-manifest.json`、`content/listening-source-transcripts.json`；旧 `content/audio-manifest.json` 的38个难片段仅作归档。未核实原音的课程先保留草稿，不用合成音代替。

仓库程序代码的 LICENSE 不改变这些第三方试题、音频和解析资料原有的权利归属。
