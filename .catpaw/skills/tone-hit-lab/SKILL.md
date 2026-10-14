---
name: tone-hit-lab
description: 使用 ai-audio 仓库与 Tone.js 创作、改编、试听和导出原创音乐，支持原声采样、独立轨道混音、短视频 Hook、循环 BGM、完整编曲及 MP3/WAV。适用于此仓库的作曲、配乐、换音色和音频导出，不接管无关网页开发。
---

# Tone Hit Lab

当前仓库维护《余温 / Afterglow》《风起时 / When the Wind Rises》《山河醒 / Mountains Awake》《墨潮 / Ink Tide》，支持 `emotional-pop`、`cinematic-guofeng` 与 `ink-tide` 制作风格。音乐任务需交付可播放的作品，自动检查不等于人工试听，也不能保证作品流行。此 Skill 随仓库共享，不自动安装到用户全局；按会话授权处理 Git 与外部发布。

## 先选择已有成品或重新制作

`releases/afterglow/` 的 full / hook / loop MP3 与 `manifest.json` 由 Git 追踪，克隆后直接播放，无需渲染。定稿为 118 BPM / F# minor / 移调 0 / seed **261013**，320 kbps、44.1 kHz、立体声；测量入口为仓库 [release manifest](../../../releases/afterglow/manifest.json)。

《风起时》的 full / hook / loop MP3 与实测 manifest 位于 `releases/when-the-wind-rises/`，同样由 Git 追踪并可直接播放；定稿为 114 BPM / D major / 移调 0 / seed 261013。

《墨潮》当前为第六版：92 BPM / D 大调和声、D 大调五声旋律 / 40 小节 / seed 261014；成品位于 `releases/ink-tide-v6/`。长笛唯一领奏、钢琴使用统一四分脉搏、弦乐与大提琴延续长和声，鼓和低音以共同拍位支撑主题。第六版的编曲取舍是制作判断，未进行人工耳听。第五版及更早的音频保留在原 release 目录。第六版高潮后八小节换用 G→A→D→Bm 和声、逐步升到 B5 并收束到 D5；`climax` MP3 为完整 WAV 约 73.04 秒起的独立母带试听片段。hook / loop 仍引用开头主段，评估高潮应听 full 或 climax。

需要改编或重新渲染时先检查已有改动。运行环境为 Node.js >=22.12、npm、Web Audio 浏览器；CLI 需要 Playwright Chromium，MP3 或响度母带另需 FFmpeg / FFprobe，MP3 需 libmp3lame。已有依赖可直接使用，缺少依赖时执行 `npm ci` / `npx --yes playwright install chromium`。

- `npm run dev`：本地试听台，默认 afterglow hook，可改变 BPM、移调与 seed；网页导出 WAV，不自动播放。
- `npm run render -- --seed 261013 --out artifacts/audio/afterglow-local`：定稿参数导出三版 MP3。CLI 默认 afterglow / all / 118 BPM / 移调 0 / seed **260713**；定稿 seed 需显式传入。
- `npm run render -- --track ink-tide --seed 261014 --format both --out artifacts/audio/ink-tide-v6-local`：导出《墨潮》第六版 full / hook / loop；`npm run render:stems -- --version hook --out artifacts/audio/ink-tide-v6-local-stems` 导出对齐的 raw 分轨，目录必须为新目录。
- `--version full|hook|loop|all`，`--bpm` 为 90–170 整数，移调为 −12–12 整数（例如 `--transpose=-2`），seed 为 uint32。`--out` 相对当前工作目录解析。
- `--format mp3|wav|both`；`--master auto|off|loudness`。auto 仅母带 MP3、保留原始 WAV，off 仅编码，loudness 也母带 WAV。详见仓库 `docs/mp3-export.md`。
- CLI 自行启动临时 Vite 服务并在结束时关闭服务和浏览器。`artifacts/`、`dist/` 被 Git 忽略；默认拒绝覆盖已有成果，保存修订用新 `--out`，明确替换传 `--overwrite`。

## 音乐简报与实际结构

按用户选择确定用途、情绪、速度、核心音色与长度。《余温》可作为短视频情绪流行电子的参考，不能把它的速度或风格当作所有作品的固定要求。传播目标转为可检查的表达：开头有主题、短句能被记住、重复有应答、鼓与低音留出旋律、循环接缝自然。调研实时趋势时给真实来源与日期，区分当日榜单、历史调查与制作判断；仓库 `docs/short-video-music-research.md` 保留本次来源及适用边界。

收到“单调”或“乱”的反馈时，重新检查主题、伴奏拍位、音区、乐句尾音和段落发展。轨道数量不作为好听的证据；增加轨道时先明确其音乐职责与真正进入的时机。判断回应是否避开主奏，要同时看谱面时值与音源释放段，记录可能持续的空间尾音。先制作可播放短段再展开，不能把读谱、响度或测试结果写成耳听结论。

《余温》主题从 beat 0 出现，完整版约 4.07 秒进入主段，结构为 **2 + 8 + 8 + 4 + 12 + 6 = 40 小节**。118 BPM 下 PCM full / hook / loop 为 **83.756 / 17.071 / 16.271 秒**。短版裁切 full 乐谱第 3–10 小节，再独立渲染；不是最终 MP3 的逐字节裁切。full / hook 分别加 2.4 / 0.8 秒尾音，loop 不加尾音。

电钢琴与电子主音交接，元音应答是原创合成乐器，不是歌手、歌词或声音模仿。所有声音由合成引擎生成；不复制已有歌曲旋律。

## 工程入口与约束

