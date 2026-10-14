# ai-audio

成品 MP3/WAV 仅在本地保存，Git 保留源码、制作记录、实测 manifest 与必要的音源采样。`releases/` 下的成品音频已加入忽略规则；克隆后可用试听台或导出命令重新生成。

用 **Tone.js** 创作原创音乐，最新作品为国风 DJ《霓虹长安 / Neon Changan》：128 BPM、古筝与唢呐感主音、原生 48 kHz / 24 bit WAV，提供完整、精华、循环和 30 秒卡点四种成品。仓库还内置抒情原声《墨潮》、情绪流行电子《余温》《风起时》和中国风交响流行《山河醒》。默认试听作品仍为《余温》，新作可通过 `/?track=neon-changan&version=hook` 打开。

## 新作：《霓虹长安 / Neon Changan》

**中国风 × Club House / 128 BPM / D 小调五声旋律 / 60 小节**。古筝从第一拍抛出 A–C–D 暗号，7.5 秒进入第一次 Drop；竹笛桥段加入半拍律动，最终 Drop 后八小节升高主题。唢呐感主音、古筝、竹笛、木鱼、堂鼓和锣均为原创合成音色，没有歌手录音、歌词或现成歌曲采样。

全部成品仅在本地保存于 `releases/neon-changan/`，WAV 为原生合成 **48 kHz / PCM24**，MP3 为 **48 kHz / 320 kbps / 立体声**。四个版本都完成响度母带与最终文件测量。

| 版本 | 内容时长 | MP3 | 高音质 WAV |
| --- | ---: | --- | --- |
| 完整版 | 115 s | 完整试听（`releases/neon-changan/neon-changan-full-128bpm-t0-s261014.mp3`） | 完整 PCM24（`releases/neon-changan/neon-changan-full-128bpm-t0-s261014.wav`） |
| 主题版 | 15.65 s | 八小节主题（`releases/neon-changan/neon-changan-hook-128bpm-t0-s261014.mp3`） | 主题 PCM24（`releases/neon-changan/neon-changan-hook-128bpm-t0-s261014.wav`） |
| 循环版 | 15 s | 循环试听（`releases/neon-changan/neon-changan-loop-128bpm-t0-s261014.mp3`） | 循环 PCM24（`releases/neon-changan/neon-changan-loop-128bpm-t0-s261014.wav`） |
| 抖音卡点版 | 30 s | 最终 Drop（`releases/neon-changan/neon-changan-douyin30-128bpm-t0-s261014.mp3`） | 卡点 PCM24（`releases/neon-changan/neon-changan-douyin30-128bpm-t0-s261014.wav`） |

30 秒版取完整作品 **75–105 秒**，第 **15 秒**进入旋律抬升。128 BPM 下，每拍 **0.46875 秒**、每小节 **1.875 秒**；可在第 15 秒安排变装或场景转换。循环剪辑优先导入 WAV，以避免剪辑软件对 MP3 编码填充的处理差异。制作与视频建议见[制作说明](docs/neon-changan-production.md)，最终响度、解码时长、SHA256 和源码指纹见 [release.json](releases/neon-changan/release.json)。没有核验当日热门榜单，也未进行人工耳听；客观检查不能替代听感评价，传播效果无法保证。

新曲采用独立的 `guofeng-club` 编曲和音源模块，14 条独立路由，网页可单独试听或移除声部。WAV 编码与 CLI 新增原生 48 kHz / PCM24 支持，PCM24 编码使用确定性 TPDF 抖动。CLI 新曲默认 48 kHz / 24 bit，其余曲目继续默认 44.1 kHz / 16 bit。复现四种成品使用新目录：

```bash
npm run render:neon -- --out artifacts/audio/neon-changan
npm run package:neon -- --dir artifacts/audio/neon-changan
```

