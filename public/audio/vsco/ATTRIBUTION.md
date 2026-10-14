# VSCO 2 Community Edition 原声采样

本目录选取 VSCO 2 Community Edition 的 25 个真实录音乐器样本。录音作者为 **Sam Gossner / Versilian Studios** 与 **Simon Dalzell / Ivy Audio**，切样为 **Elan Hickler / Soundemote**。这里使用长笛、小提琴组、大提琴组和竖琴，未包含人声。

- 官方项目：[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)。官方页面明确写明 CC0（Creative Commons Zero / public domain）。
- 原始 WAV 来源：[sgossner/VSCO-2-CE](https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e)，固定 master commit `440300901dfe9275fd84e0b7763af1f8443ae62e`。
- 原始授权：[CC0 1.0 Universal](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE)，完整许可也保存在本目录 `LICENSE`。原仓库 `README.md` 与 `Readme.txt` 记载作者和使用说明。
- 音高交叉核对：[原项目 SFZ 分支](https://github.com/sgossner/VSCO-2-CE/tree/6dd651d55dde97fd4028699be9d4481f26917891)，固定 commit `6dd651d55dde97fd4028699be9d4481f26917891` 的 `pitch_keycenter`，同时检查录音频谱。长笛、小提琴组、大提琴组的原 WAV 文件名使用比科学音高低一八度的命名，而竖琴使用科学音高；因此文件名不能直接当作 MIDI 音高。例如长笛原 `A3` 是 MIDI 69 / 440 Hz，本目录按科学音高命名为 `flute-A4.mp3`。

## 选用的录音

每个音高只保留一条录音。本目录没有多力度层、round robin 或连奏采样。长笛低音区的选样与高音区采用不同的原录音力度组，但不根据 MIDI velocity 动态切换；velocity 在播放器中控制增益。长音均保留原演奏中的自然波动，没有制作采样循环。

| 本地文件 / MIDI | 原始 WAV（相对源仓库） |
| --- | --- |
| flute-C4.mp3 / 60 | Woodwinds/Flute/susvib/LDFlute_susvib_C3_v1_1.wav |
| flute-E4.mp3 / 64 | Woodwinds/Flute/susNV/LDFlute_susNV_E3_v3_1.wav |
| flute-A4.mp3 / 69 | Woodwinds/Flute/susNV/LDFlute_susNV_A3_v3_1.wav |
| flute-C5.mp3 / 72 | Woodwinds/Flute/susNV/LDFlute_susNV_C4_v1_1.wav |
| flute-E5.mp3 / 76 | Woodwinds/Flute/susNV/LDFlute_susNV_E4_v1_1.wav |
| flute-A5.mp3 / 81 | Woodwinds/Flute/susNV/LDFlute_susNV_A4_v1_1.wav |
| strings-G3.mp3 / 55 | Strings/Violin Section/susVib/VlnEns_susVib_G2_v1.wav |
| strings-B3.mp3 / 59 | Strings/Violin Section/susVib/VlnEns_susVib_B2_v1.wav |
| strings-D4.mp3 / 62 | Strings/Violin Section/susVib/VlnEns_susVib_D3_v1.wav |
| strings-Fs4.mp3 / 66 | Strings/Violin Section/susVib/VlnEns_susVib_F#3_v1.wav |
| strings-A4.mp3 / 69 | Strings/Violin Section/susVib/VlnEns_susVib_A3_v1.wav |
| strings-C5.mp3 / 72 | Strings/Violin Section/susVib/VlnEns_susVib_C4_v1.wav |
| strings-E5.mp3 / 76 | Strings/Violin Section/susVib/VlnEns_susVib_E4_v1.wav |
| cello-B2.mp3 / 47 | Strings/Cello Section/susvib/susvib_B1_v1_1.wav |
| cello-D3.mp3 / 50 | Strings/Cello Section/susvib/susvib_D2_v1_1.wav |
| cello-F3.mp3 / 53 | Strings/Cello Section/susvib/susvib_F2_v1_1.wav |
| cello-A3.mp3 / 57 | Strings/Cello Section/susvib/susvib_A2_v1_1.wav |
| cello-C4.mp3 / 60 | Strings/Cello Section/susvib/susvib_C3_v1_1.wav |
| harp-G3.mp3 / 55 | Strings/Harp/KSHarp_G3_mf.wav |
| harp-B3.mp3 / 59 | Strings/Harp/KSHarp_B3_mf.wav |
| harp-D4.mp3 / 62 | Strings/Harp/KSHarp_D4_mf.wav |
| harp-F4.mp3 / 65 | Strings/Harp/KSHarp_F4_mf.wav |
| harp-A4.mp3 / 69 | Strings/Harp/KSHarp_A4_mf.wav |
| harp-C5.mp3 / 72 | Strings/Harp/KSHarp_C5_mf.wav |
| harp-E5.mp3 / 76 | Strings/Harp/KSHarp_E5_mf.wav |

## 本地处理与测量

1. 使用 FFmpeg 读取原 WAV 的左声道，重采样至 44.1 kHz 单声道，避免把不同麦克风直接平均而产生相位抵消。
2. 以 10 ms 区块 RMS 检查录音起音和尾声。有效区阈值为区块最高 RMS 的 1.5% 与 −60 dBFS 两者的较高者。起音前保留约 15 ms，最后有效区后保留最多 650 ms 的自然录音，末尾 20 ms 轻微淡出。保留实际奏出的数秒长音或拨弦衰减；未作机械循环。
3. 编码为 **128 kbps / 44.1 kHz / mono MP3**。没有峰值归一化、响度归一化、去噪、均衡、人工混响或音高校正。`sample-manifest.json` 记录每个原 WAV / 本地 MP3 的 SHA-256、准确裁切帧、实际时长及峰值 / RMS。
4. 播放器可使用有限的采样增益补偿：测量文件起点后 0.4–2.4 秒的 RMS，参照第五版实际音域的中位值（长笛 MIDI 72–81、小提琴 MIDI 55–69、大提琴 MIDI 48–59、竖琴 MIDI 60–76），增益限制为 0.5–2 倍。源文件振幅保持不变，补偿系数在 manifest 与 `getAcousticSampleGain` 中记录。这不增加录音力度层，也不替代听感判断。

原 SFZ 各 region 的增益也记录在 manifest：`FluteSusNV.sfz` 的 v1 为 +12 dB、v3 为 +4 dB；本目录的 MIDI 60 长笛来自 `FluteSusVib.sfz`，为 +8 dB。`ViolinEnsSusVib-Quiet.sfz` 为 +20 dB，`CelloEnsSusVib-Quiet.sfz` 为 +16 dB，`Harp.sfz` 为 +10 dB。这些是源预设数据；本项目的总音量与混音参数由当前编曲决定。

上述频谱、电平与时长均为客观测量，采样选择尚未经人工耳听。
