# Flowers — Glasshouse Flip

制作日期：2026-10-15。基于 Miley Cyrus《Flowers》的副歌人声，重新写作钢琴、贝斯、旋律 Hook 和鼓组，制作 **Piano House → UK Garage** 的双 Drop 改编。全曲 **128 BPM、52 小节，另加 0.5 秒尾音，共 98 秒**。

## 成品与编排

本地成品目录为 `artifacts/audio/flowers-reimagined/`：

- `flowers-glasshouse-flip.mp3` / `.wav`：主版；
- `flowers-glasshouse-flip-drop-preview.mp3` / `.wav`：33.75 秒试听，包含第一次蓄力、完整副歌与器乐回答；
- `stems/`：主唱、人声采样、钢琴、贝斯、旋律、鼓、氛围和效果八组混音分轨；
- `arrangement.json`：段落、人声来源范围与事件位置；`manifest.json`：最终文件的实际音频测量。

| 主版时间 | 段落 | 编排 |
| --- | --- | --- |
| 0:00–0:07.50 | 钢琴与人声暗号 | 新钢琴和弦、短旋律、人声元音采样 |
| 0:07.50–0:15.00 | 第一次蓄力 | 拍手加密、反向钢琴、上升音效与落点前抽空 |
| 0:15.00–0:41.25 | Piano House Drop | 四拍底鼓、切分钢琴与贝斯，14 小节副歌连续演唱 |
| 0:41.25–0:45.00 | 器乐回答 | 新写的旋律 Hook 接过主唱 |
| 0:45.00–0:52.50 | Breakdown | 后副歌人声、钢琴与空间效果，主要鼓组退出 |
| 0:52.50–1:00.00 | 第二次蓄力 | 人声采样逐步收短，重新累积节奏密度 |
| 1:00.00–1:22.50 | UK Garage Drop | 切分底鼓、带摆动的细分节奏、FM 贝斯，副歌和后副歌返回 |
| 1:22.50–1:30.00 | 人声乐器回答 | 元音采样变成可演奏的旋律，与低音 Hook 对答 |
| 1:30.00–1:38.00 | 退出与尾音 | 鼓组逐步退出，钢琴与延迟结束 |

第一次 Drop 保留完整演唱乐句；人声切片主要用于开场、蓄力与器乐回答。第二次 Drop 改写节奏和低音，并保留可辨认的主唱短段。两次 Drop 使用不同的鼓型和音乐回答，形成段落变化。

## 人声与新伴奏

