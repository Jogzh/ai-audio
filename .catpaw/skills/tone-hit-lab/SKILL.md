---
name: tone-hit-lab
description: 使用当前 ai-audio 仓库与 Tone.js 创作、改编、试听和导出原创电子音乐，包含短视频 Hook、循环 BGM、完整编曲和可复现音色。用户提到 Tone.js 作曲、做一首歌、生成声音、短视频配乐、洗脑旋律、电子节奏、换音色或导出 WAV 时使用。只适用于此音乐仓库或明确复用该仓库的任务，不接管无关网页开发，不声称能保证爆火。
compatibility: Node.js >=22.12、npm、支持 Web Audio 的浏览器；命令行音频导出需要 Playwright Chromium。
---

# Tone Hit Lab

把音乐当成作品交付，不把几行振荡器示例当作完整创作。此 Skill 随当前仓库共享；不自动安装到用户全局，也不自动发布或提交 Git。

## 快速路径

1. 找到包含 `package.json` 与 `src/tracks/neon-rebound.ts` 的仓库根目录。先检查用户已有改动；不要覆盖已有曲目。
2. 缺少依赖时执行 `npm ci`。依赖就绪则跳过安装。缺少 Chromium 时执行 `npx --yes playwright install chromium`，不安装其他浏览器或系统运行时。
3. 先完成音乐，然后用 `npm test`、`npm run build`、`npm run test:browser` 检查，运行 `npm run render` 输出三版 WAV 和电平 manifest。
4. 用户试听：`npm run dev`，打开输出的本地地址；不自动播放，建议低设备音量。

命令行接口：
- `npm run render`：默认 full / hook / loop，132 BPM、移调 0、seed 260713。
- `npm run render -- --version hook --bpm 138 --transpose 2 --seed 42 --out artifacts/audio`：只导出指定版本。
- `npm run render -- --help`：参数说明。
- 命令行导出启动自己的临时本地 Vite 服务，完成后自动关闭服务和浏览器；不需要手动保持服务器运行。
- `artifacts/` 与 `dist/` 被 Git 忽略。重跑相同参数会覆盖同名音频；需要保留不同修订或比较两次导出时使用不同的 `--out`。每次导出都会重写该目录的 `manifest.json`，其中仅记录本次选择的版本。
- 短版本固定 8 小节：loop 时长为 32 × 60 / BPM，hook 再加 0.45 秒尾音。138 BPM 的 loop 约 13.91 秒，不是精确 15 秒。要求同时保持速度、完整小节和精确时长时需说明约束并确认取舍，不伪造满足。

## 先形成音乐简报

提取风格、用途、情绪、BPM、调性、核心音色、长度、是否可循环。缺少信息且用户允许自由创作时，直接采用有辨识度的默认方案：132 BPM、F 小调、UK garage / bouncy bass、四音符 Hook、原创合成音源。

无法保证作品能火。把“有传播潜力”转换为可检查目标：首秒出现标志性音色、简短可复唱的动机、节奏留白、低音与底鼓错位、反复聆听不过度疲劳、循环接缝自然。使用原创音符与合成音色，不复制已有歌曲旋律、不使用未授权商业采样。

若用户要求调研当下音乐趋势，读取真实网页并给来源和日期。网络不可用时明确说明；技术文档或旧行业报告不能当作实时榜单。已核验的基础参考：
- https://tonejs.github.io/docs/15.1.22/functions/Offline.html
- https://tonejs.github.io/docs/15.1.22/functions/start.html
- https://tonejs.github.io/#scheduling
- https://www.ifpi.org/ifpi-releases-engaging-with-music-2022-report/ （2022 年调查，只支持音乐对短视频体验重要，不提供爆款配方。）

## 目录与职责

