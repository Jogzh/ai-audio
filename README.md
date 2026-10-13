# ai-audio

用 **Tone.js** 编写原创电子音乐，在本地浏览器试听，并导出 full（完整编曲）、hook（精华片段）、loop（循环 BGM）。CLI 默认直接输出 **MP3**，支持 WAV 或双格式；网页试听台导出 WAV。

默认作品是《余温 / Afterglow》：118 BPM、F# 小调的情绪流行电子，电钢琴与柔软电子主音交替陈述主题。首次主题从 beat 0 出现，完整曲主段约在 **4.07 秒**进入；hook / loop 从同一完整乐谱的第 3–10 小节裁切，再独立离线渲染。

制作方向、已核验资料与短视频验证方法见 [调研与制作简报](docs/short-video-music-research.md)。

音符、和声、节奏与结构由曲目数据和编曲逻辑决定；音源结合合成器与本地授权采样。《余温》的元音应答是**合成乐器音色**，没有歌手录音、歌词或声音模仿。命令行通过真实 Chromium 的 `OfflineAudioContext` 执行 `Tone.Offline` 渲染，再用 FFmpeg 编码 MP3。项目未调用 AI 音乐服务。

## 快速开始

需要 Node.js **>=22.12**（推荐 **22 LTS**）、npm，以及支持 Web Audio 的现代浏览器。

```bash
git clone https://github.com/Jogzh/ai-audio.git
cd ai-audio
npm ci
npm run dev
```

打开终端输出的本地地址，**端口以实际输出为准，不一定是 5173**。先调低设备音量，再点击播放；页面不会自动播放。首次合成可能需要等待，页面支持曲目、版本、BPM、移调、种子选择及播放、暂停、停止、进度跳转和导出。

命令行导出需要 Chromium；默认 MP3 还需要已加入 PATH 的 **FFmpeg / FFprobe**，FFmpeg 须包含 `libmp3lame`：

```bash
npx --yes playwright install chromium
npm run render -- --track afterglow --out artifacts/audio/afterglow-v2
```

上述命令默认导出 **all = full + hook + loop**。脚本自行启动临时本地 Vite 服务，结束后关闭浏览器和服务，无须先运行 `npm run dev`。

## 内置作品与时长

下表对应原始 BPM、移调 0、seed 260713，列出渲染 PCM 的秒数。full / hook 包含尾音，loop 不额外添加尾音；MP3 容器可能因编码填充略长，最终实测见 manifest。

| 曲目 ID / 名称 | BPM | 原始调性 | full 小节数 | full | hook | loop |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `afterglow` / 余温（默认） | 118 | F# minor | 40 | 83.756 | 17.071 | 16.271 |
| `moonlit-sway` / 月光轻摇 | 116 | D minor | 48 | 101.81 | 17.45 | 16.55 |
| `velvet-hour` / 微醺舞步 | 120 | A minor | 56 | 114.50 | 16.90 | 16.00 |
| `amber-tides` / 晚风来信 | 112 | F# minor | 48 | 105.86 | 18.54 | 17.14 |
| `neon-rebound` / 霓虹回弹 | 132 | F minor | 48 | 89.27 | 15.00 | 14.55 |

三种入口的默认值不要混淆：

- **界面**：默认曲目 `afterglow`，初始版本为 `hook`；切换曲目时使用该曲目 metadata BPM。
- **CLI**：默认曲目 `afterglow`，版本为 `all`，BPM 默认取所选曲目的 `meta.bpm`。
- **引擎**：调用 `renderTrack(track)` 且省略 options 时，默认 `full` 和该曲目的 `meta.bpm`；不会替调用者选择曲目。静态 `defaultOptions.bpm` 为 132，不代表所有曲目的默认速度。

## 命令行参数与输出

```bash
npm run render -- --track afterglow --seed 261013 --out artifacts/audio/afterglow-v2
npm run render -- --track amber-tides --version hook --bpm 112 --transpose 2 --seed 42 --out artifacts/audio/amber-tides
npm run render -- --track moonlit-sway --format wav --out artifacts/audio/moonlit-sway-wav
npm run render -- --help
```

| 参数 | 范围 / 含义 | 默认 |
| --- | --- | --- |
| `--track` | `afterglow`、`moonlit-sway`、`velvet-hour`、`amber-tides`、`neon-rebound` | `afterglow` |
| `--version` | `all`、`full`、`hook`、`loop` | `all` |
| `--bpm` | 90–170 的整数 | 所选曲目的 `meta.bpm` |
| `--transpose` | −12–12 的整数，单位为半音 | 0 |
| `--seed` | uint32 整数：0–4294967295 | 260713 |
| `--out` | 输出目录；相对路径以**当前工作目录**解析，也可用绝对路径 | `artifacts/audio` |
| `--format` | `mp3`、`wav`、`both` | `mp3` |
| `--master` | `auto`（仅母带 MP3）、`off`、`loudness`（也母带 WAV） | `auto` |
| `--overwrite` | 明确允许覆盖已有同名成果 | 关闭 |

