# ai-audio

用 **Tone.js** 创作原创音乐，内置情绪流行电子《余温 / Afterglow》《风起时 / When the Wind Rises》，以及中国风交响流行《山河醒 / Mountains Awake》。默认作品《余温》面向短视频情绪片段：118 BPM、F# 小调，电钢琴与柔软电子主音交替陈述主题，保留轻 DJ 律动。首次主题从 beat 0 出现，完整版约 **4.07 秒**进入主段；hook / loop 从完整乐谱的第 3–10 小节裁切，再独立离线渲染。

## 新作：《山河醒》

**中国风 × 宏大交响 × 流行电子**的原创纯音乐，96 BPM、D 小调五声旋律、48 小节。筝声引子与二胡主歌渐次展开，40 秒进入笛子副歌，宽弦乐、铜管与深鼓托起主题；60 秒卸去节奏组，70 秒回归，最终副歌发展高音变奏，再落回安静的 D。新音色把筝泛音冻结为带钟玉与青铜质感的软颗粒。全部声音为原创合成，未使用外部录音采样。

| 版本 | 内容 | PCM 时长 |
| --- | --- | ---: |
| full | 48 小节 + 3.6 秒尾音 | 123.600 s |
| hook | 实际第 17–24 小节 + 1.6 秒尾音 | 21.600 s |
| loop | 实际第 17–24 小节，跨轮空间尾音 | 20.000 s |

定稿为移调 0、seed 261013，320 kbps / 44.1 kHz / 立体声 MP3：

- [完整版 / full](releases/mountains-awake/mountains-awake-full-96bpm-t0-s261013.mp3)
- [精华片段 / hook](releases/mountains-awake/mountains-awake-hook-96bpm-t0-s261013.mp3)
- [循环配乐 / loop](releases/mountains-awake/mountains-awake-loop-96bpm-t0-s261013.mp3)
- [实测 manifest](releases/mountains-awake/manifest.json)
- [制作简报与验证边界](docs/mountains-awake-production.md)

新增独立的 `cinematic-guofeng` 编曲和音源，含筝、笛、二胡、弦乐、铜管、深鼓、锣与冻结筝颗粒。试听台支持 `/?track=mountains-awake&version=full`；本地 raw WAV 和完整导出报告在 `artifacts/audio/mountains-awake-v1/`。

```bash
npm run render -- --track mountains-awake --seed 261013 --format both --out artifacts/audio/mountains-awake-local
```

## 直接听 MP3

三个定稿 MP3 和 manifest 位于 **Git 追踪的 `releases/afterglow/`**，克隆仓库后即可播放，无需安装依赖或重新渲染。定稿参数为 118 BPM、移调 0、seed **261013**，320 kbps / 44.1 kHz / 立体声。

- [完整版 / full](releases/afterglow/afterglow-full-118bpm-t0-s261013.mp3)
- [精华片段 / hook](releases/afterglow/afterglow-hook-118bpm-t0-s261013.mp3)
- [循环配乐 / loop](releases/afterglow/afterglow-loop-118bpm-t0-s261013.mp3)
- [输出参数与实测 manifest](releases/afterglow/manifest.json)

| 版本 | 音乐结构 | PCM 内容时长 |
| --- | --- | ---: |
| full | 40 小节与 2.4 秒尾音 | 83.756 s |
| hook | 主段 8 小节与 0.8 秒尾音 | 17.071 s |
| loop | 主段 8 小节，不添加尾音 | 16.271 s |

MP3 容器时长可能因编码填充略长，实际文件数据见 manifest。音符、和声、节奏和音色由代码生成；元音应答是**合成乐器**，没有歌手录音、歌词或声音模仿。项目未调用 AI 音乐服务，也未使用外部音频采样。制作依据与验证边界见 [调研与制作简报](docs/short-video-music-research.md)；自动检查不替代人工试听，不保证作品传播效果。

## 新作：《风起时》

《风起时 / When the Wind Rises》是新增的原创情绪流行电子：114 BPM、D 大调、44 小节，独立问答电钢琴、切分轻鼓与后半段旋律发展，让第一句有辨识度，重复时继续向前。主题从第一拍出现，主段约 **4.21 秒**进入；hook / loop 取完整乐谱第 3–10 小节。

| 曲目 ID | BPM | 调性 | full 小节数 | full | hook | loop |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `when-the-wind-rises` / 风起时 | 114 | D major | 44 | 95.032 s | 17.642 s | 16.842 s |

三版定稿 MP3 与实测 manifest 已由 Git 追踪，克隆后即可试听：

