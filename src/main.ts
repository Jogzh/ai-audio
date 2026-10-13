import './style.css';
import * as Tone from 'tone';
import { renderTrack } from './engine/render';
import { trackRegistry, defaultTrack, findTrack } from './tracks/registry.ts';
import { encodeWav, measureAudio } from './audio/wav';
import type { RenderOptions, RenderedTrack } from './music/types';

const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke-width="4"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-6 5H2v4h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
};
const query = new URLSearchParams(window.location.search);
let selectedTrack = findTrack(query.get('track') ?? '') ?? defaultTrack;
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('页面挂载点不存在');
app.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="#main" aria-label="原创音乐创作台"><span class="brand-symbol" aria-hidden="true">n/r</span> REBOUND<span class="wordmark-light"> / AUDIO LAB</span></a>
    <span class="header-note"><i aria-hidden="true"></i> 原创声音实验 · 三种听感</span>
  </header>
  <main id="main">
    <section class="hero" aria-labelledby="track-title">
      <div class="cover" role="img" aria-label="酸性青柠色轨道圆环，紫色霓虹光晕与深蓝扫描线组成的原创抽象封面">
        <div class="cover-top"><span id="cover-id"></span><span>ORIGINAL ARRANGEMENT</span></div>
        <div class="orbital-art" aria-hidden="true"><div class="orbital-halo"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="orbit orbit-four"></div><div class="orbit-center"></div><div class="orbit-axis"></div></div>
        <div class="cover-bottom"><span id="cover-title"></span><span class="cover-code" id="cover-code"></span></div>
      </div>
      <div class="track-intro">
        <div class="eyebrow"><span class="tiny-line"></span> ELECTRONIC / ORIGINAL TRACK</div>
        <h1 id="track-title"></h1>
        <p class="chinese-title" id="chinese-title"></p>
        <p class="description" id="track-description"></p>
        <div class="tags" id="track-tags" aria-label="曲目风格"></div>
        <dl class="track-facts"><div><dt>节奏</dt><dd><span id="bpm-fact"></span> <small>BPM</small></dd></div><div><dt>原始调性</dt><dd id="key-fact">—</dd></div><div><dt>完整结构</dt><dd><span id="bars-fact"></span> <small>小节</small></dd></div></dl>
        <div class="original-note"><span aria-hidden="true">//</span> 原创编曲 · 合成与授权音源 <span class="note-end">ORIGINAL SCORE / LICENSED SOUNDS.</span></div>
      </div>
    </section>

    <section class="studio" aria-labelledby="studio-title">
      <div class="section-heading"><div><span class="section-number">01 /</span><h2 id="studio-title">声音工作台</h2></div><span class="section-aside">调节。试听。带走你的版本。</span></div>
      <div class="studio-body">
        <div class="transport-panel">
          <div class="player-heading"><div class="player-track"><span class="track-marker" aria-hidden="true"></span><div><strong id="player-title"></strong><span id="version-caption">完整旅程 / FULL MIX</span></div></div><span id="render-badge" class="render-badge">等待合成</span></div>
          <div class="waveform" id="waveform"><canvas id="wave-canvas" aria-hidden="true"></canvas><div id="playhead" class="playhead" hidden><span></span></div><div id="wave-placeholder" class="wave-placeholder"><span class="wave-placeholder-line" aria-hidden="true"></span><span>声音尚未生成</span><small>点击播放，点亮这段声波</small></div></div>
          <div class="seek-row"><span id="current-time">00:00</span><label class="sr-only" for="seek">播放进度</label><input id="seek" type="range" min="0" max="1" step="0.01" value="0" disabled aria-valuetext="尚未生成音频"><span id="total-time">--:--</span></div>
          <div class="transport"><div class="transport-buttons"><button id="play" class="play-button" type="button">${icons.play}<span>播放</span></button><button id="stop" class="icon-button" type="button" aria-label="停止并回到开头" disabled>${icons.stop}</button><span id="play-state" class="play-state">准备就绪</span></div><div class="volume-control"><label for="volume">${icons.volume}<span class="sr-only">播放音量</span></label><input id="volume" type="range" min="0" max="1" step="0.01" value="0.65"><output id="volume-value" for="volume">65%</output></div></div>
          <p id="status" class="status" role="status" aria-live="polite" aria-atomic="true">首次试听请先调低设备音量。声音仅在你操作后生成。</p>
          <div class="structure-heading"><h3>声音结构</h3><span id="structure-caption">合成后显示实际时间线</span></div>
          <div id="section-timeline" class="section-timeline" aria-label="音频分段时间线"><p class="timeline-empty">从第一句旋律，到最后一缕回声。</p></div>
          <div class="score-note" id="score-note"><span id="score-title"></span><p id="score-sections"></p></div>
        </div>
        <aside class="config-panel" aria-labelledby="config-title">
          <div class="config-heading"><h3 id="config-title">塑造你的声音</h3><span>EDIT THE SIGNAL</span></div>
          <fieldset id="render-controls">
            <legend class="sr-only">合成版本与参数</legend>
            <div class="track-field"><label for="track-select">试听作品 <span>TRACK</span></label><select id="track-select"></select><p class="field-help">默认试听微醺舞步精华；也可以切换其他作品对比。</p></div>
            <div class="field-heading"><span id="version-label">曲目版本</span><span>VERSION</span></div>
            <div class="version-switch" role="group" aria-labelledby="version-label"><button type="button" data-version="full" aria-pressed="true">完整 <small>FULL</small></button><button type="button" data-version="hook" aria-pressed="false">精华 <small>HOOK</small></button><button type="button" data-version="loop" aria-pressed="false">循环 <small>LOOP</small></button></div>
            <p id="version-description" class="field-help"></p>
            <div class="parameter-grid"><div class="number-field"><label for="bpm">速度 <span>BPM</span></label><input id="bpm" type="number" min="90" max="170" step="1" value="${selectedTrack.meta.bpm}" required><small>90 — 170</small></div><div class="number-field"><label for="transpose">移调 <span>SEMITONES</span></label><input id="transpose" type="number" min="-12" max="12" step="1" value="0" required><small>−12 — +12 半音</small></div></div>
            <div class="number-field seed-field"><label for="seed">随机种子 <span>SEED</span></label><input id="seed" type="number" min="0" max="4294967295" step="1" value="260713" required><small>同一组参数，同一段原创声音。</small></div>
          </fieldset>
          <div class="export-area"><button id="export" class="export-button" type="button">${icons.download}<span>导出 WAV</span><span class="button-arrow" aria-hidden="true">↗</span></button><p>立体声 / 44.1 kHz / 16 bit PCM</p></div>
          <dl class="audio-metrics"><div><dt>峰值</dt><dd id="peak">— <small>dBFS</small></dd></div><div><dt>平均电平</dt><dd id="rms">— <small>dBFS</small></dd></div></dl>
        </aside>
      </div>
    </section>

    <section class="sample-credits" aria-labelledby="credits-title"><h2 id="credits-title">音源署名</h2><button id="export-credits" class="export-button" type="button" hidden>单独下载音源署名</button><div id="sample-credits" aria-live="polite"></div></section>

    <section class="layers" aria-labelledby="layers-title"><div class="section-heading"><div><span class="section-number">02 /</span><h2 id="layers-title">拆开这段律动</h2></div><span class="section-aside">三层声音，一个夜晚。</span></div><div class="layer-list"><article class="layer"><div class="layer-art melody-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div><span class="layer-index">01 / MELODY</span><h3>旋律 <span>主题与应答</span></h3><p id="melody-description"></p></div></article><article class="layer"><div class="layer-art drum-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div><span class="layer-index">02 / DRUMS</span><h3>鼓 <span>节奏里的呼吸</span></h3><p id="drum-description"></p></div></article><article class="layer"><div class="layer-art bass-art" aria-hidden="true"><i></i><i></i><i></i></div><div><span class="layer-index">03 / BASS</span><h3>低音 <span>托住情绪</span></h3><p id="bass-description"></p></div></article></div></section>
  </main>
  <footer><span class="footer-brand" id="footer-title"></span><span>原创编曲 / 授权音源 · 请以舒适音量聆听</span><a href="#main">回到顶部 ↑</a></footer>
