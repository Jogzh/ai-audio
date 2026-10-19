# 声音与资产盘点 · 2026-10-19

## 本次补充

新增 **43 项、约 39.4 MiB** 可复用音频，位于 `public/audio/palette/`。运行 `npm run dev` 后打开 `/palette.html`，也可从主创作台页脚进入声音素材库。页面支持分类、直接试听、WAV 循环播放与下载。

| 资产 | 数量 | 用途 |
| --- | ---: | --- |
| VSCO CC0 实录 | 16 | 马林巴 4、木琴 4、军鼓 4、铃鼓 2、三角铁 1、吊镲 1 |
| 原创合成单音 | 14 | 电钢琴 3、Sub 2、Reese 2、Pad 2、底鼓/边击/开闭镲/沙锤各 1 |
| 原创转场 | 4 | 噪声上升、下降、低频冲击、反向钟音 |
| 8 小节 WAV 循环 | 6 | 三种风格各一条鼓/打击乐循环和一条编曲循环 |
| MP3 风格示例 | 3 | 带淡出的短试听 |

| 风格谱面 | BPM / 调性 | 8 小节长度 | 设计 |
| --- | --- | ---: | --- |
| Lo-fi Soul | 92 / D minor | 20.86957 秒 | 电钢琴七和弦、延后踩镲、稀疏鼓点、马林巴短句 |
| UK Garage / 2-step | 132 / F minor | 14.54546 秒 | 跳拍底鼓、切分和弦、Sub、两力度军鼓和 ghost note |
| Ambient Mallets | 96 / C major | 20 秒 | 缓起 Pad、马林巴/木琴应答、铃鼓和三角铁轻脉冲 |

循环长度按最接近的整数音频帧表示。WAV 不作整段淡入淡出，保持自然跨周期尾音；MP3 示例用于试听，不能作为精确拼接的循环源。本次素材按 CC0 发布，来源和完整授权见 [素材署名](../public/audio/palette/ATTRIBUTION.md)。该授权只覆盖新增目录。

## 盘点依据与剩余缺口

这次盘点基于源码、已跟踪文件和采样 manifest，没有对已有音频进行人工耳听。

| 类别 | 现有能力与本次结果 | 后续最有价值的补充 |
| --- | --- | --- |
| 原声旋律 | 原有 Salamander 钢琴、VSCO 长笛/小提琴组/大提琴/竖琴；新增马林巴与木琴 | 实录木吉他、电吉他 clean/mute、原声贝斯；多力度钢琴与断奏弦乐 |
| 电子音色 | 原有 Tone.js / Python 合成器；新增可下载的电钢琴、Sub/Reese、Pad 单音 | 可保存的合成器参数、音色宏控制、不同力度触感 |
| 鼓与打击乐 | 原有电子/中国鼓合成与两条踩镲录音；新增军鼓、铃鼓、三角铁、吊镲及合成底鼓/边击 | 一套统一录音的流行/摇滚原声鼓组，含 tom、ride、更多力度与变体 |
| 中国器乐 | 有古筝、笛子、二胡、古琴、箫等合成配方 | 来源与再分发许可清楚的真实民族乐器采样；尤其滑音、揉弦、气息与演奏法切换 |
| 风格与节奏 | 原有电子流行、国风、Techno/Club、钢琴抒情与 DJ 工具；新增三种独立 8 小节谱面 | 完整的 Funk/Disco、摇滚、Bossa/拉丁打击乐配方，以及更多 6/8、3/4 拍型 |
| 转场与纹理 | 原有代码合成 sweep/impact；新增可下载转场 | 有地点、设备与许可记录的真实雨、风、街道、房间底噪及立体声 IR |
| 人声 | 本地制作曾用歌曲分轨与合成人声；没有通用可再分发人声库 | 有明确演唱者同意和素材再分发授权的干声、和声、ad-lib；需要单独确认具体素材 |
| 资产管理 | 新增统一目录、音高/BPM/小节、来源、许可、SHA-256 与测量 | 后续可让各创作脚本统一读取 manifest，减少硬编码；本次目录可直接用于 DAW 与采样器 |

没有找到明确再分发许可的商业歌曲分轨、人声包或民族器乐包，不纳入本次通用资产库。真实环境录音与 IR 本次也没有补充；合成噪声转场不算实地录音。

## 复现

已有 DJ Python 环境可直接复用；新环境只需轻量的 NumPy / SciPy / SoundFile，加 FFmpeg：

```sh
python3 -m venv artifacts/palette-tools
artifacts/palette-tools/bin/pip install -r scripts/requirements-palette.txt
artifacts/palette-tools/bin/python scripts/build_sound_palette.py build
artifacts/palette-tools/bin/python scripts/build_sound_palette.py verify
npm run test:palette
```

`scripts/presets/sound-palette.json` 保存风格谱面、BPM、调性、和弦、旋律、鼓点与 swing 偏移。`scripts/build_sound_palette.py` 保存下载、处理、合成、变调、编排与验证逻辑。固定 upstream commit，原 WAV 只缓存在忽略目录。交付 manifest 逐项保存处理后文件 SHA-256；实录还保存原始 SHA-256 与裁切帧。运行 `verify` 不访问网络，运行 browser 检查需要本地 Chromium（可用现有 `npx playwright install chromium` 安装）。

`manifest.json` 中的峰值、RMS、DC、时长和 seamDelta 是客观测量。自动检查覆盖解码、非静音、无削波、准确循环长度和循环边界，浏览器另检查实际播放推进、分类、单次播放、下载与窄屏宽度。**尚未进行人工耳听，不据此评价自然度、音乐性或发行质量。**
