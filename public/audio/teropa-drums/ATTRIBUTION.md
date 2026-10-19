# @teropa/drumkit — closed and open hats

本目录只保留《风经过的地方》实际使用的两个踩镲样本，来源为 `@teropa/drumkit@1.1.0`。该包代码为 MIT，样本本身不随代码许可授权。

- 上游仓库：[teropa/drumkit](https://github.com/teropa/drumkit)
- npm 包：`@teropa/drumkit@1.1.0`，下载地址 `https://registry.npmjs.org/@teropa/drumkit/-/drumkit-1.1.0.tgz`
- 原始合集：[DWSD's Deep House Drum kit](https://freesound.org/people/DWSD/packs/11575/?page=1#sound)，作者 **DWSD**
- 样本许可：上游 README 写明为 **Creative Commons Attribution**，未断言具体版本。使用与再分发时应保留作者与来源署名。
- 上游 README 也列出包内其他样本（cymbal、toms）的 CC0 来源；本目录不包含这些文件。

## 本地文件

| 文件 | SHA-256 | 说明 |
| --- | --- | --- |
| `hatClosed.wav` | `5ee32eebadf1a40ad9320d79c9d765ff1a42e83751779cd7bf9308366c634ccb` | 由上游 MP3 解码为 24-bit / 44.1 kHz PCM，未做音高、时长或电平再处理 |
| `hatOpen.wav` | `3a021aee04a3feb7378cdd2398efc05d7e9f7468fe32f7993998c1c571ce9dd6` | 同上 |

原始解码与来源记录保存在本地 `artifacts/audio/flowers-reimagined/source/drums/`（Git 忽略）。本目录的两个文件用于 `scripts/wind_passes.py` 的踩镲声部；底鼓、刷子军鼓和沙锤由脚本合成，不使用本目录素材。

许可边界以源样本为准；仓库的 MIT 许可只覆盖代码，不覆盖这些录音。
