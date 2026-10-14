import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const loudnessTarget = Object.freeze({ integratedLufs: -14, truePeakDbtp: -1.5, loudnessRangeLu: 9 });

export function validateExportOptions(format, master) {
  if (!['wav', 'mp3', 'both'].includes(format)) throw new Error('无效 format：请使用 wav、mp3 或 both');
  if (!['auto', 'off', 'loudness'].includes(master)) throw new Error('无效 master：请使用 auto、off 或 loudness');
}

async function run(binary, args) {
  try {
    return await execFileAsync(binary, args, { maxBuffer: 16 * 1024 * 1024, timeout: 300000, encoding: 'utf8' });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`找不到 ${binary}。MP3/响度母带需要本机安装 FFmpeg 和 FFprobe 并加入 PATH。`, { cause: error });
    const detail = String(error.stderr || error.message).trim().slice(-2000);
    throw new Error(`${binary} 执行失败：${detail}`, { cause: error });
  }
}

/** Read-only preflight; call before rendering or creating an output directory. */
export async function requireAudioTools({ mp3 = true, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  const versions = await Promise.all([run(ffmpeg, ['-version']), run(ffprobe, ['-version'])]);
  if (mp3) {
    const encoders = await run(ffmpeg, ['-hide_banner', '-encoders']);
    if (!/\blibmp3lame\b/.test(encoders.stdout)) throw new Error('当前 FFmpeg 缺少 libmp3lame MP3 编码器，请安装包含 libmp3lame 的 FFmpeg。');
  }
  return { ffmpeg, ffprobe, ffmpegVersion: versions[0].stdout.split('\n')[0], ffprobeVersion: versions[1].stdout.split('\n')[0] };
}

/** Reject silence/invalid measurements instead of putting Infinity/null into a report. */
export function parseLoudnorm(stderr) {
  const blocks = stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);
  if (!blocks?.length) throw new Error('FFmpeg 未返回 loudnorm 响度测量结果');
  const raw = JSON.parse(blocks.at(-1));
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
  for (const field of fields) {
    if (raw[field] === undefined || String(raw[field]).trim() === '' || !Number.isFinite(Number(raw[field]))) {
      throw new Error(`无法母带静音或无效音频：loudnorm ${field}=${raw[field]}`);
    }
  }
  return raw;
}

function measurement(raw) {
  return {
    integratedLufs: Number(raw.input_i),
    truePeakDbtp: Number(raw.input_tp),
    loudnessRangeLu: Number(raw.input_lra),
    thresholdLufs: Number(raw.input_thresh),
  };
}

function filter(target = loudnessTarget) {
  return `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDbtp}:LRA=${target.loudnessRangeLu}`;
}

export function secondPassFilter(raw, target = loudnessTarget) {
  // Parse/validate all user-independent values before inserting them into a filter expression.
  const checked = parseLoudnorm(JSON.stringify(raw));
  return `${filter(target)}:measured_I=${Number(checked.input_i)}:measured_TP=${Number(checked.input_tp)}:measured_LRA=${Number(checked.input_lra)}:measured_thresh=${Number(checked.input_thresh)}:offset=${Number(checked.target_offset)}:linear=true:print_format=json`;
}

async function analyze(filename, binaries) {
  const result = await run(binaries.ffmpeg, ['-hide_banner', '-nostats', '-i', filename, '-map', '0:a:0', '-af', `${filter()}:print_format=json`, '-f', 'null', '-']);
  return parseLoudnorm(result.stderr);
}

export async function probeAudio(filename, binaries) {
  const result = await run(binaries.ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels,duration', '-of', 'json', filename]);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.[0];
  const durationSeconds = Number(data.format?.duration ?? stream?.duration);
  if (!stream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error(`无法读取输出音频的实际时长：${filename}`);
  return { codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: stream.channels, durationSeconds, durationSource: 'ffprobe container duration' };
}

/** Inspect actual PCM frames so unmastered WAV export has no FFmpeg dependency. */
export async function inspectPcmWav(filename) {
  const bytes = await readFile(filename);
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('输入必须是有效的 PCM WAV 文件');
  let fmt;
  let dataBytes;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error('WAV 数据不完整');
    if (type === 'fmt ' && size >= 16) {
      fmt = { encoding: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4), blockAlign: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) };
      // FFmpeg writes 24-bit WAV as WAVE_FORMAT_EXTENSIBLE. Accept only its PCM
      // GUID and full valid-bit depth; compressed and float subformats stay rejected.
      if (fmt.encoding === 0xfffe && size >= 40 && bytes.readUInt16LE(start + 16) >= 22
        && bytes.readUInt16LE(start + 18) === fmt.bits
        && bytes.subarray(start + 24, start + 40).toString('hex') === '0100000000001000800000aa00389b71') fmt.encoding = 1;
    }
    if (type === 'data') dataBytes = size;
    offset = start + size + (size % 2);
  }
  if (!fmt || fmt.encoding !== 1 || ![16, 24].includes(fmt.bits) || !fmt.channels || !fmt.sampleRate || fmt.blockAlign !== fmt.channels * fmt.bits / 8 || !dataBytes || dataBytes % fmt.blockAlign) throw new Error('输入必须是非空的 PCM16/24 WAV 文件');
  return { codec: `pcm_s${fmt.bits}le`, bitsPerSample: fmt.bits, sampleRate: fmt.sampleRate, channels: fmt.channels, durationSeconds: dataBytes / fmt.blockAlign / fmt.sampleRate, durationSource: 'PCM frame count' };
}

