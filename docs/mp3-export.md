# 直接导出 MP3

《余温》的三版 MP3 已随 Git 保存到 `releases/afterglow/`，可直接播放，无需重新渲染：[full](../releases/afterglow/afterglow-full-118bpm-t0-s261013.mp3) / [hook](../releases/afterglow/afterglow-hook-118bpm-t0-s261013.mp3) / [loop](../releases/afterglow/afterglow-loop-118bpm-t0-s261013.mp3)。定稿参数为 118 BPM、移调 0、seed 261013，文件与实测见 [manifest](../releases/afterglow/manifest.json)。

修改后重新导出：`npm run render -- --track afterglow --version hook --seed 261013 --out artifacts/audio/afterglow-local`。`artifacts/` 仍被 Git 忽略；CLI 默认 seed 为 260713，与定稿不同。

CLI 默认产出 320 kbps、44.1 kHz 立体声 MP3。`--format wav` 导出 PCM16 WAV，`--format both` 同时输出两种格式。同名音频、母带报告或 `manifest.json` 已存在时默认报错；选择新的 `--out` 目录，明确替换时使用 `--overwrite`。

`--master auto` 是默认值：MP3 使用两遍 FFmpeg loudnorm，WAV 保留引擎的原始 PCM。`--master loudness` 也对 WAV 做两遍响度母带；`--master off` 只编码、不做响度调整。制作目标为 −14 LUFS、−1.5 dBTP、LRA 9，这是项目自己的选择，不代表抖音或小红书的官方标准，也不能证明作品会流行。源音频动态或 MP3 编码会让最终实测与目标有差异。

MP3 或显式响度母带需要系统可运行 `ffmpeg`、`ffprobe`；MP3 还需要 FFmpeg 的 `libmp3lame` 编码器。程序会先检查依赖，再启动浏览器渲染或创建输出目录。`--format wav --master auto` / `off` 无需这些工具。临时 WAV 和编码文件会在成功或失败后清理，只有转换和测量完成的音频才复制到目标目录。

重新导出使用 FFmpeg 时会写 `.mastering.json`：`before` 是原始 WAV 的实测 integrated LUFS、oversampled true peak、LRA，`after.wav` / `after.mp3` 是实际最终文件解码后的实测值。MP3 默认记录两遍 loudnorm 处理方式；`off` 也做前后测量，但不改变音量。Git 中定稿的测量与参数统一保存在 release manifest。

重新渲染的 `manifest.json` 保留轨道、种子、编曲段落、原始 PCM 音量统计等字段。每个 render 的 `filename` 指向主要输出（有 MP3 时优先 MP3），`files` 列出所有文件的格式、codec、文件大小、实际采样率、声道与时长；`actualDurationSeconds` 来自主要输出。MP3 的 FFprobe 容器时长可能包含编码填充，`audioContentDurationSeconds` 记录原始 PCM 帧的实际时长。每个 render 的 `stats` 是引擎原始 PCM 的 sample peak / RMS，不能当作最终文件的 LUFS 或 true peak。

定稿的 release manifest 使用 `files` 列出三个 MP3，包含各自参数、时长、SHA-256、编码后 `loudness` 和 `decodedCheck`；无需旁边的临时 WAV 或母带报告即可查看测量。

验证：`node --test tests/audio-export.test.mjs` 覆盖 WAV 字节兼容、两遍响度调整及 MP3 解码实测、静音测量失败、缺少 FFmpeg 时不创建无效输出、默认防覆盖。FFmpeg 集成测试在未安装依赖时会明确标记 skip。
