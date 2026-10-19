# 风经过的地方 / Where the Wind Passes

制作日期：2026-10-19。这是一首 **Cinematic Piano Pop Ballad** 器乐作品：旋律、和声、钢琴织体、弦乐、贝斯、鼓组与混音均为本次新写。全曲 84 BPM、D 大调，最后一次副歌整体上移两个半音到 E 大调，用调性抬升制造情绪落点。

成品位于本地 `releases/wind-passes/`：

- `wind-passes.mp3`：320 kbps 主版，3 分 46.86 秒；
- `wind-passes.wav`：24-bit / 44.1 kHz 主版；
- `wind-passes-preview.mp3`：31 秒试听（第一段副歌 + 间奏）；
- `wind-passes-finale-preview.mp3`：22.86 秒试听（转调后的最终副歌）；
- `manifest.json`：响度、真峰值、分段电平、哈希与解码检查。

谱面单独保存在可复用的 `scripts/presets/wind-passes.json`：速度、调性、段落、每个和弦的钢琴/弦乐/pad 排列、主歌/导歌/副歌/桥段旋律与引子/尾奏音型都在里面。`scripts/wind_passes.py` 读取它，再完成采样、合成、编曲、混音与母带。

工程文件位于 `artifacts/audio/wind-passes/`：`premaster.wav`、`stems/`（分轨）、`arrangement.json`（段落与音符事件）。`releases/` 与 `artifacts/` 均被 Git 忽略，仓库只保留谱面、脚本、可复用采样与制作记录。

## 编排

| 时间 | 段落 | 内容 |
| --- | --- | --- |
| 0:00.00–0:17.14 | 01 / 风起 | 钢琴独白先露出副歌动机的远影，弦乐与 pad 缓慢铺开 |
| 0:17.14–0:40.00 | 02 / 远行 | 主歌一：D 大调中低音区，钢琴主旋律，贝斯与低音提琴进入 |
| 0:40.00–1:02.86 | 03 / 抬头 | 导歌：和声转向 Em7–F#m7，旋律逐句上行，鼓组加入推动 |
| 1:02.86–1:25.71 | 04 / 风经过的地方 | 副歌一：钢琴 + 长笛齐奏，弦乐抬高，轻鼓与贝斯落位 |
| 1:25.71–1:31.43 | 05 / 回声 | 两小节留白，长笛与竖琴回答，给第二次主歌让出空间 |
| 1:31.43–1:54.29 | 06 / 归途 | 主歌二：大提琴在钢琴下方八度复述旋律，织体比主歌一更暖 |
| 1:54.29–2:17.14 | 07 / 靠近 | 导歌二：加入钢琴八度叠奏与更密的鼓，推动第二次副歌 |
| 2:17.14–2:40.00 | 08 / 同一阵风 | 副歌二：长笛、钢琴八度、合唱垫与更高的弦乐层 |
| 2:40.00–3:02.86 | 09 / 静下来 | 桥段：只留钢琴、大提琴与弱弦乐，最后两小节鼓组回归 |
| 3:02.86–3:25.71 | 10 / 更高的地方 | 最终副歌：整体上移两个半音到 E 大调，合唱、钟琴、长笛高音与低频加厚 |
| 3:25.71–3:46.86 | 11 / 风停 | 尾奏：E 大调上重述开场动机，落在 E(add9) 长音 |

## 旋律与和声

主歌和声：`D – A/C# – Bm7 – Gmaj7 – D/F# – A – Gmaj7 – A`。导歌：`Em7 – F#m7 – Gmaj7 – Asus4`。副歌：`D – A/C# – Bm7 – A – D/F# – Gmaj7 – Em7 – A`。桥段：`Bm7 – Gmaj7 – D/F# – A – Bm7 – Gmaj7 – F#m7 – B7sus4`。最终副歌整体移到 E 大调：`E – B/D# – C#m7 – B – E/G# – A – F#m7 – B`。

副歌动机是两小节一句的五声音阶式上行与回落：`A–B–D–C#`（5–6–8–7），第二句落在 `B–A–F#`（6–5–3）；第三、四小节把同一动机向上移高一级并落到 E5，第六小节到达全曲最高的 F#5（最终副歌为 G#5），随后用 `D–C#–B–A` 下行收束。主歌刻意停在 D4–A4 的说话音区；导歌逐句抬高到 E5；副歌把最高音放在第 5 小节而不是开头，让句子有“先走两步、再抬头”的形状。

旋律写作遵循几条简单规则：