第一条生成 full / hook / loop，第二条裁切 30 秒版并校验全部成品。`--master loudness` 对 WAV 和 MP3 都应用响度母带，不能把扩展位深或采样率本身当作听感提升的证明。

## 《墨潮 / Ink Tide》第六版：让高潮形成抬升

**92 BPM / D 大调和声、D 大调五声旋律 / 40 小节**。长笛与钢琴继续保持清楚的主次；第六版重点发展高潮：最后八小节改用 Gmaj7 → Aadd9 → Dadd9 → Bm7，长笛逐步升到 B5，再落回 D5，弦乐与大提琴随和声换位。桥段进一步收轻，高潮抬升前增加一次轻筒鼓，后半段鼓、低音与沙锤加强共同脉搏。竖琴只在两个真正的主奏停顿里接话，最后长音保留完整空间。

| 版本 | 内容 | 解码内容时长 |
| --- | --- | ---: |
| full | 40 小节 + 2.8 秒尾音 | 107.147823 s |
| hook | 完整乐谱第 3–10 小节 + 1.4 秒尾音 | 22.269546 s |
| loop | 第 3–10 小节，保留跨轮空间尾音 | 20.869569 s |
| climax | 完整版约 73.04 秒起，含高潮发展与收尾 | 34.104354 s |

- 高潮与收尾试听（`releases/ink-tide-v6/ink-tide-climax-92bpm-t0-s261014.mp3`）
- 第六版完整版（`releases/ink-tide-v6/ink-tide-full-92bpm-t0-s261014.mp3`）
- 第六版开头主题（`releases/ink-tide-v6/ink-tide-hook-92bpm-t0-s261014.mp3`）
- 第六版循环（`releases/ink-tide-v6/ink-tide-loop-92bpm-t0-s261014.mp3`）
- [实测与来源 manifest](releases/ink-tide-v6/manifest.json)
- [编曲、采样与验证说明](docs/ink-tide-v6-production.md)

新版高潮位于完整版 **57.39–99.13 秒**，后八小节从 **78.26 秒**抬升；短版 hook / loop 仍取开头主段。网页 `/?track=ink-tide&version=full` 使用第六版，可单独试听一条轨道，或移除选中轨道比较；导出 WAV 保留当前选择。当前版本没有事件的轨道标为“此段休止”，并禁用选择。设 seed **261014** 使用本版参数。工程配置 12 条独立轨道，其中 hook 有 8 条实际发声，其余转段轨道在该段休止；轨道数量不代表编曲质量。CLI 可导出三种版本，也可导出保持原始电平的分轨：

```bash
npm run render -- --track ink-tide --seed 261014 --format both --out artifacts/audio/ink-tide-v6-local
npm run render:stems -- --version hook --seed 261014 --out artifacts/audio/ink-tide-v6-local-stems
```

分轨包含原有滤波、声像、空间与自动化，均从 time 0 对齐；不逐轨归一化，不应用最终去 DC、边缘淡化、峰值修整或 LUFS 母带。浮点分轨相加可还原原始混音，PCM16 导出会增加量化误差。每轨及每次起音独立 seeded；静音别轨不会改写剩余声部的随机触感。

钢琴使用 **Alexander Holm / Salamander Grand Piano v3** 的 13 份本地实录采样，CC BY 3.0，详见[钢琴署名说明](public/audio/salamander/ATTRIBUTION.md)。长笛、小提琴组、大提琴组和竖琴使用 **VSCO 2 Community Edition** 的 25 份本地录音，CC0 1.0，详见[原声采样来源与处理](public/audio/vsco/ATTRIBUTION.md)。采样按近邻音高变速，钢琴力度由增益与滤波表达，VSCO 力度只调整播放增益；没有完整多力度层、round robin 或连奏采样，也没有制作长音循环。VSCO 源文件未经峰值归一化，播放器使用 0.5–2 倍的有限电平补偿。低音与鼓由代码合成。成品 MP3 为 320 kbps / 44.1 kHz / 立体声。

