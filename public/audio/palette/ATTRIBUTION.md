# 声音素材库 01 · 来源与许可

本目录新增的 WAV、MP3 示例与编曲循环，均按 **CC0 1.0 Universal** 提供。此声明仅覆盖本目录资产，不改变仓库其他采样、曲目或成品的授权。完整许可见 `sources/LICENSE`。

## 实录采样

- 录音：**Sam Gossner / Versilian Studios**、**Simon Dalzell / Ivy Audio**；切样：**Elan Hickler / Soundemote**。本项目未逐条确认具体演奏者，因此保留库级联合署名。
- 官方项目：[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)。
- WAV 源：[sgossner/VSCO-2-CE](https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e)，固定 commit `440300901dfe9275fd84e0b7763af1f8443ae62e`。
- 原始许可：[CC0](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE)。源 LICENSE、README.md、Readme.txt 随资产保存在 `sources/`。
- 音高映射：固定 [SFZ 分支 commit](https://github.com/sgossner/VSCO-2-CE/tree/6dd651d55dde97fd4028699be9d4481f26917891) 的 `Marimba.sfz` 与 `Xylophone.sfz`；本地同样保留这两份映射文件。马林巴源 B2 对应 MIDI 59 / 科学音高 B3，木琴源 C4 对应 MIDI 60 / C4；没有从文件名猜音高。

16 条录音包含 4 条马林巴、4 条木琴、4 条军鼓、2 条铃鼓、三角铁和吊镲。军鼓保留两组原始力度标签 v3 / v5，各两条 round robin；“轻/重”是相对分组，不表示全力度覆盖。铃鼓有两条变体。其他乐器每个音高只选一条录音，不含连奏或循环长音。原声库的空间与底噪仍会保留。

处理：FFmpeg 只取原 WAV 左声道，重采样到 44.1 kHz；按 10 ms RMS 区块定位有效声音，阈值为区块最大 RMS 的 0.8% 与 −100 dBFS 的较高值，起点前保留 10 ms、末尾保留至多 350 ms；开头 0.5 ms、末尾 20 ms 淡变。导出单声道 24-bit PCM WAV，不归一化、不加混响、不降噪、不变调。各文件原始路径、URL、SHA-256、裁切帧和处理后测量见 `manifest.json`。

## 原创合成与编曲

作者：ai-audio 项目贡献者，2026。本目录的合成素材、三种风格谱面与渲染示例，按 CC0 1.0 Universal 提供，允许复制、修改、再分发与商用，无需署名（欢迎保留来源）。它们由本项目脚本直接合成，没有使用商业歌曲、人声、商业采样包或外部生成服务。

- `synth/`：合成电钢琴、Sub、Reese、暖 Pad，以及合成底鼓、边击、开闭镲、沙锤。电钢琴是加法/FM 合成，不宣称复刻某品牌或实录乐器。
- `fx/`：噪声上升、下降、低频冲击、反向钟音。均为 one-shot，按秒计时；反向钟音标记 MIDI 72，其余没有固定调性。
- `loops/`：Lo-fi Soul（92 BPM / D minor）、UK Garage（132 BPM / F minor）、Ambient Mallets（96 BPM / C major），每种各一条 8 小节鼓/打击乐循环和一条完整编曲循环。使用本目录实录采样和合成单音，不引用现有歌曲旋律。
- `previews/`：上述编曲的 192 kbps MP3 试听，带起止淡变，不能替代无淡出的 WAV 循环。

编曲中的实录单音会做播放增益调整和带抗混叠滤波的变调，不修改原始单音资产。循环渲染三个连续周期，提取中间周期承接尾音，再施加环形延迟；不会为了获得“循环”标记而把整段强制淡出。暖 Pad 是 6 秒单音，不含 sustain-loop 点，长音仍需按需重叠或重新合成。

## 复现与检查

在仓库根目录，用已安装 `scripts/requirements-palette.txt` 的 Python 环境和 FFmpeg 执行：

```sh
python scripts/build_sound_palette.py build
python scripts/build_sound_palette.py verify
```

第一次 build 读取固定 commit 的网络资源，原始下载只缓存在 Git 忽略的 `artifacts/asset-research/downloads/`。谱面在 `scripts/presets/sound-palette.json`。verify 使用已交付资产离线核对 SHA-256、可解码性、非静音/非削波、准确循环帧数和边界跃变；不需要下载源库。不同 FFmpeg / libsndfile 版本可能改变编码文件散列，重建后以新 manifest 为准。

这些测量与自动检查是客观验证，**没有进行人工耳听**；没有以自动通过推断音色自然、音乐好听或发行品质。
