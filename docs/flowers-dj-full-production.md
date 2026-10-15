# Flowers：整首保留版 DJ Mix

制作日期：2026-10-15。本版按“原曲演唱和旋律完整，DJ 编曲贯穿全曲”的反馈修订。

## 成品

本地文件位于 `artifacts/audio/flowers-dj-full/`：

- `flowers-night-bloom-full-song-dj.mp3`：320 kbps 试听版；
- `flowers-night-bloom-full-song-dj.wav`：44.1 kHz / 24 bit / 立体声；
- `stems/original.wav`：完整原录音经过一次变速与固定增益后的连续音轨；
- `stems/drums.wav`、`stems/synths.wav`、`stems/fx.wav`：新增的 DJ 编曲分轨；
- `source-coverage.json`：完整源文件范围、输出帧区间和处理参数；
- `arrangement.json`：原曲段落与成品时间线；
- `manifest.json` 和 `qa/`：最终文件测量与独立验证。

成品 **203.94 秒，约 3 分 24 秒**。开场 4 小节逐拍从 118 升至 126 BPM；整首原录音固定按 118 → 126 BPM 变速且不移调。主歌、副歌、桥段和尾音按原顺序连续保留，结尾增加 4 小节 DJ 尾奏。

## 完整性处理

整份录音只执行一次保留音高的 `atempo`，完整输出一次性放入时间线。没有截取 8 小节循环，没有用人声切片替代唱句，也没有用分离模型拿掉原来的乐器。原录音的鼓、低音、和弦与旋律都保留在连续的 `original` 轨道中。

新底鼓、拍手、闭镲和反拍开镲贯穿编排，强度随歌词时间标记对应的段落变化。副歌前的上升音效与短暂抽空只作用于新增 DJ 层。完整录音轨道不做门限切断、侧链闪避或分段音量包络。

新增和声只用于 DJ 开场与尾奏；完整歌曲段使用原有和声与低音，避免与其冲突。所有分轨相加后通过固定增益预留空间，再做双遍响度处理和最终峰值复测。

## 素材记录

源自用户提供的 [Flowers 下载页](https://www.qeecc.com/song/aXlnZHhkd3ln.html)，同站[歌曲搜索入口](https://www.qeecc.com/so/Flowers.html)。浏览器播放器标注 Miley Cyrus《Flowers》，显示时长 3:20；下载后 FFprobe 检测为 200.573968 秒的 HE-AAC 文件。

实际解码的有效 PCM 为 **8,840,042 帧 / 200.454467 秒**。容器时间与有效 PCM 的差异来自编码填充和起始时间。此差异不表示本次删掉了歌曲内容。按 126/118 倍变速，实际得到 **8,279,138 帧 / 187.735556 秒**，全部连续放入成品。

该来源约 48.6 kbps，输出 320 kbps MP3 与 24 bit WAV 便于交付，不能恢复来源文件已损失的细节。音频素材保存在 Git 忽略的本地目录；参考录音不属于仓库代码许可。

## 实际验证

| 文件 | 有效时长 | 响度 | 真峰值 | 削波样本 |
| --- | ---: | ---: | ---: | ---: |
| 主版 WAV | 203.94 s | −13.24 LUFS | −1.95 dBTP | 0 |
| 主版 MP3 | 203.94 s | −13.24 LUFS | −1.80 dBTP | 0 |

独立重新调用 FFmpeg 对完整源文件变速，读回导出的 `stems/original.wav` 进行逐帧比较：原曲放入区间内最大误差为 **0**，区间外为静音。开头、中段和结尾各抽样窗口的相关性均为约 1。由此验证原曲层确实完整连续，未被循环片段替换。

最终 WAV / MP3 均可完整解码，未检测到非有限样本、削波样本或持续超过 350 ms 且低于 −65 dB 的静音。Chromium 能解码并开始播放最终 MP3，播放时间正常推进。

新增的 2 项 Python 集成测试覆盖“源录音完整放入一次”和“整首预设拒绝短试听片段”；现有 27 项测试及 TypeScript / Vite 构建通过。

以上是客观测量和自动播放验证。**没有进行实际耳听验收**；鼓与原录音的听感融合、低频力度和演唱自然度仍需人工试听。

## 复现

```bash
# 使用已有 DJ Python 环境；新环境安装 scripts/requirements-dj.txt。
artifacts/dj-tools/bin/python scripts/dj_remix.py all \
  --config scripts/presets/flowers-dj-full.json \
  --source artifacts/audio/flowers-dj-full/source/flowers-full.m4a \
  --out artifacts/audio/flowers-dj-full

# 输出已存在时，在上述命令后增加 --overwrite。
artifacts/dj-tools/bin/python -m unittest discover -s tests -p 'test_dj_continuity.py'
```

整首预设要求源文件至少 180 秒，防止再次把 30 秒试听片段当成完整歌曲。替换音源时，应核对是否为同一完整录音，并重新检查拍点相位与歌词时间标记。