负数参数使用等号形式，例如 `--transpose=-2`。文件名包含曲目、版本、BPM、移调与 seed，例如 `afterglow-hook-118bpm-t0-s261013.mp3`。输出为 **320 kbps MP3** 或 **PCM16 WAV**，均为立体声、44.1 kHz。

- 默认拒绝覆盖同名成果和已有 `manifest.json`；比较修订时使用新的 `--out`，明确替换时传 `--overwrite`。manifest 记录本次选择的版本。
- manifest 包含参数、实际时长、段落、文件格式、采样率、声道、署名与原始 PCM 统计。使用 FFmpeg 时，同名 `.mastering.json` 记录编码前后实测 LUFS / true peak / LRA；第三方采样另有 `.credits.json`。
- `artifacts/` 与 `dist/` 被 Git 忽略；克隆仓库不等于下载已有渲染音频，应本地生成。

MP3 默认使用两遍 loudnorm，项目制作目标为 **−14 LUFS / −1.5 dBTP / LRA 9**，并测量最终编码文件。目标不代表抖音或小红书的官方标准；源动态与有损编码可能导致实测偏差。原始 WAV 默认不做这一步，且无需 FFmpeg。详细字段与模式见 [MP3 导出说明](docs/mp3-export.md)。

### 音乐长度、尾音与循环

当前每小节 4 拍：**音乐时长 = 小节数 × 4 × 60 / BPM**。hook 与 loop 均为 8 小节，即 `32 × 60 / BPM`；full 使用曲目的完整小节数。full / hook 的文件时长还需加上对应尾音：

| `production` | full 尾音 | hook 尾音 | loop 尾音 |
| --- | ---: | ---: | ---: |
| `emotional-pop`（余温） | 2.4 s | 0.8 s | 0 |
| `disco-house`（微醺舞步） | 2.5 s | 0.9 s | 0 |
| `warm-house`（晚风来信） | 3 s | 1.4 s | 0 |
| `undefined`（原有 garage / 霓虹回弹） | 2 s | 0.45 s | 0 |

loop 总共渲染三轮，前两轮预热，截取第三轮以保留跨轮的混响与延迟，并对边缘做约 **3 ms** 淡化。最终时长按 44.1 kHz 帧数取整；不承诺绝对无感接缝，仍需试听。

例如 138 BPM 的 loop 约 13.91 秒，并非精确 15 秒。若同时要求固定 BPM、完整小节与精确秒数，需要取舍或另行编辑。

### 电平与复现边界

引擎后处理清除 DC，并以 **−1.2 dBFS 采样峰值 ceiling** 为目标。manifest 的源 `stats` 是采样 peak / RMS / 削波，最终文件的 integrated LUFS 与 oversampled true peak 在 `mastering.after`。数值检查不替代人工试听，也不能证明传播效果。

复现需保持曲目源码、音色、版本、BPM、移调、seed、依赖及浏览器/引擎环境一致。旧音源同 seed 检查采用浮点 PCM 最大差值 **< 1e-6**；新流行电子音源采用最大差值 **< 1/65536**（半个 PCM16 量化步长），并要求差值 RMS **< 1e-6**，容纳原生处理的微小浮点差异。回声使用四个前向延迟，避免反馈环引起处理块位置变化。不保证 WAV 字节完全一致，也不保证跨浏览器逐位一致。

## 目录与扩展

```text
ai-audio/
├── src/
│   ├── tracks/                # 曲目数据与 registry.ts
│   ├── music/                 # 类型、validation.ts、编曲分发与随机源
│   │   └── arrangements/      # garage / warm-house / disco-house / emotional-pop
│   ├── engine/                # 旧音源、独立 emotional-pop 音源、离线渲染
│   ├── audio/                 # WAV 编码与本地 samples/
│   ├── main.ts                # 试听台与下载
│   └── style.css
├── scripts/                  # CLI、lib/audio-export.mjs、真实浏览器检查
├── tests/                    # 编曲、WAV、真实 FFmpeg MP3 导出测试
├── docs/mp3-export.md         # 母带模式与实测字段
├── .github/workflows/ci.yml   # 检查工作流，不部署
├── .catpaw/skills/tone-hit-lab/SKILL.md
└── artifacts/audio/          # 本地导出，Git 忽略
```

新增作品时：

1. 在 `src/tracks/` 增加实现 `TrackDefinition` 的曲目文件：填写唯一 metadata ID 与 BPM、`hook` 动机、`harmony` 和声，以及含小节数和 `energy` 的 `arrangement` 段落。保留已有作品，不复制已有歌曲旋律或使用未授权商业采样。
2. 在 `src/tracks/registry.ts` 导入并加入注册表，让界面与 CLI 使用同一曲目定义；需要改变默认曲目时同步调整默认入口。**只增加文件、不注册，入口仍会选择旧曲。**
3. `production` 支持 `emotional-pop`、`warm-house`、`disco-house`，或省略为 `undefined`（原有 garage）。`src/music/arrange.ts` 分发到 `arrangements/` 的风格模块，`validation.ts` 校验数据与 edits 边界。新增风格需同步扩展类型、编曲、音源选择与尾音处理。