- 强拍优先落和弦音，经过音与时值较长的挂留音只在明确解决的位置出现；
- 每个 8 小节乐句都有一次上行和一次回落，避免连续同向跳进；
- 第二段主歌用大提琴在下方八度复述旋律，改变音色而不改写主题；
- 桥段把最高音降下来，只保留 B4–D5 的窄音域，为转调留出空间；
- 最终副歌整体升两个半音，旋律音域升到 G#5，但句法与第一次副歌完全一致，靠调性和配器而不是新素材制造高潮。

## 声音与制作

- **钢琴**：Salamander Grand Piano v3 采样（Alexander Holm，CC BY 3.0），按相邻音高重采样，保留原录音的自然衰减；伴奏与主旋律分轨处理。
- **弦乐、大提琴、长笛、竖琴**：VSCO 2 Community Edition 真实录音（CC0），单层采样，按音高重采样并使用慢起音、自然颤音与房间混响。
- **鼓组**：踩镲来自 `@teropa/drumkit`（原始采样作者 DWSD，CC BY，具体版本未在源 README 中断言）；底鼓、刷子军鼓、沙锤由脚本合成。鼓组刻意压在伴奏层，不抢主旋律。
- **贝斯、pad、合唱垫、钟琴**：numpy 合成。合唱垫使用三个固定共振峰（约 730 / 1090 / 2440 Hz）做出无词“啊”声，只在第二次副歌与最终副歌出现。
- **空间**：一条共享的反馈延迟混响（8 个梳状滤波器 + 4 个全通），钢琴与主旋律另有附点八分延迟；各分轨先做必要的高通、低通与声像，再进入总线压缩与三段均衡。
- **母带**：FFmpeg `loudnorm` 线性归一化到约 −14 LUFS，真峰值上限约 −1.9 dBTP；MP3 与 WAV 分别实测，不对任何平台的响度标准作保证。

## 客观测量

主版 WAV 实测 226.86 秒、−14.22 LUFS、−1.95 dBTP、LRA 6.5 LU，解码后 0 个削波样本，立体声相关性约 0.92。320 kbps MP3 实测 −14.22 LUFS、−1.90 dBTP，同样无削波。分段 RMS（母带响度归一化前）如下，仅用于核对段落起伏：

| 段落 | RMS dBFS |
| --- | --- |
| 风起 | −24.7 |
| 远行 | −22.1 |
| 抬头 | −19.8 |
| 风经过的地方 | −18.2 |
| 回声 | −27.7 |
| 归途 | −21.7 |
| 靠近 | −19.4 |
| 同一阵风 | −18.2 |
| 静下来 | −22.1 |
| 更高的地方 | −18.0 |
| 风停 | −24.2 |

这些数字说明段落有预期的强弱关系，但不构成听感结论。本次制作**没有进行人工耳听**；混音平衡、音色审美与旋律是否“好听”仍需由人来判断。采样为单层录音，弦乐与长笛不是真正的连奏演奏；鼓组有一部分是合成音色，这些限制在密集段落里可能被听出来。

## 复现

需要 Python 3.11 环境中的 `numpy`、`scipy`、`soundfile` 与系统 FFmpeg。仓库自带的 `artifacts/dj-tools/bin/python` 已包含这些依赖：

```bash
artifacts/dj-tools/bin/python scripts/wind_passes.py all
```

`render` 只负责编曲、分轨与 `premaster.wav`；`master` 负责响度归一化并导出 WAV/MP3；`all` 连续执行两步。脚本是确定性的，同一版本会得到相同的编曲与混音。

## 来源与许可

- 钢琴采样：[Salamander Grand Piano v3](https://archive.org/details/SalamanderGrandPianoV3)，Alexander Holm，[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。本项目使用 Tone.js 分发的 13 个 MP3，署名与处理说明见 `public/audio/salamander/ATTRIBUTION.md`。
- 弦乐/大提琴/长笛/竖琴：[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)，Sam Gossner / Versilian Studios、Simon Dalzell / Ivy Audio，切样 Elan Hickler / Soundemote，CC0 1.0。具体文件与音高交叉核对见 `public/audio/vsco/ATTRIBUTION.md`。
- 踩镲：`@teropa/drumkit@1.1.0`，原始采样作者 DWSD，[Freesound 合集](https://freesound.org/people/DWSD/packs/11575/)，CC BY（源 README 未断言具体版本）。本曲实际使用的两个踩镲与署名保存在 `public/audio/teropa-drums/`。
- 其余合成音色、编曲、旋律、和声与混音由 `scripts/wind_passes.py` 新写，谱面数据在 `scripts/presets/wind-passes.json`；代码沿用仓库 MIT 许可，采样与成品音频的许可独立于代码许可。
