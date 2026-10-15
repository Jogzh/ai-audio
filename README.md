# ai-audio

基于 Tone.js 的原创音乐生成与离线导出实验框架。仓库保留一首可运行的示例《余温 / Afterglow》，其余代码面向自由创作：可以替换曲目数据、调整 BPM、移调、随机种子，或组合已有声音配方。

成品 MP3/WAV 默认写入 Git 忽略的 `artifacts/` 或本地 `releases/` 目录。Git 只保留《余温》的源码和 `releases/afterglow/manifest.json`；采样库、合成器与导出工具属于可复用工程资源。

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