`emotional-pop` 使用独立的 `src/engine/emotional-pop.ts`：电钢琴、旋律主音、元音合成器、短空间与延迟、单声道低频及轻 ducking，全部为原创合成音色。《余温》的 `edits` 将 hook / loop 定位到 full 乐谱主段，短版本保留该段旋律、和声与节奏；旧曲使用各自原有编曲模块和授权采样。

《月光轻摇》使用 `disco-house` 的 `grooveIntensity: 0.72`，降低鼓、贝斯与节奏风琴力度，保留吉他主题和和声的音量。该可选字段范围为大于 0 且不超过 1，省略时为 1；只适用于 `disco-house`。可访问 `/?track=moonlit-sway&version=hook` 直接试听新作品。

尾音规则集中在 `src/engine/render.ts` 的 `getTailSeconds(track, version)`，渲染与浏览器时长检查共用该规则。

采样在进入 `Tone.Offline` 前预加载并以固定 44100 Hz 解码；Offline 任务串行执行，每次渲染独立拥有节点及每个单次 source，完成后释放节点并恢复原上下文。扩展音源时保留这些生命周期约束，避免在 Offline 回调内异步加载或依赖实时 sampler。

## 本地检查与 CI

```bash
npm test
npm run build
npm run check
npx --yes playwright install chromium
npm run test:browser
```

`npm run check` 等价于 `npm test && npm run build`；浏览器检查另行执行，覆盖真实音频渲染与播放器行为，不代替人耳验收。

`.github/workflows/ci.yml` 配置为在 push、pull request 或手动触发时运行检查：Node 22、`npm ci`、测试与构建、安装 Chromium 及系统依赖、真实浏览器检查。**仅检查，不部署；这里描述配置，不声称 CI 已通过。**

## 采样来源、署名与许可

`src/audio/samples/` 内有 **8 个 MP3，合计约 1.6 MB**，来自 [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)，固定 revision：`622c2f1c32c8cfce4158ddc3eb26e518ddef37e5`，许可为 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。署名信息维护在 `src/engine/sample-library.ts`。

| 音源 | 本地文件 / 音高 | 作者与原始录音 |
| --- | --- | --- |
| 原声吉他 | `guitar-acoustic/C4.mp3`、`F4.mp3`、`A4.mp3`、`C5.mp3` | N. P. Brosowsky（采样编辑）；University of Iowa（原始录音） |
| 电贝斯 | `bass-electric/E2.mp3`、`G2.mp3`、`As2.mp3`（A#2）、`Cs3.mp3`（C#3） | N. P. Brosowsky（采样编辑）；Karoryfer（原始录音） |

仓库保留的原始采样文件**未修改**；播放时会转换为单声道、裁剪起始静音、去 DC、变调，并施加 EQ / 包络。这些播放处理会列入署名的 modifications。

- [LICENSE](LICENSE) 中的 **MIT 仅适用于本仓库自有软件代码**，不包含第三方采样或输出音乐；第三方依赖同样遵守各自许可。
- 重分发采样或发布包含采样的音频时，应保留作者、来源、许可链接与 modifications 说明。CLI 输出的 `.credits.json` 和 manifest 提供这些信息；页面也有**单独下载音源署名**入口。
- 下载 MP3 / WAV 不代表署名已嵌入音频；请一并保留或在发布页面提供署名。未返回外部采样署名，也不代表作品自动采用 MIT。
- 仓库公开或 `package.json` 声明 MIT，**不会自动把输出音乐授权为 MIT**；音频发布者需另行明确作品授权范围并遵守音源许可。

## 常见问题

- **双击 `index.html` 显示启动提示**：本地文件地址无法加载模块。运行 `npm run dev`，或构建后运行 `npm run preview`，访问终端输出的 HTTP 地址。
- **找不到 Chromium / executable doesn't exist**：在 `npm ci` 后执行 `npx --yes playwright install chromium`。Linux CI 还需要系统依赖，工作流使用 `playwright install --with-deps chromium`。
- **找不到 FFmpeg / FFprobe 或缺少 libmp3lame**：安装对应系统工具并加入 PATH；只需原始 WAV 时可传 `--format wav`。
- **输出已存在**：换一个 `--out` 保存新修订，或确认要替换后传 `--overwrite`。
- **5173 无法访问**：端口可能被占用，或服务使用其他端口；以终端实际输出为准。CLI 临时服务使用动态端口。
- **首次点击没有声音**：先等待合成完成，检查设备音量和页面提示；浏览器可能要求再次点击才能播放，不要绕过自动播放限制。
- **WAV 下载了，但没有署名文件**：浏览器可能阻止一次操作的多文件下载。允许本站多文件下载，或点击“单独下载音源署名”；CLI 会直接保存对应 `.credits.json`（仅在实际有采样署名时生成）。
- **hook / full 比音乐段落长，loop 不够指定秒数**：full / hook 包含风格尾音；loop 是 8 小节音乐时长。按上述公式计算，不把尾音算作新增小节。