`;

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`缺少页面元素：${selector}`);
  return found;
}
const playButton = element<HTMLButtonElement>('#play');
const stopButton = element<HTMLButtonElement>('#stop');
const exportButton = element<HTMLButtonElement>('#export');
const creditsButton = element<HTMLButtonElement>('#export-credits');
const controls = element<HTMLFieldSetElement>('#render-controls');
const trackSelect = element<HTMLSelectElement>('#track-select');
trackSelect.replaceChildren(...trackRegistry.map(({ meta }) => {
  const option = document.createElement('option');
  option.value = meta.id;
  option.textContent = `${meta.title} · ${meta.subtitle}`;
  return option;
}));
const bpmInput = element<HTMLInputElement>('#bpm');
const transposeInput = element<HTMLInputElement>('#transpose');
const seedInput = element<HTMLInputElement>('#seed');
const seek = element<HTMLInputElement>('#seek');
const volume = element<HTMLInputElement>('#volume');
const canvas = element<HTMLCanvasElement>('#wave-canvas');
const waveform = element<HTMLDivElement>('#waveform');
const playhead = element<HTMLDivElement>('#playhead');
const timeline = element<HTMLDivElement>('#section-timeline');
const status = element<HTMLParagraphElement>('#status');
const badge = element<HTMLSpanElement>('#render-badge');
const versions = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-version]'));
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.65;
let version: RenderOptions['version'] = 'hook';
const queryVersion = query.get('version');
if (queryVersion === 'full' || queryVersion === 'hook' || queryVersion === 'loop') version = queryVersion;
let track: RenderedTrack | null = null;
let wavBlob: Blob | null = null;
let playbackUrl: string | null = null;
let busy = false;
let toneReady = false;
let active = true;
let generation = 0;
let frame = 0;
const downloadUrls = new Map<string, ReturnType<typeof setTimeout>>();
const versionCopy = {
  full: ['完整旅程 / FULL MIX', ''],
  hook: ['精华片段 / HOOK EDIT', '八小节主旋律，从第一句听到完整应答。'],
  loop: ['循环片段 / LOOP EDIT', '适合反复聆听的循环片段，播放时自动循环。'],
};
const productionCopy: Record<string, { coverId: string; melody: string; drums: string; bass: string }> = {
  'disco-house': {
    coverId: 'VH—003',
    melody: 'CC BY 本地原声吉他的拨弦质感，搭配风琴反拍；轻 DJ 听感，不靠猛烈 Drop。',
    drums: '稳定四拍，沙锤、边击与康加鼓织成轻盈律动，段落自然推进。',
    bass: 'CC BY 本地电贝斯音源，真实拨弦与柔韧低频托住微醺舞步。',
  },
  'warm-house': {
    coverId: 'AT—002',
    melody: '柔和主音与温暖电钢琴，八小节问答有展开，也有收束。',
    drums: '克制四拍鼓点，踩镲稍稍靠后，段落之间留出呼吸。',
    bass: '平稳根音与柔软低频，不用频繁八度跳进抢走旋律。',
  },
  default: {
    coverId: 'NR—001',
    melody: '四音动机与短促合成器，保留原版的弹跳感。',
    drums: '错位底鼓、两步节奏与细碎打击乐。',
    bass: '短促低音与 sub 叠加，强调反拍的回弹。',
  },
};
const sectionNames: Record<string, string> = { open: '序幕', groove: '律动', build: '蓄能', drop: '回弹', air: '留白', outro: '尾声' };
function syncTrack(): void {
  const { meta, arrangement } = selectedTrack;
  const copy = productionCopy[selectedTrack.production ?? 'default'] ?? productionCopy.default;
  const bars = arrangement.reduce((sum, section) => sum + section.bars, 0);
  const [first, ...rest] = meta.subtitle.split(' ');
  element('#track-title').innerHTML = `${first}<br><span>${rest.join(' ')}</span><span class="title-dot">.</span>`;
  element('#cover-title').innerHTML = `${first}<br>${rest.join(' ')}<span class="cover-period">.</span>`;
  element('#chinese-title').textContent = meta.title;
  element('#track-description').textContent = meta.description;
  element('#player-title').textContent = meta.title;
  element('#key-fact').textContent = meta.key;
  element('#bpm-fact').textContent = bpmInput.value;
  element('#bars-fact').textContent = String(bars);
  element('#cover-id').textContent = copy.coverId;
  element('#cover-code').innerHTML = `${meta.bpm} / FREQ<br>STEREO FIELD`;
  element('#footer-title').textContent = `${meta.subtitle} / ${meta.title}`;
  element('#score-title').textContent = `FULL SCORE / ${bars} 小节`;
  element('#score-sections').textContent = arrangement.map(section => `${section.name.split('/').at(-1)?.trim()} ${section.bars}`).join(' · ');
  versionCopy.full[1] = `${bars} 小节完整旅程，层次逐步展开。`;
  element('#track-tags').replaceChildren(...meta.tags.map(tag => { const span = document.createElement('span'); span.textContent = tag; return span; }));
  element('#melody-description').textContent = copy.melody;
  element('#drum-description').textContent = copy.drums;
  element('#bass-description').textContent = copy.bass;
  trackSelect.value = meta.id;
  document.title = `${meta.subtitle} / ${meta.title}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
}