- [完整版 / full](releases/when-the-wind-rises/when-the-wind-rises-full-114bpm-t0-s261013.mp3)
- [精华片段 / hook](releases/when-the-wind-rises/when-the-wind-rises-hook-114bpm-t0-s261013.mp3)
- [循环配乐 / loop](releases/when-the-wind-rises/when-the-wind-rises-loop-114bpm-t0-s261013.mp3)
- [输出参数与实测 manifest](releases/when-the-wind-rises/manifest.json)

以上为 seed 261013 / 移调 0 的最终解码内容时长；响度、电平、文件 SHA256 与源码指纹见 release manifest。本地 WAV 与完整导出报告位于 `artifacts/audio/when-the-wind-rises-v2/`。制作资料与改进依据见 [《风起时》制作简报](docs/when-the-wind-rises-research.md)。

新曲沿用 emotional-pop 离线音源架构，完整结构为 **2 + 8 + 8 + 4 + 16 + 6 = 44 小节**；精华与循环版均引用第一主段的八小节，full / hook 分别保留 2.4 / 0.8 秒尾音，loop 不加尾音。曲目数据位于 `src/tracks/when-the-wind-rises.ts`，默认曲目仍为《余温》。

新曲已加入曲目注册表，可以通过 `/?track=when-the-wind-rises&version=hook` 试听，也可以重新渲染到 Git 忽略的目录：

```bash
npm run render -- --track when-the-wind-rises --seed 261013 --format both --out artifacts/audio/when-the-wind-rises-v2
```

## 本地试听与重新渲染

需要 Node.js **>=22.12**（推荐 22 LTS）、npm 和支持 Web Audio 的浏览器。

```bash
git clone https://github.com/Jogzh/ai-audio.git
cd ai-audio
npm ci
npm run dev
```

打开终端输出的 HTTP 地址，端口以实际输出为准。网页默认试听《余温》的 hook，支持版本、BPM、移调、seed 与播放、暂停、停止、跳转；网页导出 WAV，页面不会自动播放。双击 `index.html` 只能看到启动提示，模块需要通过本地服务加载。

CLI 通过 Chromium `OfflineAudioContext` 渲染，默认直接编码 MP3；需要 Playwright Chromium，以及加入 PATH 的 **FFmpeg / FFprobe**。FFmpeg 须包含 `libmp3lame`。

```bash
npx --yes playwright install chromium
npm run render -- --track afterglow --seed 261013 --out artifacts/audio/afterglow-local
npm run render -- --version hook --format wav --out artifacts/audio/afterglow-wav
npm run render -- --help
```

CLI 自行启动临时 Vite 服务，结束后关闭浏览器与服务，不必先运行 `npm run dev`。重新渲染写入 **Git 忽略的 `artifacts/`**；三首已交付作品的 MP3 保存在 `releases/` 对应曲目目录。只导出原始 WAV 时无需 FFmpeg。

| 参数 | 范围 / 含义 | 默认 |
| --- | --- | --- |
| `--track` | `afterglow`、`when-the-wind-rises`、`mountains-awake` | `afterglow` |
| `--version` | `all`、`full`、`hook`、`loop` | `all` |
| `--bpm` | 90–170 整数 | 所选曲目 BPM；余温为 118，风起时为 114 |
| `--transpose` | −12–12 整数，单位为半音 | 0 |
| `--seed` | uint32 整数：0–4294967295 | 260713 |
| `--out` | 相对当前工作目录或绝对路径 | `artifacts/audio` |
| `--format` | `mp3`、`wav`、`both` | `mp3` |
| `--master` | `auto`（仅母带 MP3）、`off`、`loudness`（也母带 WAV） | `auto` |
| `--overwrite` | 允许覆盖已有同名成果 | 关闭 |

负数参数使用等号，例如 `--transpose=-2`。默认生成全三版、118 BPM、移调 0、seed **260713**；仓库定稿使用 **261013**，复现定稿需显式传入该 seed。引擎 `renderTrack(track)` 省略 options 时使用 full 和曲目 BPM，`defaultOptions.bpm` 为 118。

输出为 320 kbps MP3 或 PCM16 WAV，均为立体声、44.1 kHz。默认拒绝覆盖已有音频、母带报告或 `manifest.json`；比较修订时用新 `--out`，需要替换时显式传 `--overwrite`。manifest 记录本次参数、段落、源 PCM 统计与各格式实际文件数据。

MP3 默认两遍 loudnorm 的项目目标为 **−14 LUFS / −1.5 dBTP / LRA 9**，编码后再次实测。这是制作选择，不是抖音或小红书官方标准；源动态与有损编码可能导致偏差。原始 WAV 默认保留引擎 PCM。模式与字段见 [MP3 导出说明](docs/mp3-export.md)。

## 音频与工程约束