/** Export via temporary files; only verified complete audio is copied to destination. */
export async function exportAudio({ sourcePath, destinationDirectory, stem, format = 'mp3', master = 'auto', binaries, overwrite = false }) {
  validateExportOptions(format, master);
  const formats = format === 'both' ? ['wav', 'mp3'] : [format];
  if (!overwrite) {
    const existing = await Promise.all(formats.map(async outputFormat => {
      const filename = `${stem}.${outputFormat}`;
      try { await lstat(path.join(destinationDirectory, filename)); return filename; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }));
    if (existing.some(Boolean)) throw new Error(`输出已存在：${existing.filter(Boolean).join(', ')}。请选择新 --out 目录，或显式传 --overwrite。`);
  }
  const needTools = formats.includes('mp3') || master === 'loudness';
  if (needTools && !binaries) binaries = await requireAudioTools({ mp3: formats.includes('mp3') });
  const source = await inspectPcmWav(sourcePath);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-export-'));
  try {
    const beforeRaw = needTools ? await analyze(sourcePath, binaries) : undefined;
    const files = [];
    const after = {};
    const passes = {};
    for (const outputFormat of formats) {
      const filename = `${stem}.${outputFormat}`;
      const temporary = path.join(tempDirectory, filename);
      const normalized = master === 'loudness' || (master === 'auto' && outputFormat === 'mp3');
      if (outputFormat === 'wav' && !normalized) {
        await copyFile(sourcePath, temporary);
      } else {
        const args = ['-hide_banner', '-nostats', '-y', '-i', sourcePath, '-map', '0:a:0', '-map_metadata', '-1'];
        if (normalized) args.push('-af', secondPassFilter(beforeRaw) + (outputFormat === 'wav' && source.bitsPerSample === 24 ? ',aresample=dither_method=triangular' : ''));
        args.push('-ar', String(source.sampleRate), '-ac', String(source.channels));
        if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', '320k', '-write_xing', '1', '-id3v2_version', '3');
        else args.push('-c:a', source.codec);
        args.push(temporary);
        const result = await run(binaries.ffmpeg, args);
        if (normalized) {
          const secondPass = parseLoudnorm(result.stderr);
          passes[outputFormat] = { passes: 2, normalizationType: secondPass.normalization_type, requestedLinear: true };
        }
      }
      const info = outputFormat === 'wav' && !normalized ? await inspectPcmWav(temporary) : await probeAudio(temporary, binaries);
      if (needTools) after[outputFormat] = measurement(await analyze(temporary, binaries));
      files.push({ filename, format: outputFormat === 'wav' ? `PCM${source.bitsPerSample} WAV` : 'MP3 320 kbps', ...info, ...(outputFormat === 'wav' ? { bitsPerSample: source.bitsPerSample } : {}), audioContentDurationSeconds: source.durationSeconds, bytes: (await stat(temporary)).size, mastered: normalized });
    }
    // No destination is created until conversion and measurements have succeeded.
    await mkdir(destinationDirectory, { recursive: true });
    for (const file of files) {
      try { await copyFile(path.join(tempDirectory, file.filename), path.join(destinationDirectory, file.filename), overwrite ? 0 : constants.COPYFILE_EXCL); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error(`输出已存在：${file.filename}。请选择新 --out 目录，或显式传 --overwrite。`, { cause: error });
        throw error;
      }
    }
    const mastering = beforeRaw ? {
      mode: master,
      method: 'FFmpeg loudnorm / EBU R128, measured from source and decoded final files',
      target: loudnessTarget,
      targetNote: 'Project production target; no platform loudness standard is claimed. MP3 encoding can alter measured loudness/true peak.',
      before: measurement(beforeRaw),
      after,
      processing: passes,
    } : null;
    return { files, mastering, source };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
