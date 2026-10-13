---
name: tone-hit-lab
description: 使用 ai-audio 仓库与 Tone.js 创作、改编、试听和导出原创电子音乐，支持短视频 Hook、循环 BGM、完整编曲及 MP3/WAV。适用于此仓库的作曲、短视频配乐、换音色和音频导出，不接管无关网页开发。
---

# Tone Hit Lab

把音乐当成作品交付，不把几行振荡器示例当作完整创作。此 Skill 随当前仓库共享；不自动安装到用户全局，也不自动发布或提交 Git。

运行环境：Node.js >=22.12、npm、Web Audio 浏览器；CLI 需要 Playwright Chromium，MP3/响度母带另需 FFmpeg、FFprobe（MP3 需 libmp3lame）。

## 快速路径

1. 找到包含 `package.json` 与 `src/tracks/registry.ts` 的仓库根目录。先检查用户已有改动；不要覆盖已有曲目。
2. 缺少依赖时执行 `npm ci`。依赖就绪则跳过安装。缺少 Chromium 时执行 `npx --yes playwright install chromium`，不安装其他浏览器或系统运行时。
3. 完成音乐后用 `npm test`、`npm run build`、`npm run test:browser` 检查，运行 `npm run render` 默认输出三版 MP3、manifest 与编码前后实测母带报告。
4. 用户试听：`npm run dev`，打开输出的本地地址；不自动播放，建议低设备音量。

命令行接口：
- `npm run render`：默认 `afterglow`（余温，118 BPM），版本 all（full / hook / loop），移调 0、seed 260713，MP3 320 kbps。五首可选作品：`afterglow` / `moonlit-sway` / `velvet-hour` / `amber-tides` / `neon-rebound`。
- `npm run render -- --track afterglow --version hook --seed 261013 --out artifacts/audio/afterglow-v2`：只导出指定版本。BPM 为 90–170 整数，移调为 −12–12 整数（负数用 `--transpose=-2`），seed 为 uint32；`--out` 相对当前工作目录解析。
- `--format mp3|wav|both`，默认 mp3；`--master auto|off|loudness`，auto 仅母带 MP3、保留原始 WAV，off 仅编码，loudness 也母带 WAV。制作目标 −14 LUFS / −1.5 dBTP / LRA 9 不是平台标准；两遍 FFmpeg loudnorm 后测量最终编码文件，如实报告目标偏差。详见仓库 `docs/mp3-export.md`。
- 界面默认试听 `afterglow` 的 hook，网页导出 WAV；CLI 与界面共用五首曲目注册表。引擎 `renderTrack(track)` 省略 options 时默认 full / `track.meta.bpm`；静态 `defaultOptions.bpm=132` 不代表所有曲目的默认速度。
- `npm run render -- --help`：参数说明。
- 命令行导出启动自己的临时本地 Vite 服务，完成后自动关闭服务和浏览器；不需要手动保持服务器运行。
- `artifacts/` 与 `dist/` 被 Git 忽略。默认拒绝覆盖已有同名音频、sidecar 或 manifest；保存修订时用新 `--out`，明确替换时传 `--overwrite`。manifest 记录本次选择的版本，`filename` 为主要输出，有 MP3 时优先 MP3；`files` 列出各格式实际时长与参数。
- 短版本为 8 小节：loop 时长 32 × 60 / BPM，hook 另加风格尾音。full / hook 尾音：emotional-pop 2.4 / 0.8 秒、disco-house 2.5 / 0.9 秒、warm-house 3 / 1.4 秒、garage（production 为 undefined）2 / 0.45 秒。MP3 容器时长可能含编码填充，音频内容时长以 PCM 帧为准；不要把约 15 秒写成精确 15 秒。

## 先形成音乐简报

提取风格、用途、情绪、BPM、调性、核心音色、长度、是否可循环。短视频情绪流行电子可参考《余温》的 118 BPM / F# 小调、电钢琴主题与电子应答；新作品按用户简报选择方向，改编已有曲目优先沿用其 metadata BPM。

无法保证作品能火。把“有传播潜力”转换为可检查目标：首秒出现标志性音色、简短可复唱的动机、节奏留白、低音与底鼓错位、反复聆听不过度疲劳、循环接缝自然。使用原创音符、合成音色或明确授权音源，不复制已有歌曲旋律、不使用未授权商业采样。

