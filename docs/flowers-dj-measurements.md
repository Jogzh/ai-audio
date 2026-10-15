# Flowers DJ Edit：实际音频测量

日期：2026-10-15。以下是客观测量和程序验证，没有进行实际耳听。

| 文件 | PCM 内容时长 | 响度 | True peak | 削波样本 |
| --- | ---: | ---: | ---: | ---: |
| `flowers-night-bloom-dj-edit.wav` | 86.26 s | -13.78 LUFS | -1.95 dBTP | 0 |
| `flowers-night-bloom-dj-edit.mp3` | 86.26 s | -13.79 LUFS | -1.70 dBTP | 0 |
| `flowers-night-bloom-short.wav` | 32.18 s | -13.45 LUFS | -1.95 dBTP | 0 |
| `flowers-night-bloom-short.mp3` | 32.18 s | -13.46 LUFS | -1.63 dBTP | 0 |

WAV 为 44.1 kHz / 24 bit / 立体声；MP3 为 320 kbps。时长按实际解码后的帧数计算。

母带以约 −13 LUFS 为制作目标，最终实际峰值优先；双遍响度处理后，使用实测增益修正预留转码余量。它是本项目的制作选择，不代表平台标准。

验证记录：

- 四个最终文件都能通过 FFmpeg 解码，PCM 为有限值，未检测到削波样本。
- 主版未检测到持续超过 350 ms、低于 −65 dB 的静音；短版末尾约 355 ms 为淡出尾部。
- 用 440 Hz 参考信号独立验证本次变速，测得约 439.92 Hz，输出时长与理论值差约 1.6 ms。
- 118 → 126 BPM 的开场拍点时间表单调递增；主唱段保持 126 BPM。
- Chromium 的 Web Audio 解码与 HTMLAudio 播放检查通过，两版均能解码、开始播放且播放时间推进。
- 仓库现有 27 个测试与 TypeScript / Vite 构建通过。

原始测量：`artifacts/audio/flowers-dj/manifest.json`；细项：`artifacts/audio/flowers-dj/qa/`。

分离残留、人声自然度、混音融合度、乐句是否悦耳，都没有经过人工耳听确认，不能由以上数据推断。