- `src/tracks/afterglow.ts`、`when-the-wind-rises.ts` / `registry.ts`：两首曲目、主题、和声、段落；`edits` 用 startBar / bars 定位短版，`resolveHarmony` 指定结尾和声。
- `src/music/types.ts`、`validation.ts`、`arrange.ts`：类型、参数和裁切边界校验，入口调用 `arrangements/emotional-pop.ts`。事件按 beat 表示，BPM 改变时间换算；seed 改变触感与合成噪声，不随意打乱旋律。
- `src/engine/emotional-pop.ts`：电钢琴、柔软主音、元音合成、鼓与低音、短空间及四个前向回声。`vocal` 只是合成乐器事件名。底鼓与 sub 保持单声道，公共混音链改变仍可能影响鼓的最终波形。
- `src/engine/render.ts`：真实 Tone.Offline 任务串行执行；每次渲染自有节点，成功或失败均释放并恢复原上下文。`renderTrack(track)` 默认 full / 曲目 BPM；`defaultOptions.bpm=118`。尾音由 `getTailSeconds` 维护。
- `src/audio/wav.ts`：PCM16 编码与 sample peak / RMS / DC / 削波 / 波形；这些指标不是 LUFS 或 true peak。
- `scripts/render.mjs` / `scripts/lib/audio-export.mjs`：Chromium 离线渲染、FFmpeg 编码和最终文件测量，不用 Node 模拟 Web Audio。缺少编码工具时先报错，不创建无效输出。
- `src/main.ts`、`src/style.css`、`scripts/check-browser.mjs`、`tests/`：试听台与检查，输入变化清理旧缓存。

墨潮第六版配置 12 条独立路由，hook 中 8 条轨道实际发声，其余轨道休止；网页对当前版本的休止轨道禁用选择。入口为 `music/ink-tide-mix.ts`、`engine/ink-tide-voices.ts`，自动化根据实际段落长度生成；`inkTide.finalResponse` 可覆盖最终主题的回答，省略时沿用 `response`，两种旋律各自验证回答是否位于留白；`renderTrack` 第三参支持 `soloTrackIds` / `muteTrackIds` / `processing: 'raw'`。分轨保留电平、声像、滤波、空间与自动化；不独立归一化、去 DC、淡边缘或母带，浮点相加还原 raw 混音。低音 ducking 仍从原乐谱底鼓驱动，静音底鼓不改变低音分轨。详情见 `docs/ink-tide-v6-production.md`。

钢琴为 Salamander Grand Piano v3 的 13 份本地采样，CC BY 3.0；长笛、小提琴组、大提琴组和竖琴为 VSCO 2 Community Edition 的 25 份本地采样，CC0 1.0。保留 `public/audio/salamander/ATTRIBUTION.md` 和 `public/audio/vsco/ATTRIBUTION.md` 的来源、作者、许可及处理记录。VSCO 的原始文件名部分相差科学音高一八度，MIDI 映射须按原 SFZ 与频率交叉核验。近邻变速、播放增益和有限 0.5–2 倍采样电平补偿不等于多力度层、round robin 或连奏；源 PCM 未归一化，长音不制作机械循环。`acoustic-samples.ts` 在全部四类采样成功解码后发布音源库，失败清理 pending，允许重试。新增风格需同步扩展类型、校验、编曲、音源、尾音与测试，不能只改标签。保留下列音频约束：

- 所有噪声由 seeded PCM 生成，不用全局 Math.random。相同环境/源码/参数的最大 PCM 差 `< 1/65536`、差值 RMS `< 1e-6`，不保证跨浏览器或文件逐位一致。
- loop 渲染三轮，截第三轮保留跨界空间尾音，再对边缘做约 3 ms 淡化；仍需实际试听接缝。
- 引擎去 DC、采用 −1.2 dBFS 采样峰值 ceiling。MP3 默认两遍 loudnorm 项目目标 −14 LUFS / −1.5 dBTP / LRA 9；以编码后 `mastering.after` 报告实测，不把目标写成结果或平台标准。
- 点击中等待 `Tone.start()`；合成后若浏览器拒绝播放，提示再次点击。播放切换不调用全局 Transport.cancel 或修改 Tone.Destination 音量。

## 交付与验证

改曲后运行 `npm test`、`npm run build` 与 `npm run test:browser`，覆盖编曲、非静音、参数边界、同 seed 复现、循环、WAV、MP3 编码与播放器。缺少 FFmpeg 的集成测试会明确 skip。检查通过不能宣称人工耳听或保证好听。

交付实际音频，列出参数、真实时长与实测电平，说明人工试听状态。用户只要现有 MP3 时直接提供对应 `releases/` 成品；仅文档任务不额外渲染。MIT 适用于软件代码，输出音乐授权需另行明确，仓库公开不自动把音频授权为 MIT；包含 Salamander 采样的音频保留 CC BY 3.0 署名。

## 曲目级旋律发展

《风起时》为 114 BPM / D major / 44 小节，结构 2 + 8 + 8 + 4 + 16 + 6，短版取第 3–10 小节。`emotionalPop.response` 在主句休止处放入电钢琴应答，伴奏避让答句；`finalHook` 从最终主段第九小节起展开主题；`bridgeHook` 提供稀疏低音区桥段；`groove: syncopated` 选两小节切分鼓与错位低音。省略配置保持《余温》行为。三个乐句数组小节数需与 hook 相同，音符在本小节内结束，应答避开主题及最终变奏。当前和弦每两小节触发，harmony 相邻两栏需同和声。新增作品应写原创主题和段落发展，不只换 seed；检索与改进记录保存在 docs/when-the-wind-rises-research.md。