若用户要求调研当下音乐趋势，读取真实网页并给来源和日期。网络不可用时明确说明；技术文档或旧行业报告不能当作实时榜单。已核验的基础参考：
- https://tonejs.github.io/docs/15.1.22/functions/Offline.html
- https://tonejs.github.io/docs/15.1.22/functions/start.html
- https://tonejs.github.io/#scheduling
- https://www.ifpi.org/ifpi-releases-engaging-with-music-2022-report/ （2022 年调查，只支持音乐对短视频体验重要，不提供爆款配方。）

## 目录与职责

- `src/tracks/`：曲目数据与五首作品注册表，默认 `afterglow.ts`（118 BPM / F# minor / 40 小节）。旧作 `moonlit-sway`（116 BPM / D minor / 48 小节）、`velvet-hour`（120 BPM / A minor / 56 小节）、`amber-tides`（112 BPM / F# minor / 48 小节）、`neon-rebound`（132 BPM / F minor / 48 小节）继续保留。
- `src/music/types.ts`：曲目、事件、版本和渲染接口。
- `src/music/arrange.ts`：分发到 `arrangements/garage.ts`、`warm-house.ts`、`disco-house.ts`、`emotional-pop.ts`；`validation.ts` 校验曲目、参数与 edits。事件按 beat 表示，速度改变时间换算；seed 改变触感和合成噪声，不随意打乱旋律。
- `src/music/random.ts`：有 seed 的确定性随机源。
- `src/engine/instruments.ts`：Tone.js 合成器、鼓、授权采样、种子噪声、效果链与侧链式 ducking；每次渲染拥有自己的节点及每个单次 ToneBufferSource，不依赖 sampler 提前清空的活动 source 列表。
- `src/engine/emotional-pop.ts`：独立无采样音源，包含电钢琴、柔软主音、元音合成器、短空间、延迟和轻 ducking。`vocal` 是合成乐器事件名，不是歌手录音、歌词或声音模仿。
- `src/engine/sample-library.ts` 与 `src/audio/samples/`：本地采样加载与署名。原声吉他 C4/F4/A4/C5；电贝斯 E2/G2/A#2/C#3（升号文件名为 As2.mp3 / Cs3.mp3）。8 个原始 MP3 约 1.6 MB，源为 nbrosowsky/tonejs-instruments，revision 622c2f1c32c8cfce4158ddc3eb26e518ddef37e5，CC BY 3.0；N. P. Brosowsky 编辑，原始录音分别来自 University of Iowa 与 Karoryfer。
- `src/engine/render.ts`：序列化 Tone.Offline 任务、完整/精华/循环版、后处理。采样在 Offline 前预加载，以固定 44100 Hz 解码；仅在回调里创建与调度节点，不在其中 fetch 或创建实时 sampler。输出固定 44100 Hz / 双声道，结束时 dispose 自有节点并恢复原上下文。尾音由此文件的 `getTailSeconds(track, version)` 统一维护；后处理异常也必须释放离线缓冲。
- `src/audio/wav.ts`：PCM16 WAV、采样峰值/RMS/DC/削波检测及波形。不是 LUFS 或 true-peak 测量。
- `src/main.ts` 与 `src/style.css`：本地试听台，播放器与导出按钮，输入更改会清缓存。
- `scripts/render.mjs`：Chromium OfflineAudioContext 渲染；`scripts/lib/audio-export.mjs` 做 FFmpeg 依赖预检、MP3 编码、两遍 loudnorm 与最终文件实测。原始 WAV 导出不依赖 FFmpeg。
- `scripts/check-browser.mjs`、`tests/`：音频/播放器与纯函数验证。

新曲目实现 TrackDefinition（metadata、hook、harmony、含 bars / energy 的 arrangement），在 `src/tracks/registry.ts` 注册。production 支持 emotional-pop / warm-house / disco-house 或 undefined（garage）；新 style 同步扩展类型、编曲、音源与尾音。emotional-pop 的 `edits` 用 startBar / bars 指向完整乐谱段落，再裁切短版本；`resolveHarmony` 指定结尾和声。结构变化时同步界面和测试。