旧版保留供比较：[第五版长笛与钢琴](releases/ink-tide-v5/manifest.json)、[第四版多轨编曲](releases/ink-tide-v4/manifest.json)、[第三版钢琴弦乐](releases/ink-tide-v3/manifest.json)、[第二版箫鼓](releases/ink-tide-v2/manifest.json)、[第一版国风 House](releases/ink-tide/manifest.json)。最初参考为用户提供的 ZHENLOE《We Never》，未核验抖音当日热度。第六版独立创作，未使用参考录音或旋律。**本版未进行人工耳听；编曲取舍属于制作判断，客观电平、分轨相加与自动检查不能证明听感。**

## 新作：《山河醒》第二版

**中国风 × 交响流行**的原创纯音乐，104 BPM、D 小调五声旋律、48 小节。本版针对第一版“配器乱、节奏不稳”的反馈重新制作：副歌主旋律由 35 个音减少到 24 个音，低音与一三拍底鼓对齐，二四拍拍手加入短军鼓主体。每段只有一种领奏，持续和声改为三声部单层，铜管仅在最后八小节进入，深鼓只作转段，减少筝与笛的回声。

| 版本 | 内容 | PCM 时长 |
| --- | --- | ---: |
| full | 48 小节 + 3.6 秒尾音 | 114.369 s |
| hook | 实际第 17–24 小节 + 1.6 秒尾音 | 20.062 s |
| loop | 实际第 17–24 小节，跨轮空间尾音 | 18.462 s |

定稿为移调 0、seed 261013，320 kbps / 44.1 kHz / 立体声 MP3：

- 第二版完整版 / full（`releases/mountains-awake-v2/mountains-awake-full-104bpm-t0-s261013.mp3`）
- 第二版精华片段 / hook（`releases/mountains-awake-v2/mountains-awake-hook-104bpm-t0-s261013.mp3`）
- 第二版循环配乐 / loop（`releases/mountains-awake-v2/mountains-awake-loop-104bpm-t0-s261013.mp3`）
- [第二版实测 manifest](releases/mountains-awake-v2/manifest.json)
- [第二版制作说明](docs/mountains-awake-v2-production.md)

第一版以 commit `5178e01` 保存，96 BPM MP3 位于 `releases/mountains-awake/`，可直接对比。试听台 `/?track=mountains-awake&version=full` 使用第二版；本地 raw WAV 和详细导出报告在 `artifacts/audio/mountains-awake-v2/`。全部声音为原创合成，未使用外部录音采样。

```bash
npm run render -- --track mountains-awake --seed 261013 --format both --out artifacts/audio/mountains-awake-v2-local
```

## 本地成品与试听

三个定稿 MP3 仅在本地 `releases/afterglow/` 保留，manifest 随 Git 保存；克隆后可通过试听台或重新渲染收听。定稿参数为 118 BPM、移调 0、seed **261013**，320 kbps / 44.1 kHz / 立体声。

- 完整版 / full（`releases/afterglow/afterglow-full-118bpm-t0-s261013.mp3`）
- 精华片段 / hook（`releases/afterglow/afterglow-hook-118bpm-t0-s261013.mp3`）
- 循环配乐 / loop（`releases/afterglow/afterglow-loop-118bpm-t0-s261013.mp3`）
- [输出参数与实测 manifest](releases/afterglow/manifest.json)

| 版本 | 音乐结构 | PCM 内容时长 |
| --- | --- | ---: |
| full | 40 小节与 2.4 秒尾音 | 83.756 s |
| hook | 主段 8 小节与 0.8 秒尾音 | 17.071 s |
| loop | 主段 8 小节，不添加尾音 | 16.271 s |

