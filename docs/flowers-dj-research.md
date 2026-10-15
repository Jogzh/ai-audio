# 歌曲片段的 DJ 改编调研与制作记录

调研与制作日期：2026-10-15。

后续按用户反馈完成了[整首原曲连续保留版](flowers-dj-full-production.md)，约 3 分 24 秒，保留完整原唱和伴奏。下文为首次 86 秒片段改编的调研与制作记录。

## 调研结论

可以只用英文歌里的一段人声、一个副歌或几个短句制作 DJ Edit。先把片段放到正确的节拍和乐句位置，再安排鼓组、低音、铺垫、Drop 和退出段，就能形成一首可独立播放的短改编。

| 处理 | 作用 | 本次选择 |
| --- | --- | --- |
| 节拍与乐句对齐 | 避免新鼓组与原素材错拍，减少循环的突兀感 | 从分离后的低音变化辅助定位，截取 8 小节循环 |
| 保留音高的变速 | 调整速度，保留原唱的音高 | 约 117.98 → 126 BPM，速度提高约 6.8% |
| Tempo automation | 用真正的拍速变化形成推进 | 开场 4 小节从 118 逐拍升到 126 BPM，完整主唱段保持 126 |
| 人声与伴奏分离 | 给新低频与节奏留空间 | htdemucs 分出 vocals / bass / drums / other；它们是机器分离结果 |
| 鼓组与贝斯重编 | 提供 House 的舞曲律动 | 四拍底鼓、二四拍拍手、反拍开镲、切分贝斯 |
| EQ 与 sidechain | 控制遮蔽，给底鼓瞬态留空间 | 原伴奏削低频，贝斯和和声随底鼓衰减再恢复 |
| 人声切片 | 用短音节和节奏变化补足段落 | 先给完整 8 小节主唱，再给 4 小节切片回答；第二段切片更密 |
| Build / Drop | 制造段落能量差 | 噪声上升、拍手加密、半拍抽空、底鼓落点 |
| 混音与母带 | 输出可播放、可测量的最终文件 | 双遍响度处理后重新解码检查 WAV / MP3 峰值 |

直接改变采样播放速率会同时改变音高：本曲速度比对应约 +1.14 半音。这里使用 FFmpeg `atempo` 改变时长，音高设为不移调。完整人声段固定在一个速度下处理；开场的速度变化由新编节奏与短切片完成，避免把一句演唱拆成许多独立拉伸的小块。

切片需在节拍、乐句与人声语义之间取舍。稳定拍速并不自动意味着乐句正确；本例的节拍分析先给出约 0.237 秒的拍点相位，再结合分离低音的变化把主循环起点选在约 13.46 秒，使用约 16.27 秒的素材。参数属于制作决定，仍需要后续人工耳听核对。

## 本次作品

**Flowers — Night Bloom DJ Edit**，基于 Miley Cyrus《Flowers》的局部人声素材，方向为 Vocal House / Disco House。

参考录音是 Apple/iTunes 接口返回的约 30 秒试听片段。主循环只使用其中约 16.27 秒，完整歌曲文件不参与本次制作。新鼓组、贝斯、和弦、噪声过渡与延迟由本地 DSP 编排生成，主唱保留录音中的辨识度。

| 主版位置 | 段落 | 制作内容 |
| --- | --- | --- |
| 0:00–0:07.87 | 渐速开场 | 118 → 126 BPM，先给人声暗号，再逐步引入鼓组 |
| 0:07.87–0:15.49 | Build | 拍手加密、上升音效，落点前抽空半拍 |
| 0:15.49–0:38.35 | 第一段 Drop | 8 小节完整主唱循环 + 4 小节切片回答 |
| 0:38.35–0:45.97 | Breakdown | 拿掉主要鼓与贝斯，留下人声和回声 |
| 0:45.97–0:53.59 | 第二次 Build | 重新累积节奏密度，准备落拍 |
| 0:53.59–1:16.44 | 第二段 Drop | 完整主唱返回，后 4 小节改用更密的切片 |
| 1:16.44–1:26.26 | Outro 与尾音 | 鼓组退出，延迟与淡出结束 |