## 作曲与混音约束

- 保留原有 garage 曲目：《霓虹回弹 / Neon Rebound》，核心四音 C–Ab–F–Eb；和声 Fm(add9) / Dbmaj7 / Abmaj9 / Eb(add9)。重音、休止与应答制造辨识度。
- 霓虹回弹完整编曲 4 + 8 + 4 + 8 + 8 + 12 + 4 = 48 小节；build 后留空拍，第二次 drop 增加高音应答。不要套用到 56 小节的微醺舞步。
- 余温原速 118 BPM 的 PCM full / hook / loop 为 **83.756 / 17.071 / 16.271 秒**；主题从 beat 0 出现，full 主段约 4.07 秒进入，短版本从该主段（第 3–10 小节）裁切同一完整谱面。full 为 2 + 8 + 8 + 4 + 12 + 6 = 40 小节。
- 原速 PCM 时长：月光轻摇 101.81 / 17.45 / 16.55 秒，微醺舞步 114.50 / 16.90 / 16.00 秒，晚风来信 105.86 / 18.54 / 17.14 秒，霓虹回弹 89.27 / 15.00 / 14.55 秒。loop 渲染三轮、截第三轮，保留跨界空间尾音并以 3 ms 淡化边缘；接缝仍需实际试听。
- 保留单声道兼容低频；底鼓、sub 不加宽，旋律可轻微声像和延迟。
- 引擎保持 −1.2 dBFS 采样峰值目标、清除 DC、零满幅削波；源 `stats` 不等于最终文件响度。以 `.mastering.json` / `mastering.after` 的实测值报告 LUFS / true peak，不把制作目标写成测量结果或平台认证。
- 所有噪声用 seeded PCM；不用全局 Math.random。复现时保持曲目源码、音色、版本、BPM、移调、seed 与引擎环境。旧音源 PCM 最大差容差 < 1e-6；emotional-pop 最大差 < 1/65536（半个 PCM16 量化步长）且差值 RMS < 1e-6。新回声用四个前向延迟避免反馈环的处理块漂移；不保证 WAV 字节完全一致或跨浏览器逐位一致。
- 修改对应风格的音源模块改变振荡器、包络和效果；当前没有音色 preset CLI 参数。保留鼓事件、BPM、seed 与鼓音源可保留鼓点，公共混音链变化仍可能改变最终鼓波形。
- 不为播放切换调用全局 Transport.cancel 或修改 Tone.Destination 音量；避免渲染影响其他音频实例。并发 Offline 调用须排队。
- 实时启动在点击中等待 `Tone.start()`；异步合成后若浏览器拒绝播放，提示再次点击。禁止偷偷自动播放。

## 交付与验收

音乐创作任务实际交付用户需要的音频，通常为可直接播放的 MP3；仅文档任务不额外渲染。列出真实时长、采样率、声道与实测电平，说明是否实际人工试听；自动检查通过不能写成人耳验收。按会话授权处理 Git，不从本 Skill 推断 commit、push 或部署许可。

本地原始采样文件未修改；播放会转单声道、裁剪起始静音、去 DC、变调并应用 EQ / 包络。重分发采样或发布包含采样的音频时保留 authors / source / license link / modifications。CLI 为实际使用采样的输出写入同名 `.credits.json` 与 manifest；页面提供独立署名下载入口，浏览器多文件下载被阻止时可单独下载。MIT 仅覆盖自有软件代码，不覆盖第三方采样或输出音乐；仓库公开不等于音乐自动获 MIT 授权。

检查：构建与编曲测试、真实浏览器非静音渲染、同 seed 复现、参数边界、循环长度/边缘、WAV 头、MP3 编码后响度与时长、缺少 FFmpeg 不产无效输出，以及播放器行为。自动检查不替代人工试听，不保证作品好听或流行。

可用于后续人工试听的提示示例（无需未经要求批量生成评测作品）：
1. “用这个仓库做一段约 14 秒、适合转场的明亮循环，138 BPM，保留回弹旋律。”
2. “保留鼓点，换成更温暖的音色，导出完整版与 Hook。”
3. “同一个 seed 导出两次，检查 WAV 和电平；将 BPM 调成 100 后确认小节数不变。”