MP3 容器时长可能因编码填充略长，实际文件数据见 manifest。音符、和声、节奏和音色由代码生成；元音应答是**合成乐器**，没有歌手录音、歌词或声音模仿。《余温》未调用 AI 音乐服务，也未使用外部音频采样。制作依据与验证边界见 [调研与制作简报](docs/short-video-music-research.md)；自动检查不替代人工试听，不保证作品传播效果。

## 新作：《风起时》

《风起时 / When the Wind Rises》是新增的原创情绪流行电子：114 BPM、D 大调、44 小节，独立问答电钢琴、切分轻鼓与后半段旋律发展，让第一句有辨识度，重复时继续向前。主题从第一拍出现，主段约 **4.21 秒**进入；hook / loop 取完整乐谱第 3–10 小节。

| 曲目 ID | BPM | 调性 | full 小节数 | full | hook | loop |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `when-the-wind-rises` / 风起时 | 114 | D major | 44 | 95.032 s | 17.642 s | 16.842 s |

三版定稿 MP3 仅在本地保留，Git 保存实测 manifest：

- 完整版 / full（`releases/when-the-wind-rises/when-the-wind-rises-full-114bpm-t0-s261013.mp3`）
- 精华片段 / hook（`releases/when-the-wind-rises/when-the-wind-rises-hook-114bpm-t0-s261013.mp3`）
- 循环配乐 / loop（`releases/when-the-wind-rises/when-the-wind-rises-loop-114bpm-t0-s261013.mp3`）
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

CLI 自行启动临时 Vite 服务，结束后关闭浏览器与服务，不必先运行 `npm run dev`。重新渲染写入 **Git 忽略的 `artifacts/`**；五首作品的成品仅在本地 `releases/` 对应曲目目录保留。只导出原始 WAV 时无需 FFmpeg。

| 参数 | 范围 / 含义 | 默认 |
| --- | --- | --- |
| `--track` | `afterglow`、`when-the-wind-rises`、`mountains-awake`、`ink-tide`、`neon-changan` | `afterglow` |
| `--version` | `all`、`full`、`hook`、`loop` | `all` |
| `--bpm` | 90–170 整数 | 所选曲目 BPM；余温 118，风起时 114，山河醒 104，墨潮 92，霓虹长安 128 |
| `--sample-rate` | 44100 或 48000；原生离线合成采样率 | 霓虹长安 48000，其余 44100 |
| `--bit-depth` | WAV 的 16 或 24 bit | 霓虹长安 24，其余 16 |
| `--transpose` | −12–12 整数，单位为半音 | 0 |
| `--seed` | uint32 整数：0–4294967295 | 260713 |
| `--out` | 相对当前工作目录或绝对路径 | `artifacts/audio` |
| `--format` | `mp3`、`wav`、`both` | `mp3` |
| `--master` | `auto`（仅母带 MP3）、`off`、`loudness`（也母带 WAV） | `auto` |
| `--overwrite` | 允许覆盖已有同名成果 | 关闭 |

负数参数使用等号，例如 `--transpose=-2`。默认生成全三版、118 BPM、移调 0、seed **260713**；《余温》《风起时》《山河醒》定稿使用 **261013**，《墨潮》使用 **261014**，复现相应版本需显式传入该 seed。引擎 `renderTrack(track)` 省略 options 时使用 full 和曲目 BPM，`defaultOptions.bpm` 为 118。

输出为 320 kbps MP3 或 PCM16/24 WAV，立体声，采样率为原生渲染的 44.1/48 kHz。默认拒绝覆盖已有音频、母带报告或 `manifest.json`；比较修订时用新 `--out`，需要替换时显式传 `--overwrite`。manifest 记录本次参数、段落、源 PCM 统计与各格式实际文件数据。

MP3 默认两遍 loudnorm 的项目目标为 **−14 LUFS / −1.5 dBTP / LRA 9**，编码后再次实测。这是制作选择，不是抖音或小红书官方标准；源动态与有损编码可能导致偏差。原始 WAV 默认保留引擎 PCM。模式与字段见 [MP3 导出说明](docs/mp3-export.md)。

