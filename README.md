# ai-audio

支持原创音乐生成、DJ Remix 制作与离线音频导出的实验项目。原创音乐使用 Tone.js，DJ Remix 使用 Python 音频处理工具，支持从歌曲高潮或其他片段分离人声、保留音高变速，重新编写鼓组、贝斯、和声与 Drop，并导出可播放的 MP3/WAV。仓库保留一首可运行的原创示例《余温 / Afterglow》，也可替换曲目数据、调整 BPM、移调、随机种子，或组合已有声音配方。

成品 MP3/WAV 默认写入 Git 忽略的 `artifacts/` 或本地 `releases/` 目录。Git 保留源码、编曲预设、制作记录和 `releases/afterglow/manifest.json`；歌曲音源、分轨、模型与 DJ 成品音频在本地保存。采样库、合成器与导出工具属于可复用工程资源。

## 开始

需要 Node.js **>=22.12**、npm，以及支持 Web Audio 的浏览器。

```bash
npm ci
npm run dev
```

打开终端输出的地址即可使用试听台。页面默认加载《余温》的 hook，支持 full / hook / loop、BPM、移调、seed、分层试听与 WAV 导出。

## 离线渲染

CLI 通过 Chromium 的 `OfflineAudioContext` 渲染。只导出 WAV 不需要 FFmpeg；导出 MP3 或启用响度母带时，需要带 `libmp3lame` 的 FFmpeg 和 FFprobe。

```bash
npx --yes playwright install chromium
npm run render -- --track afterglow --seed 261013 --format both --out artifacts/audio/afterglow
npm run render -- --version hook --format wav --out artifacts/audio/afterglow-hook
npm run render -- --help
```

`render` 支持 `full`、`hook`、`loop` 三种版本，以及 90–170 BPM、−12–12 半音、uint32 seed、44100/48000 Hz 和 16/24 bit WAV。相同源码与参数会得到确定性的编曲触感；`seed` 只改变可控的细节变化，不改写主题的时序。

## 扩展方式

- 在 `src/tracks/` 新增 `TrackDefinition`，再将曲目加入 `src/tracks/registry.ts`。
- 在 `src/music/arrangements/` 组合段落、和声、Hook 与短版裁切。
- 在 `src/engine/` 复用或新增合成器，把事件映射到可独立控制的声音层。
- 使用 `src/music/validation.ts`、`src/music/mixer.ts` 和 `src/audio/wav.ts` 复用参数校验、分层路由与 WAV 测量。

内置的 `emotional-pop`、`cinematic-guofeng`、`guofeng-club` 编曲与声音配方可以直接作为创作起点。它们描述的是合成方法和路由，不绑定某一首成品。

## DJ Remix 制作

可以选取副歌、高潮或其他合适的演唱片段制作 Remix，保留完整唱句，并用人声切片做节奏或旋律回应。制作流程包括人声分离、保留音高的变速、伴奏重编、Build / Drop 设计、侧链混音与 MP3/WAV 母带导出。具体歌曲的素材选择和编曲由制作脚本与预设控制。

最新 DJ 改编为 [《Flowers — Glasshouse Flip》](docs/flowers-glasshouse-production.md)：分离副歌人声，完整保留一次 14 小节副歌，以新写的钢琴、贝斯、Hook 和鼓组替换原伴奏，编排 Piano House → UK Garage 两次 Drop。主版为 128 BPM、98 秒，另有 33.75 秒试听，MP3/WAV 保存在本地 `artifacts/audio/flowers-reimagined/`。来源、采样署名和素材准备要求见制作记录。

准备好本地音源、分轨与采样后，可以复现编曲与母带：

```bash
artifacts/dj-tools/bin/python scripts/flowers_glasshouse.py all
```

`render` 与 `master` 可分别执行编曲和母带；Python 依赖见 `scripts/requirements-dj.txt`，另需 FFmpeg。

新增的 [《夜航线 / Night Transit》](docs/night-transit-production.md) 展示另一种 DJ 主导风格：原创 Peak-time Bass Techno 器乐贯穿全曲，只在蓄力、Break 和 Drop 尾部插入少量有许可的英文干声。主版为 132 BPM、117.56 秒，音频保存在本地 `artifacts/audio/night-transit/`；使用 `artifacts/dj-tools/bin/python scripts/club_dj.py all` 可复现。该示例使用 CC BY-NC 4.0 音源，仅按非商业本地实验记录，短句占比少不等于版权豁免。

此前的 [DJ 调研与首次片段版](docs/flowers-dj-research.md)、[整首保留版](docs/flowers-dj-full-production.md)仍保留，分别位于 `artifacts/audio/flowers-dj/` 和 `artifacts/audio/flowers-dj-full/`。通用工具 `scripts/dj_remix.py` 提供人声分离、保留音高的变速、渐速开场及 MP3/WAV 导出。

## 检查

```bash
npm test
npm run build
npm run test:browser
```

自动检查覆盖参数边界、乐谱裁切、WAV 编码、浏览器渲染和页面交互。峰值、RMS、响度和时长是客观测量，不能替代人工耳听；仓库不对任何平台传播结果作保证。

## 采样与许可

通用钢琴和原声采样位于 `public/audio/`，各目录的署名与许可说明随采样保存。只在需要对应配方时加载它们，新增曲目时请继续保留来源与授权记录。

## 目录

```text
src/tracks/       曲目定义与 registry
src/music/        类型、校验、随机源、编曲与混音选择
src/engine/       Tone.js 合成器与离线渲染
src/audio/        WAV 编码、测量与波形数据
public/audio/     可复用采样及许可说明
scripts/          CLI、浏览器检查与导出库
tests/            编曲、音频编码和导出测试
docs/mp3-export.md MP3 与响度导出说明
```