每小节 4 拍，音乐时长为 `小节数 × 4 × 60 / BPM`。hook / loop 为 8 小节；情绪电子 full / hook 分别加 2.4 / 0.8 秒尾音，国风分别为 3.6 / 1.6 秒。loop 渲染三轮、截取第三轮以保留跨轮空间尾音，并对边缘做约 3 ms 淡化；接缝仍需实际试听。固定 BPM、完整小节与精确秒数不一定能同时满足。

引擎去除 DC，采用 −1.2 dBFS 采样峰值 ceiling。源 `stats` 的 peak / RMS / 削波不能当作最终文件的 LUFS / true peak；后者在重新渲染报告的 `mastering.after`，定稿则在 release manifest 的 `files[].loudness`。相同环境、源码与参数的 PCM 复现检查限制最大差值 `< 1/65536`、差值 RMS `< 1e-6`，容纳原生处理的微小浮点差异，不保证跨浏览器或文件逐位一致。

```text
ai-audio/
├── releases/                # 三首作品各三版 MP3 与实测 manifest
├── src/
│   ├── tracks/              # 三首曲目定义与 registry.ts
│   ├── music/               # 类型、校验、确定性随机源与编曲
│   │   └── arrangements/     # emotional-pop / cinematic-guofeng
│   ├── engine/              # 两种独立音源与 Offline 渲染
│   ├── audio/wav.ts         # WAV 编码、PCM 电平与波形
│   ├── main.ts              # 试听台
│   └── style.css
├── scripts/                 # CLI、音频导出库、浏览器检查
├── tests/                   # 编曲、WAV、FFmpeg 导出测试
├── docs/                    # 调研与 MP3 导出说明
├── .catpaw/skills/tone-hit-lab/SKILL.md
└── artifacts/audio/         # 重新渲染的本地成果，Git 忽略
```

《余温》与新作《风起时》共用 `emotional-pop` 制作风格。`afterglow.ts` 定义主题、和声、40 小节结构及 `edits`；编曲器先构建 full 乐谱，再裁切短版。`validation.ts` 校验曲目、选项与裁切边界。`emotional-pop.ts` 音源包含电钢琴、主音、元音合成、短空间与前向延迟，低频保持单声道并以轻 ducking 留出底鼓空间。

新增曲目实现 `TrackDefinition`，填入 metadata、八小节 `hook`、逐小节 `harmony`、段落与 `edits`，再在 `src/tracks/registry.ts` 注册。新曲可选 `emotionalPop` 配置：`groove: 'syncopated'` 使用切分鼓和低音；`response` 在主题留白放入电钢琴应答；`finalHook` 从 final 段第九小节开始展开旋律；`bridgeHook` 为无鼓桥段提供稀疏旋律。三个乐句数组的小节数须与 `hook` 一致，配置音符须在各自小节内结束；应答须避开主题及 finalHook 的音符时段。省略这些字段时沿用《余温》的编曲行为。

当前和弦与 pad 每两小节起音，`harmony` 中相邻两小节使用同一和声，以保持持续和弦与低音一致。`edits.hook` / `edits.loop` 的 `startBar` 从 0 计数；两首情绪电子作品设为 2，国风《山河醒》设为 16，均取实际第一主段的 8 小节。`resolveHarmony` 指向已有和声的索引，控制结尾落点。

`cinematic-guofeng` 使用独立编曲器和音源；《山河醒》可选 `cinematicGuofeng.finalHook` / `bridgeHook` 作为最终旋律发展与桥段主题。两种风格均有 seed、BPM、移调和真实乐谱裁切；国风 full / hook 尾音为 3.6 / 1.6 秒，loop 不加尾音。

Offline 任务串行执行，每次渲染独立拥有并释放节点，完成或失败后恢复原上下文。扩展音源时保留这些生命周期约束；尾音规则由 `src/engine/render.ts` 的 `getTailSeconds` 统一维护。

## 本地检查

```bash
npm test
npm run build
npm run check
npm run test:browser
```

`npm run check` 执行测试与构建；浏览器检查另行覆盖真实音频与播放器。FFmpeg 集成测试缺少工具时会明确 skip。CI 配置运行检查与 Chromium 验证，不执行部署；配置存在不等于某次 CI 已通过。

## 许可与常见问题

[LICENSE](LICENSE) 的 MIT 适用于自有软件代码；依赖遵循各自许可，仓库公开不自动把输出音乐授权为 MIT。音频发布者需另行明确作品授权范围。

- **缺少 Chromium**：在 `npm ci` 后执行 `npx --yes playwright install chromium`。
- **缺少 FFmpeg / FFprobe 或 libmp3lame**：安装并加入 PATH；只需原始 WAV 时传 `--format wav`。
- **输出已存在**：换新 `--out`，或明确替换时传 `--overwrite`。
- **本地地址打不开**：确认服务仍在运行，使用终端实际输出的端口。
- **首次点击没声音**：等待合成完成，检查设备音量和页面提示；浏览器可能需要再次点击播放。