- `src/tracks/`：曲目数据。`neon-rebound.ts` 包含 metadata、四小节 Hook、和声和 48 小节结构。创建新曲目时增加一个文件，保留旧曲。
- `src/music/types.ts`：曲目、事件、版本和渲染接口。
- `src/music/arrange.ts`：纯编曲逻辑，按 beat 而不是秒表示事件。速度改变时间换算而不改变拍位置（包络与尾音不一定等比伸缩）；seed 改变踩镲、打击乐力度与合成噪声，不随意打乱旋律。
- `src/music/random.ts`：有 seed 的确定性随机源。
- `src/engine/instruments.ts`：Tone.js 合成器、鼓、种子噪声、效果链与侧链式 ducking；每次渲染拥有自己的节点。
- `src/engine/render.ts`：序列化 Tone.Offline 任务、完整/精华/循环版、后处理。仅在回调里创建与调度节点，最后 dispose。
- `src/audio/wav.ts`：PCM16 WAV、采样峰值/RMS/DC/削波检测及波形。不是 LUFS 或 true-peak 测量。
- `src/main.ts` 与 `src/style.css`：本地试听台，播放器与导出按钮，输入更改会清缓存。
- `scripts/render.mjs`：真实 Chromium OfflineAudioContext 导出，不用 Node 模拟 Web Audio。
- `scripts/check-browser.mjs`、`tests/`：音频/播放器与纯函数验证。

新曲目需要让界面与 CLI 选择相同 TrackDefinition；当前入口默认固定 `neonRebound`。不要只新增文件而仍导出旧曲。若结构不是 48 小节，还应更新界面固定的结构文案和相关测试，不伪造时长。

## 作曲与混音约束

- 原始曲目：《霓虹回弹 / Neon Rebound》，核心四音 C–Ab–F–Eb；和声 Fm(add9) / Dbmaj7 / Abmaj9 / Eb(add9)。重音、休止与应答制造辨识度。
- 完整编曲 4 + 8 + 4 + 8 + 8 + 12 + 4 = 48 小节；build 后留空拍，第二次 drop 增加高音应答。
- full 约 89.27 秒（含 2 秒尾音）；hook 约 15 秒；loop 精确 8 小节约 14.55 秒，总共渲染三轮并截取第三轮（前两轮预热），保留循环跨界的混响/延迟，边缘 3ms 淡化降低点击。不承诺绝对听不出接缝，仍需试听。
- 保留单声道兼容低频；底鼓、sub 不加宽，旋律可轻微声像和延迟。
- 保持 peak ceiling -1.2 dBFS 的采样峰值目标、清除 DC、零满幅削波。峰值归一化不等于平台响度母带；不要虚报 -14 LUFS。
- 所有噪声用 seeded PCM；不用全局 Math.random。复现时同时保持曲目源码、音色、版本、BPM、移调、seed 与引擎环境。现有检查使用浮点 PCM 容差 < 1e-6，不保证 WAV 字节完全一致或跨浏览器逐位一致。
- 换温暖音色需要修改 `src/engine/instruments.ts` 中旋律/和声合成器的振荡器、包络和效果；当前没有音色 preset CLI 参数。保留鼓事件、BPM、seed 与鼓音源，可保留鼓点；公共混音链变化可能改变鼓的最终波形。
- 不为播放切换调用全局 Transport.cancel 或修改 Tone.Destination 音量；避免渲染影响其他音频实例。并发 Offline 调用须排队。
- 实时启动在点击中等待 `Tone.start()`；异步合成后若浏览器拒绝播放，提示再次点击。禁止偷偷自动播放。

## 交付与验收

实际产生 WAV，不只报告代码写好了。列出文件、真实时长、采样率、声道和实测 peak/RMS/削波数，说明是否有人耳试听。提供简洁命令和扩展入口。初始仓库已经初始化 Git，但没有自动 commit 或远程推送。

检查：构建与纯函数测试、真实浏览器非静音渲染、相同种子复现、参数边界、循环长度/边缘、导出 WAV 头和文件长度、点击播放/暂停/停止/seek、版本更改缓存清除、非法输入与移动端横向溢出。保留对主观听感的诚实限制，不把数值通过当作“保证好听”。

可用于后续人工试听的提示示例（无需未经要求批量生成评测作品）：
1. “用这个仓库做一段约 14 秒、适合转场的明亮循环，138 BPM，保留回弹旋律。”
2. “保留鼓点，换成更温暖的音色，导出完整版与 Hook。”
3. “同一个 seed 导出两次，检查 WAV 和电平；将 BPM 调成 100 后确认小节数不变。”