function creditLink(label: string, value: string): HTMLElement {
  const text = document.createElement('span');
  text.textContent = label;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return text;
    const link = document.createElement('a');
    link.href = url.href;
    link.textContent = label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch {
    return text;
  }
}
function drawCredits(): void {
  const container = element('#sample-credits');
  container.replaceChildren();
  creditsButton.hidden = !track?.credits.length;
  if (!track || !track.credits.length) {
    const note = document.createElement('p');
    note.textContent = track ? '本次渲染未返回外部音源署名。' : '音频加载后展示实际音源署名；原创合成曲无外部音源。';
    container.append(note);
    return;
  }
  const list = document.createElement('ul');
  for (const credit of track.credits) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = `${credit.title} — ${credit.author}`;
    const source = document.createElement('p');
    source.append('出处：', creditLink(credit.source, credit.source), ' · ', creditLink(credit.license, credit.licenseUrl));
    const modifications = document.createElement('p');
    modifications.textContent = `修改：${credit.modifications}`;
    item.append(title, source, modifications);
    list.append(item);
  }
  container.append(list);
}
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    downloadUrls.set(url, setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 60_000));
  }
}

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}
function formatTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function duration(): number {
  return track ? (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : track.buffer.duration) : 0;
}
function syncControls(): void {
  controls.disabled = busy;
  playButton.disabled = busy;
  exportButton.disabled = busy;
  creditsButton.disabled = busy;
  stopButton.disabled = busy || !track;
  seek.disabled = busy || !track;
  element('#play-state').textContent = busy ? '合成处理中' : audio.paused ? '准备就绪' : '正在播放';
  const playing = !audio.paused;
  playButton.innerHTML = `${playing ? icons.pause : icons.play}<span>${playing ? '暂停' : '播放'}</span>`;
  playButton.setAttribute('aria-label', `${playing ? '暂停' : '播放'}${selectedTrack.meta.title}`);
  waveform.classList.toggle('is-playing', playing);
  element('.cover').classList.toggle('is-playing', playing);
  element('.studio').setAttribute('aria-busy', String(busy));
}
function syncVersion(): void {
  versions.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.version === version)));
  element('#version-caption').textContent = versionCopy[version][0];
  element('#version-description').textContent = versionCopy[version][1];
  element('#score-note').hidden = version !== 'full';
  audio.loop = version === 'loop';
}
function syncPosition(): void {
  const total = duration();
  const position = Math.max(0, Math.min(audio.currentTime || 0, total));
  seek.max = String(total || 1);
  seek.value = String(position);
  seek.style.setProperty('--range-progress', `${total ? position / total * 100 : 0}%`);
  seek.setAttribute('aria-valuetext', track ? `${formatTime(position)}，共 ${formatTime(total)}` : '尚未生成音频');
  element('#current-time').textContent = formatTime(position);
  element('#total-time').textContent = track ? formatTime(total) : '--:--';
  playhead.hidden = !track;
  playhead.style.left = `${total ? position / total * 100 : 0}%`;
  timeline.querySelectorAll<HTMLButtonElement>('[data-start]').forEach(button => {
    const current = position >= Number(button.dataset.start) && position < Number(button.dataset.end);
    button.classList.toggle('is-current', current);
    if (current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}
function cancelFrame(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}
function startFrame(): void {
  cancelFrame();
  if (document.hidden || !active) return;
  const tick = () => {
    syncPosition();
    if (active && !audio.paused && !audio.ended) frame = requestAnimationFrame(tick);
    else frame = 0;
  };
  tick();
}
function drawWaveform(): void {
  const width = waveform.clientWidth;
  const height = waveform.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#202837';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  if (!track) return;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#8e74ee'); gradient.addColorStop(0.4, '#adb4ae'); gradient.addColorStop(1, '#d0f879');
  ctx.fillStyle = gradient;
  const bars = Math.max(1, Math.floor(width / 4));
  const peaks = track.peaks;
  const buffer = track.buffer;
  // Bucket maxima retain transients when the canvas is narrower than the source peaks.
  const channels = peaks.length ? [] : Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const sourceLength = peaks.length || buffer.length;
  for (let i = 0; i < bars; i++) {
    const start = Math.floor(i * sourceLength / bars);
    const end = Math.max(start + 1, Math.floor((i + 1) * sourceLength / bars));
    let peak = 0;
    if (peaks.length) {
      for (let j = start; j < Math.min(end, sourceLength); j++) peak = Math.max(peak, Math.abs(peaks[j] ?? 0));
    } else {
      for (const channel of channels) {
        for (let j = start; j < Math.min(end, sourceLength); j++) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
      }
    }
    const barHeight = Math.max(2, Math.min(1, Number.isFinite(peak) ? peak : 0) * (height - 24));
    ctx.fillRect(i * width / bars, (height - barHeight) / 2, 2, barHeight);
  }
}
function drawSections(): void {
  timeline.replaceChildren();
  if (!track) {
    const note = document.createElement('p');
    note.className = 'timeline-empty';
    note.textContent = '从第一句旋律，到最后一缕回声。';
    timeline.append(note);
    element('#structure-caption').textContent = '合成后显示实际时间线';
    return;
  }
  const total = duration();
  element('#structure-caption').textContent = `${version.toUpperCase()} / ${formatTime(total)} · 点击分段定位`;
  let cursor = 0;
  const addGap = (length: number) => {
    if (length <= 0) return;
    const gap = document.createElement('span');
    gap.className = 'timeline-gap';
    gap.style.flex = `${length} 1 0%`;
    gap.setAttribute('aria-hidden', 'true');
    timeline.append(gap);
  };
  track.sections.forEach((section, index) => {
    if (!Number.isFinite(section.start) || !Number.isFinite(section.end)) return;
    const start = Math.max(cursor, Math.min(total, section.start));
    const end = Math.max(start, Math.min(total, section.end));
    if (end <= start) return;
    addGap(start - cursor);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `timeline-section section-color-${index % 4}`;
    button.style.flex = `${end - start} 1 0%`;
    button.dataset.start = String(start);
    button.dataset.end = String(end);
    const name = sectionNames[section.name.toLowerCase()] || section.name;
    button.title = `${name} · ${formatTime(start)} — ${formatTime(end)}`;
    button.setAttribute('aria-label', `定位到${name}，${formatTime(start)}至${formatTime(end)}`);
    const label = document.createElement('span'); label.textContent = name;
    const time = document.createElement('small'); time.textContent = formatTime(start);
    button.append(label, time);
    button.addEventListener('click', () => {
      if (busy || !track) return;
      audio.currentTime = start;
      syncPosition();
    });
    timeline.append(button);
    cursor = end;
  });
  addGap(total - cursor);
}
function invalidate(): void {
  audio.pause();
  cancelFrame();
  audio.removeAttribute('src');
  audio.load();
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  playbackUrl = null;
  wavBlob = null;
  track = null;
  badge.textContent = '等待合成';
  badge.classList.remove('is-ready');
  element('#peak').textContent = '— dBFS';
  element('#rms').textContent = '— dBFS';
  element('#wave-placeholder').hidden = false;
  syncControls(); syncPosition(); drawSections(); drawWaveform(); drawCredits();
}
function readOptions(): RenderOptions | null {
  const inputs = [bpmInput, transposeInput, seedInput];
  for (const input of inputs) {
    if (!input.checkValidity() || !Number.isInteger(input.valueAsNumber)) {
      setStatus('请输入有效整数：速度 90–170，移调 −12–12，种子 0–4294967295。', true);
      input.reportValidity(); input.focus();
      return null;
    }
  }
  return { version, bpm: bpmInput.valueAsNumber, transpose: transposeInput.valueAsNumber, seed: seedInput.valueAsNumber };
}
async function ensureTrack(options: RenderOptions, token: number): Promise<void> {
  if (track && wavBlob && playbackUrl) return;
  badge.textContent = '正在合成';
  setStatus('正在合成原创音频，首次生成可能需要片刻。请稍候…');
  const rendered = await renderTrack(selectedTrack, options);
  if (!active || token !== generation) return;
  if (!rendered.buffer.length || !Number.isFinite(rendered.buffer.duration) || rendered.buffer.duration <= 0) throw new Error('引擎未返回有效音频，请调整参数后重试。');
  if (rendered.buffer.sampleRate !== 44100 || rendered.buffer.numberOfChannels !== 2) throw new Error('音频格式不符：需要立体声 44.1 kHz 音频。');
  const bytes = encodeWav(rendered.buffer);
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  track = rendered;
  wavBlob = blob;
  playbackUrl = url;
  audio.src = url;
  audio.loop = options.version === 'loop';
  const stats = rendered.stats ?? measureAudio(rendered.buffer);
  element('#peak').textContent = `${stats.peakDb.toFixed(1)} dBFS`;
  element('#rms').textContent = `${stats.rmsDb.toFixed(1)} dBFS`;
  element('#wave-placeholder').hidden = true;
  badge.textContent = '合成完成';
  badge.classList.add('is-ready');
  drawWaveform(); drawSections(); syncPosition(); drawCredits();
}
async function perform(action: 'play' | 'export'): Promise<void> {
  if (busy || !active) return;
  if (action === 'play' && !audio.paused) {
    audio.pause();
    cancelFrame(); syncControls(); syncPosition();
    setStatus('已暂停。点击播放可继续。');
    return;
  }
  const options = readOptions();
  if (!options) return;
  const token = generation;
  busy = true;
  syncControls();
  try {
    if (action === 'play' && !toneReady) {
      setStatus('正在准备音频播放…');
      await Tone.start();
      toneReady = true;
    }
    if (!active || token !== generation) return;
    // A ready track reaches audio.play() within the click handler, preserving Safari activation.
    if (!track || !wavBlob || !playbackUrl) await ensureTrack(options, token);
    if (!active || token !== generation || !track || !wavBlob) return;
    if (action === 'play') {
      try {
        await audio.play();
        if (!active || token !== generation) return;
        setStatus(version === 'loop' ? '正在循环播放。首次试听请保持较低设备音量。' : '正在播放。首次试听请保持较低设备音量。');
      } catch {
        if (!active || token !== generation) return;
        setStatus('音频已就绪。浏览器未允许本次播放，请再次点击「播放」。', true);
      }
    } else {
      // Keep WAV as the first download event; the attribution file follows it.
      downloadBlob(wavBlob, track.filename);
      if (track.credits.length) {
        const creditsFilename = `${track.filename.replace(/\.wav$/i, '')}.credits.json`;
        const creditsBlob = new Blob([JSON.stringify({ track: selectedTrack.meta.id, credits: track.credits }, null, 2) + '\n'], { type: 'application/json' });
        downloadBlob(creditsBlob, creditsFilename);
      }
      setStatus(`已发起下载：${track.filename}。立体声 WAV / 44.1 kHz / 16 bit。${track.credits.length ? '同时下载音源署名 JSON；浏览器可能需要允许多文件下载。' : ''}`);
    }
  } catch (error) {
    if (!active || token !== generation) return;
    badge.textContent = track ? '合成完成' : '合成失败';
    const detail = error instanceof Error ? error.message : '未知错误';
    setStatus(`操作未完成：${detail} 请重试或调整参数。`, true);
  } finally {
    if (token === generation) { busy = false; syncControls(); }
  }
}
playButton.addEventListener('click', () => { void perform('play'); });
exportButton.addEventListener('click', () => { void perform('export'); });
creditsButton.addEventListener('click', () => {
  if (busy || !track?.credits.length) return;
  const filename = `${track.filename.replace(/\.wav$/i, '')}.credits.json`;
  downloadBlob(new Blob([JSON.stringify({ track: selectedTrack.meta.id, credits: track.credits }, null, 2) + '\n'], { type: 'application/json' }), filename);
  setStatus('已单独下载音源署名。对外分享音频时请一并保留署名。');
});
stopButton.addEventListener('click', () => {
  if (busy || !track) return;
  audio.pause(); audio.currentTime = 0; syncPosition(); syncControls();
  setStatus('已停止，回到第一拍。');
});
versions.forEach(button => button.addEventListener('click', () => {
  if (busy || button.dataset.version === version) return;
  const selected = button.dataset.version;
  if (selected !== 'full' && selected !== 'hook' && selected !== 'loop') return;
  version = selected;
  generation++;
  invalidate(); syncVersion();
  const url = new URL(window.location.href);
  url.searchParams.set('version', version);
  window.history.replaceState(window.history.state, '', url);
  setStatus('版本已切换，点击播放或导出生成新版本。');
}));
trackSelect.addEventListener('change', () => {
  if (busy) return;
  const next = findTrack(trackSelect.value);
  if (!next || next === selectedTrack) return;
  selectedTrack = next;
  bpmInput.value = String(next.meta.bpm);
  transposeInput.value = '0';
  generation++;
  invalidate(); syncTrack(); syncVersion(); syncControls();
  const url = new URL(window.location.href);
  url.searchParams.set('track', next.meta.id);
  window.history.replaceState(window.history.state, '', url);
  setStatus(`已切换到《${next.meta.title}》，速度恢复为 ${next.meta.bpm} BPM。点击播放试听。`);
});
[bpmInput, transposeInput, seedInput].forEach(input => input.addEventListener('input', () => {
  if (busy) return;
  generation++;
  invalidate();
  element('#bpm-fact').textContent = bpmInput.validity.valid ? bpmInput.value : '—';
  setStatus('参数已更新，试听缓存已清除。点击播放或导出重新合成。');
}));
seek.addEventListener('input', () => {
  if (busy || !track) return;
  audio.currentTime = Math.max(0, Math.min(duration(), seek.valueAsNumber));
  syncPosition();
});
volume.addEventListener('input', () => {
  audio.volume = volume.valueAsNumber;
  element<HTMLOutputElement>('#volume-value').value = `${Math.round(audio.volume * 100)}%`;
  volume.style.setProperty('--range-progress', `${audio.volume * 100}%`);
});
audio.addEventListener('play', () => { syncControls(); startFrame(); });
audio.addEventListener('pause', () => { cancelFrame(); syncControls(); syncPosition(); });
audio.addEventListener('ended', () => { cancelFrame(); syncControls(); syncPosition(); setStatus('播放结束。再听一次，或导出你的版本。'); });
audio.addEventListener('timeupdate', syncPosition);
audio.addEventListener('loadedmetadata', () => { drawSections(); syncPosition(); });
audio.addEventListener('error', () => {
  if (!playbackUrl || !active) return;
  audio.pause();
  generation++; busy = false;
  invalidate();
  badge.textContent = '播放失败';
  setStatus('浏览器无法读取音频，缓存已清除。请点击播放重新生成。', true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelFrame();
  else if (!audio.paused) startFrame();
});
const observer = new ResizeObserver(drawWaveform);
observer.observe(waveform);
window.addEventListener('pagehide', () => {
  active = false; generation++; busy = false;
  invalidate(); observer.disconnect();
  downloadUrls.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
  downloadUrls.clear();
});
window.addEventListener('pageshow', () => {
  active = true;
  observer.observe(waveform);
  drawWaveform(); syncControls();
  if (!track) setStatus('首次试听请先调低设备音量。点击播放或导出生成音频。');
});
volume.style.setProperty('--range-progress', '65%');
syncTrack(); syncVersion(); syncControls(); syncPosition(); drawWaveform(); drawCredits();