音源来自 Apple/iTunes 返回的两份官方试听：[条目 1702906535](https://music.apple.com/gb/album/flowers/1702906527?i=1702906535)与[条目 1674691586](https://music.apple.com/gb/album/flowers/1674691585?i=1674691586)。两份均为约 30 秒、44.1 kHz 双声道 AAC，容器总码率约 263–273 kbps。

试听片段在重叠处逐采样对齐，经 1 秒线性交叉淡化，得到 **49.991066 秒**连续素材，对应完整录音 **27.980113–77.971179 秒**。这使第一次副歌的开头和完整唱句都可用。实际拼接参数记录在 `source/apple-continuous-provenance.json`；使用 float32 WAV 保留 AAC 解码后略超 0 dBFS 的峰值，避免固定整数 PCM 截断。浮点转换不会增加 AAC 已有的信息。

使用 **htdemucs** 分出 vocals / drums / bass / other；编曲器只读取 `source/separated/vocals.wav`，原伴奏、原低音和原鼓组均不加入成品。机器分离可能留下伴奏残留，它并非录音室原始人声分轨。主唱经过高低通、轻度齿音处理和压缩，再以 FFmpeg `atempo` 按 **118 → 128 BPM** 保留音高变速。

新伴奏由 Salamander 钢琴采样、合成 sub/FM 贝斯、新写的拨弦旋律、氛围 Pad、公开鼓样本与合成打击乐组成。人声的一个持续元音另行截取、变调与加包络，作为可演奏的声音；这部分使用变速变调，与完整主唱的保留音高处理分开。底鼓触发贝斯、钢琴和效果的侧链衰减；主唱保持连续，不随底鼓被门限切断。

副歌的最后两小节采用 Fmaj9 / E7，完整唱句到源时间 61.715 秒结束。第二 Drop 前四句到 49.40 秒结束；后副歌取 61.65–68.90 秒，保留提前入拍的字头，余下空位交给器乐。边界由分词和波形辅助定位，避免把下一句或下一主歌的开头截进来。元音源的 YIN 中位估计约 MIDI 62.21，用它将短切片调到新旋律音符；这同样属于自动测量。

## 来源与署名

- 原录音与演唱：**Miley Cyrus — Flowers**；歌词与作曲署名见原作品。Apple/iTunes 提供试听来源，相关录音权利不由本仓库的软件许可覆盖。
- 鼓样本：**DWSD — Deep House Drum Kit**，[Freesound 原采样包](https://freesound.org/people/DWSD/packs/11575/?page=1#sound)，经 [teropa/drumkit](https://github.com/teropa/drumkit) 的公开发行取得，许可为 **Creative Commons Attribution**，具体版本以原来源为准。使用 kick、snare、closed/open hat；另有 clap、rim、shaker 由脚本合成。原始文件、解码副本、上游说明和来源记录保存在 `source/drums/`。
- 钢琴录音：**Alexander Holm — Salamander Grand Piano v3**，**CC BY 3.0**；采用 [Tone.js 的 MP3 分发](https://tonejs.github.io/audio/salamander/)，经移调、包络与滤波用于本次新编曲。完整署名见 `public/audio/salamander/ATTRIBUTION.md`。

## 复现

从仓库根目录执行。需要 Python 3.11 环境中的 `scripts/requirements-dj.txt` 依赖、FFmpeg（含 `libmp3lame`）和 FFprobe；当前本地环境为 `artifacts/dj-tools/`。源文件、已分离人声及鼓样本应位于上述目录，钢琴使用仓库已有的 `public/audio/salamander/`。

```bash
# 安装依赖（已有环境可跳过）。
python3.11 -m venv artifacts/dj-tools
artifacts/dj-tools/bin/python -m pip install -r scripts/requirements-dj.txt

# 仅重新编曲，生成 premaster、试听预混与八组分轨。
artifacts/dj-tools/bin/python scripts/flowers_glasshouse.py render

# 对已有预混做母带并输出 MP3/WAV 与 manifest。
artifacts/dj-tools/bin/python scripts/flowers_glasshouse.py master

# 连续执行 render 与 master。
artifacts/dj-tools/bin/python scripts/flowers_glasshouse.py all
```

`render` / `all` 复用本地已分离人声，不重复下载或分离音源。编曲随机种子固定为 `26101503`；节拍、段落、人声事件与声音配方保存在 `scripts/flowers_glasshouse.py`。素材与大型音频按仓库现有规则保存在 Git 忽略目录。

## 验证范围

段落时间与总时长来自编曲参数；音源对齐来自波形测量。最终文件实际响度、真峰值、有效解码时长等以输出目录 `manifest.json` 和独立验证记录为准。

最终 WAV 为 98 秒、44.1 kHz / 24 bit 双声道；MP3 为 320 kbps。主版实际测得约 **−13.59 LUFS**，WAV 真峰值 **−1.95 dBTP**、MP3 **−1.82 dBTP**，解码后均无削波样本。33.75 秒试听版约 −13.38 LUFS。浏览器检查直接解码最终四个文件并启动播放、确认进度推进，报告包含与 manifest 对应的文件哈希。独立检查另核对低频单声道、段落能量、两段底鼓分布与人声切片音高。

**本次未进行实际耳听验收。** 文件可解码、数值检查与浏览器播放验证，只能确认相应技术行为，不能说明分离残留是否可接受、鼓与人声是否融合或 Drop 是否有感染力。
