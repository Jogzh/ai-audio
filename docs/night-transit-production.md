# 夜航线 / Night Transit

制作日期：2026-10-15。这是一首 **DJ 主导 / Peak-time Bass Techno with Vocal Inserts** 作品：鼓组、低音、FM 主旋律、Acid 回答、段落和混音全部由本项目重新写作；英文人声只在三个短过渡中出现，用来给 DJ 编排留下一点“歌曲闪现”的记忆点。

成品位于本地 `artifacts/audio/night-transit/`：

- `night-transit-club-original.mp3` / `.wav`：117.56 秒主版；
- `night-transit-club-original-preview.mp3` / `.wav`：21.82 秒试听片段；
- `stems/`：鼓、贝斯、rumble、FM riff、Acid、和声、人声与效果分轨；
- `arrangement.json`：段落、原创旋律事件、人声区间和客观测量；
- `manifest.json`：最终文件响度、峰值、哈希与解码信息。

## 编排

全曲 132 BPM、C 小调、64 小节，另加 1.2 秒尾音。

| 时间 | 段落 | DJ 内容 |
| --- | --- | --- |
| 0:00–0:07.27 | 霓虹脉冲 | 滤波 FM 动机、金属脉冲与稀疏和声建立身份 |
| 0:07.27–0:14.55 | 第一次蓄力 | 底鼓和 rumble 进入，短英文唱句只出现一次 |
| 0:14.55–0:43.64 | 器乐主段 A | 四拍重踢、滚动 bass、短失真 FM riff，后半加入 ride |
| 0:43.64–0:50.91 | 留白 | 鼓和主 riff 抽空，放完整英文短句，再留出回落空间 |
| 0:50.91–0:58.18 | 第二次蓄力 | 门控 riff、加密打击与下行噪声推动下一次落点 |
| 0:58.18–1:27.27 | 器乐主段 B | riff 降八度，bass 改为切分，Acid 在句尾回答 |
| 1:27.27–1:41.82 | 高八度发展 | 原创 hook 回到高音区，加入跨拍金属序列 |
| 1:41.82–1:57.56 | DJ 退出 | 先去掉 lead，再逐层退出鼓和低音，留下效果尾音 |

主 riff 是本次新写的两小节动机。第一次 Drop 使用短 FM 音色；第二次 Drop 使用低八度和更粗的调制，最后八小节再叠高八度和 Acid。低频分成 kick、rumble 和 bass 三层，底鼓触发局部侧链衰减，保证舞曲推进感。

## 人声插入

人声取自 Madam Snowflake 与 spinningmerkaba 的《Infinity Evolving》Dry Vox，原始录音为 48 kHz 单声道、120 BPM、C 小调。使用的三处完整短句为：

- `you did the magic part`；
- `infinite starts with a broken heart`；
- `i did the tragic part`。

它们经过 120 → 132 BPM 的保留音高变速，分别放在蓄力、Break 和第二段主 Drop 尾部。直接唱句合计 12.13 秒，占主版 10.3%；延迟和混响尾音单独计入效果总线。人声没有承担主 Drop 的旋律，主旋律和段落由本项目原创器乐完成。

## 音源、许可与署名

人声来源：[ccMixter 作品页](https://ccmixter.org/files/snowflake/71146)，作者 **Madam Snowflake**，歌词合作者 **spinningmerkaba**。Dry Vox 下载地址为 `https://ccmixter.org/content/snowflake/snowflake_-_Infinity_Evolving_2.flac`，许可为 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)。本地使用属于非商业衍生实验，保留作者、来源、许可和改编说明；商业发布仍需按许可条款取得额外授权或改用适合商业使用的素材。源文件哈希、API 元数据和转写边界保存在本地 `artifacts/audio/night-transit/source/`。

鼓、FM 合成器、Acid、rumble、和声和效果均由 `scripts/club_dj.py` 新写或合成，没有使用该歌曲的原伴奏或旋律。短句占比少并不自动构成版权豁免；作品的许可边界以源录音授权和使用场景为准。

## 复现

需要 Python 3.11 环境中的 `scripts/requirements-dj.txt`、FFmpeg 和 FFprobe，并准备好上述 Dry Vox 文件：

```bash
artifacts/dj-tools/bin/python scripts/club_dj.py render
artifacts/dj-tools/bin/python scripts/club_dj.py master
artifacts/dj-tools/bin/python scripts/club_dj.py all
```

预设在 `scripts/presets/night-transit.json`。`render` 只负责编曲和分轨，`master` 负责双遍响度处理并导出 MP3/WAV，`all` 连续执行两步。

## 验证范围

主版 WAV 实测 117.56 秒、约 −13.54 LUFS、−1.95 dBTP；320 kbps MP3 实测约 −13.55 LUFS、−1.68 dBTP。21.82 秒试听版约 −13.10 LUFS，四个文件解码后均无削波样本和非有限值。120 Hz 低通后的低频侧/中声道比为 −39.95 dB，主版整体立体声相关性约 0.94。第一、第二主 Drop 分别检测到 64 / 63 个底鼓事件，人声直接唱句占 10.3%。这些是客观信号测量，不是听感结论。

浏览器播放检查直接解码四个最终文件并确认播放进度推进；独立报告保存在 `qa/independent-signal-review.json` 和 `qa/browser-playback.json`。

本次没有人工耳听验收。自动测量不能替代对音色融合、分离残留、舞池冲击力和长时间聆听感受的判断。
