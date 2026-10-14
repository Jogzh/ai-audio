# 《霓虹长安 · 灯起》人声 DJ 版

本版回应“加入人的声音、让 DJ 更丰富”的目标，保留《霓虹长安》的原创主题与国风音色，另注册 `neon-changan-vocal`。128 BPM / D 小调五声旋律 / 60 小节；完整编曲 112.5 秒，保留 2.5 秒尾音。原纯音乐版与其本地成品继续可用。

## 制作参考与适用范围

2026-10-14 检索并核验了以下原始页面：

- [Output：Vocal Chops 101: From Raw Sample to Finished Hook](https://output.com/blog/vocal-chop-sounds)，页面发布于 2026-02-27。教程解释人声切片作为旋律和节奏钩子、变调映射、重排与反向播放、颗粒空间层、饱和与节奏门控。这是制作技术参考，不能作为抖音当日趋势或传播效果的证据。未使用其商业音源或订阅产品。
- [Kokoro 官方中文模型卡](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)，82M 参数、Apache-2.0、24 kHz 输出；用于本地生成原创中文短句，通用女声 `zf_001` 与男声 `zm_010`。选择语音模型是本项目的实现判断；模型不提供成品歌曲或歌手演唱。

没有核验当日抖音榜单。把传播诉求转成创作目标：开场有可辨识口号、前八小节有完整问答、每八小节有转身、15 秒循环、30 秒剪辑在第 15 秒抬升。不能保证成为爆款。

## 人声与编曲

主口号为“**长安入夜，灯起！**”。开场女声“长安入夜，霓虹开城”，男声在 Drop 回应“灯起”。舞池段男声“跟着鼓点，点亮长安”，月下桥段女声“不问归途，只赴今夜”。文字原创；不是歌手录音或名人克隆。

Drop 用口号、人声旋律切片、唢呐与古筝轮流领奏。在口号与主切片所在小节移除唢呐和古筝的主奏起音，空间发送仍可能跨入下一句。每八小节末尾去掉最后一拍的常规鼓、低音和主旋律，换成三次碎拍与人声断奏；为下一轮底鼓留出短空隙。酸性电子音仅在古筝段落的句尾回答；呼吸和声只在桥段进入，反向人声连接蓄力与 Drop。

20 条独立轨道中，新增六条为中文口号、人声切片、呼吸和声、反向人声、酸性电子音和碎拍军鼓。轨道数不作为音乐质量的证据；hook 中休止轨道在网页禁用。相同底鼓驱动保留在 solo / mute 渲染中，分轨可以线性还原原始混音。

人声源为 24 kHz，通过 WORLD 保留频谱包络并替换元音基频，制作 A4 旋律切片、D4 呼吸和声；语音使用相位声码器对齐定稿时长。浏览器在 BPM 改变时以 WSOLA 对齐短句时值，不随移调改变讲话音高。旋律切片使用采样变速跟随旋律和移调，会改变音色；极端 BPM 或移调需要实际试听。最终采样以 48 kHz PCM24 保存，但不是原生 48 kHz 录音。详见[来源与处理记录](../public/audio/night-city/ATTRIBUTION.md)。

## 复现

音源 WAV 随源码保存，新克隆无需安装 Python 即可网页试听或导出。音源再生成使用 `scripts/requirements-vocals.txt`、`scripts/generate-night-city.py` 与固定模型权重；在隔离的 Python 3.11 环境安装依赖，模型文件放入 `artifacts/vocal-model/`，脚本先校验 SHA256。生成默认拒绝覆盖已有 manifest。神经模型在不同硬件或依赖版本上不承诺输出逐位相同；音乐渲染使用随库固定的 PCM。

```bash
npm run render:vocal -- --out releases/neon-changan-vocal
npm run package:neon -- --dir releases/neon-changan-vocal
npm run check
node scripts/check-guofeng.mjs --vocal
```

前两条生成 full / hook / loop 和最终 Drop 的 30 秒版。成品 MP3/WAV 只保存在本地，Git 保存源码、采样、来源与实测记录；请使用新目录避免覆盖旧版本。

## 验证与听感状态

已生成并解码验证四个成品：

- full：115.00 秒；WAV/MP3 实测 −14.04 LUFS，true peak −1.45/−1.43 dBTP。
- hook：15.65 秒；WAV/MP3 实测 −14.31 LUFS，true peak −1.50/−1.45 dBTP。
- loop：15.00 秒；WAV/MP3 实测 −14.28 LUFS，true peak −1.50/−1.45 dBTP。
- Douyin 30：30.00 秒；WAV/MP3 实测 −14.00 LUFS，true peak −2.53/−2.47 dBTP。

所有成品均为立体声 48 kHz；WAV 为 PCM24，MP3 为 320 kbps；解码无削波，循环边缘为零。人声版专属 Chromium 检查通过，覆盖 11 个音源、固定 seed、BPM/移调边界、单声道折叠、分轨相加、播放器进度和 WAV 下载。**本版没有进行人工耳听**；编曲取舍属于制作判断，自动测试、音高测量、播放器进度与响度数据不能代表听感评价。