## 音频与工程约束

每小节 4 拍，音乐时长为 `小节数 × 4 × 60 / BPM`。hook / loop 为 8 小节；情绪电子 full / hook 分别加 2.4 / 0.8 秒尾音，交响国风分别为 3.6 / 1.6 秒，墨潮分别为 2.8 / 1.4 秒。loop 渲染三轮、截取第三轮以保留跨轮空间尾音，并对边缘做约 3 ms 淡化；接缝仍需实际试听。固定 BPM、完整小节与精确秒数不一定能同时满足。

引擎去除 DC，采用 −1.2 dBFS 采样峰值 ceiling。源 `stats` 的 peak / RMS / 削波不能当作最终文件的 LUFS / true peak；后者在重新渲染报告的 `mastering.after`，定稿则在 release manifest 的 `files[].loudness`。相同环境、源码与参数的 PCM 复现检查限制最大差值 `< 1/65536`、差值 RMS `< 1e-6`，容纳原生处理的微小浮点差异，不保证跨浏览器或文件逐位一致。

```text
ai-audio/
├── releases/                # 实测 manifest 与本地成品；MP3/WAV 不纳入 Git
├── public/audio/salamander/ # 墨潮的钢琴采样及 CC BY 3.0 署名
├── public/audio/vsco/       # 长笛、弦乐、竖琴采样及 CC0 来源说明
├── src/
│   ├── tracks/              # 五首曲目定义与 registry.ts
│   ├── music/               # 类型、校验、确定性随机源与编曲
│   │   └── arrangements/     # emotional-pop / cinematic-guofeng / ink-tide
│   ├── engine/              # 四种独立音源与 Offline 渲染
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

`ink-tide` 第六版使用独立编曲器和 12 条混音轨道。`MusicalEvent.trackId` 标明声部身份，音色与轨道分别配置；长笛唯一领奏、钢琴单一活动伴奏，弦乐保持两小节长和声。`inkTide.response` / `finalResponse` / `finalHook` / `bridgeHook` 保存首段与高潮各自的回答、发展与桥段主题，bridge 当前使用前四小节。`ink-tide-mix.ts` 根据实际段落边界生成音量曲线，裁切版本保留边界的插值电平。钢琴和四类原声采样在渲染前从静态目录加载并解码；任一原声采样加载失败时不发布部分音源库，后续调用可重新加载。hook / loop 裁自第 3–10 小节，分轨与 raw 混音从同一原乐谱渲染，接口与边界见[第六版制作说明](docs/ink-tide-v6-production.md)。第二版中国鼓与第四版合成音色模块仍保留为工程能力。

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

[LICENSE](LICENSE) 的 MIT 适用于自有软件代码；依赖遵循各自许可，仓库公开不自动把输出音乐授权为 MIT。《墨潮》使用 Alexander Holm 的 Salamander Grand Piano 采样，受独立的 CC BY 3.0 许可约束；使用或再发布相关采样与含采样的音频时保留[作者、来源与处理说明](public/audio/salamander/ATTRIBUTION.md)。第五版新增的 VSCO 2 Community Edition 采样为 CC0 1.0，仓库保留[作者、来源与本地处理记录](public/audio/vsco/ATTRIBUTION.md)。作品其余音乐部分的授权范围仍需由音频发布者另行明确。

- **缺少 Chromium**：在 `npm ci` 后执行 `npx --yes playwright install chromium`。
- **缺少 FFmpeg / FFprobe 或 libmp3lame**：安装并加入 PATH；只需原始 WAV 时传 `--format wav`。
- **输出已存在**：换新 `--out`，或明确替换时传 `--overwrite`。
- **本地地址打不开**：确认服务仍在运行，使用终端实际输出的端口。
- **首次点击没声音**：等待合成完成，检查设备音量和页面提示；浏览器可能需要再次点击播放。
