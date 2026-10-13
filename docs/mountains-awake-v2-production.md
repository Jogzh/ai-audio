# 《山河醒》第二版

第一版保存于 commit `97cfa6c`，96 BPM 三版 MP3 在 `releases/mountains-awake/`。第二版针对“配器乱、节奏不好”的反馈重新写主旋律与编曲，并调整音源。

## 本版调整

- 速度改为 **104 BPM**，保持 48 小节结构。
- 每小节一三拍有底鼓，二四拍有拍手与短军鼓主体；低音根音跟随底鼓，取消额外的低八度 sub。副歌第一拍始终保留底鼓，深鼓只作句尾与转段。
- 副歌主题从 **35 个音减少到 24 个音**，采用半拍网格上的三音上行与下行应答，增加长音和休止。第一副歌笛子最高 A5，最终变奏最高 C6，取消尖锐的 D6。
- 筝领奏引子、二胡领奏主歌与桥段、笛子领奏副歌。持续和声只用三声部的一层 pad 或 strings，取消重复铺底、主旋律弦乐加倍与副歌筝扫弦。
- 和声简化为两小节一换的 Dm / Bb / F / C。铜管延后到最终副歌后八小节，只在乐句开头出现。
- 笛子不再发送节拍回声，筝回声减少，并对齐八分音符；降低公共混响、笛子高频与振音幅度，让旋律和鼓的起音更清楚。钟玉颗粒只保留两个装饰位置。

这些调整回应用户的听感反馈。检查用于确认编曲约束、音频有效性和播放流程；不把自动检查当作“更好听”的证明。本次未人工耳听。

## 成品

参数为 104 BPM / 移调 0 / seed 261013。MP3 是 320 kbps、44.1 kHz、立体声；原始 WAV 为 PCM16。母带目标沿用项目 −14 LUFS / −1.5 dBTP / LRA 9，以下为编码后实测：

| 版本 | 音乐内容时长 | 实测响度 | 实测 true peak |
| --- | ---: | ---: | ---: |
| full | 114.369 s | −13.82 LUFS | −1.49 dBTP |
| hook | 20.062 s | −14.03 LUFS | −1.50 dBTP |
| loop | 18.462 s | −14.09 LUFS | −1.50 dBTP |

主体音乐为 110.769 秒，full 保留 3.6 秒尾音。hook / loop 提取实际第 17–24 小节，full 中约 36.923–55.385 秒；hook 保留 1.6 秒尾音，loop 渲染三轮后取第三轮，不增加时长。

MP3 位于 `releases/mountains-awake-v2/`；WAV、母带报告和原始导出 manifest 在 `artifacts/audio/mountains-awake-v2/`。三个 MP3 再解码检查均无非有限数、无满刻度削波，内容时长与 manifest 一致。转成单声道时整体 RMS 变化约 −0.06 dB。

本版增加一项编曲检查，确认八小节副歌持续保留一三拍底鼓、二四拍 backbeat、同拍低音、单层和声及主旋律间隔。全部 34 项测试与生产构建通过。浏览器检查和源码指纹记录在第二版 release manifest。

## 复现与试听

```bash
npm run render -- --track mountains-awake --seed 261013 --format both --out artifacts/audio/mountains-awake-v2-local
npm run check
npm run test:browser
```

网页 `/?track=mountains-awake&version=hook` 使用当前第二版。要复现第一版，请在独立 checkout 中使用 `97cfa6c` 的源码；第一版 MP3 可直接播放比较。