主版约 **86.26 秒**。短版从第一次 Build 开始，保留第一段 Drop，加回声退出，约 **32.18 秒**。

## 如何复现

需要 Python 3.11、FFmpeg（含 `libmp3lame`）、FFprobe。首次分离会下载约 80 MB 的 htdemucs 权重。

```bash
python3.11 -m venv artifacts/dj-tools
artifacts/dj-tools/bin/python -m pip install -r scripts/requirements-dj.txt

# 从仓库根目录执行；source 为本地歌曲片段。
artifacts/dj-tools/bin/python scripts/dj_remix.py all \
  --source path/to/flowers-excerpt.m4a

# 已存在 source 分轨时重新编曲与母带：
artifacts/dj-tools/bin/python scripts/dj_remix.py render --overwrite
artifacts/dj-tools/bin/python scripts/dj_remix.py master --overwrite
```

`scripts/presets/flowers-dj.json` 保存本次素材起点、源 BPM、目标 BPM、8 小节选段、和声、低音和切片位置。它与本次约 30 秒的参考片段对应。更换音源后，应重新分析起点、乐句与和声；同名歌曲的不同试听裁切不保证起点相同。

`scripts/dj_remix.py` 提供分离、渲染、母带三个步骤。本次编排为固定的 44 小节结构；可以修改脚本的 `sections` 和相应事件来开发其他结构。变速、合成、分层、淡入淡出与导出函数可复用。

输出位于 `artifacts/audio/flowers-dj/`：

- `flowers-night-bloom-dj-edit.mp3` / `.wav`：主版；
- `flowers-night-bloom-short.mp3` / `.wav`：短版；
- `stems/`：人声、音乐、鼓、低音、合成器、效果六组混音分轨；
- `arrangement.json`：节拍时间表、段落时间与人声切片事件；
- `manifest.json`：实际解码测量、哈希、母带后增益修正；
- `source/separation.json`：源文件哈希、分离模型与随机种子；
- `qa/`：独立信号检查与最终文件验证记录。

音频、模型和工作缓存遵循仓库现有规则，仅在本地保存。参考录音的权利归原权利人，仓库代码许可不覆盖参考录音与本次非官方改编中的录音素材。

## 验证范围

以下属于**客观音频测量**：变速参考信号的频率与时长、节拍时间表、最终文件解码、实际 LUFS / true peak、削波样本、立体声相关性、段落边界和静音区间。

独立使用 440 Hz、4 秒的测试信号，按本次相同比率变速，测得输出主频约 439.92 Hz，时长约 3.744 秒，理论时长约 3.745 秒。这个检查验证时长变化与保留音高的处理路径，不说明歌曲人声的听感是否自然。

本次**没有进行实际耳听或人工听感验收**。人声分离残留、切片是否自然、鼓与人声是否融合、长时间聆听是否疲劳，仍需人工试听。自动检查通过不能替代这些评价。

最终数值见同目录的制作测量记录与音频输出目录的 `manifest.json`。

## 实际查阅的参考资料

1. [Ableton Live 12：Audio Clips, Tempo, and Warping](https://www.ableton.com/en/live-manual/12/audio-clips-tempo-and-warping/)：拍速自动化、瞬态定位、Warp 模式及完整混合音频的处理说明。
2. [Ableton Live 12：Mixing](https://www.ableton.com/en/live-manual/12/mixing/)：DJ crossfader、曲线与过渡自动化。
3. [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html)：`atempo`、`loudnorm` 与双遍响度测量参数。
4. [Apple/iTunes 曲目检索](https://itunes.apple.com/search?term=Miley+Cyrus+Flowers&entity=song&limit=5&country=US)与[本次录音条目](https://music.apple.com/us/album/flowers/1674691585?i=1674691586)：曲目、艺人和试听素材来源。
5. [Flowers 曲目信息](https://en.wikipedia.org/wiki/Flowers_(Miley_Cyrus_song))：发行背景、118 BPM 与历史流行情况。选曲是 2023 年热门作品；以上背景不属于本次的客观音频测量。
6. [Demucs 项目](https://github.com/facebookresearch/demucs)：本地安装的 htdemucs 分离工具来源。
