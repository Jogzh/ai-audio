#!/usr/bin/env python3
"""Generate original Chinese neural calls and formant-preserving tuned vocal assets.

Requires the pinned official Kokoro Chinese model/config and zf_001/zm_010 packs.
Model downloads and raw takes belong in ignored artifacts/, never in the release.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

import librosa
import numpy as np
import pyworld as pw
import soundfile as sf
import torch
from kokoro import KModel, KPipeline
from scipy.signal import butter, resample_poly, sosfilt

REPO = 'hexgrad/Kokoro-82M-v1.1-zh'
REVISION = '01e7505bd6a7a2ac4975463114c3a7650a9f7218'
WEIGHT_HASH = 'b1d8410fa44dfb5c15471fd6c4225ea6b4e9ac7fa03c98e8bea47a9928476e2b'
SR = 24000


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def edges(y, seconds=.008):
    y = np.asarray(y, dtype=np.float64).copy()
    n = min(len(y) // 2, round(SR * seconds))
    y[:n] *= np.linspace(0, 1, n)
    y[-n:] *= np.linspace(1, 0, n)
    return y


def polish(y):
    y = y - np.mean(y)
    y = sosfilt(butter(2, 100, btype='highpass', fs=SR, output='sos'), y)
    y = sosfilt(butter(2, 8800, btype='lowpass', fs=SR, output='sos'), y)
    y = np.tanh(y * (1.6 / max(.01, np.max(np.abs(y)))))
    return edges(y * (.82 / max(.01, np.max(np.abs(y)))))


def tune_vowel(y, midi, seconds):
    """WORLD keeps the spectral envelope while replacing F0 and extending the vowel."""
    y = np.asarray(y, dtype=np.float64)
    f0, times = pw.dio(y, SR, f0_floor=70, f0_ceil=700, frame_period=5)
    f0 = pw.stonemask(y, f0, times, SR)
    voiced = np.flatnonzero(f0 > 70)
    if len(voiced) < 8:
        raise RuntimeError('Insufficient voiced frames for a tuned vowel')
    begin, end = voiced[0], voiced[-1] + 1
    spectrum = pw.cheaptrick(y, f0, times, SR)[begin:end]
    aperiodicity = pw.d4c(y, f0, times, SR)[begin:end]
    count = round(seconds * 1000 / 5) + 1
    grid = np.linspace(0, len(spectrum) - 1, count)
    def stretch(matrix):
        return np.ascontiguousarray(np.stack([np.interp(grid, np.arange(len(matrix)), matrix[:, i]) for i in range(matrix.shape[1])], axis=1))
    freq = 440 * 2 ** ((midi - 69) / 12)
    target = freq * 2 ** ((3 * np.sin(np.arange(count) * .005 * 2 * np.pi * 5.2)) / 1200)
    result = pw.synthesize(np.ascontiguousarray(target), stretch(spectrum), stretch(aperiodicity), SR, frame_period=5)
    return edges(result[:round(seconds * SR)], .02), float(np.median(f0[voiced]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', default='artifacts/vocal-model')
    parser.add_argument('--out', default='public/audio/night-city')
    parser.add_argument('--raw', default='artifacts/vocal-takes')
    args = parser.parse_args()
    model_dir, out, raw = Path(args.model_dir), Path(args.out), Path(args.raw)
    if (out / 'manifest.json').exists():
        raise RuntimeError('Voice bank already exists; choose a fresh --out directory')
    if sha(model_dir / 'kokoro-v1_1-zh.pth') != WEIGHT_HASH:
        raise RuntimeError('Official model SHA256 mismatch')
    out.mkdir(parents=True, exist_ok=True)
    raw.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(261014)
    torch.set_num_threads(4)
    model = KModel(repo_id=REPO, config=str(model_dir / 'config.json'), model=str(model_dir / 'kokoro-v1_1-zh.pth')).to('cpu').eval()
    pipeline = KPipeline(lang_code='z', repo_id=REPO, model=model, device='cpu')
    voices = {v: torch.load(model_dir / f'{v}.pt', map_location='cpu', weights_only=True) for v in ['zf_001', 'zm_010']}
    phrases = {
        'city-open': ('长安入夜，霓虹开城。', 'zf_001', 1.06, 6.75 * 60 / 128),
        'night-call': ('长安入夜。', 'zf_001', 1.12, 2.75 * 60 / 128),
        'lights-on': ('灯起！', 'zm_010', 1.08, 1.25 * 60 / 128),
        'follow-drums': ('跟着鼓点，点亮长安！', 'zm_010', 1.08, 6.5 * 60 / 128),
        'tonight': ('不问归途，只赴今夜。', 'zf_001', .98, 6.75 * 60 / 128),
        'together': ('一起！', 'zm_010', 1.12, 1.5 * 60 / 128),
        'hey': ('嘿！', 'zm_010', 1.15, .24),
        'female-ah': ('啊。', 'zf_001', .82, None),
        'female-ye': ('夜。', 'zf_001', .85, None),
        'male-ah': ('啊。', 'zm_010', .85, None),
    }
    takes, records, assets = {}, {}, {}
    for name, (text, voice, speed, target) in phrases.items():
        result = list(pipeline(text, voice=voices[voice], speed=speed))
        y = np.concatenate([r.audio.numpy() for r in result])
        path = raw / f'{name}.wav'
        sf.write(path, y, SR, subtype='PCM_24')
        trimmed, _ = librosa.effects.trim(y, top_db=36, frame_length=512, hop_length=64)
        takes[name] = np.asarray(trimmed, dtype=np.float64)
        records[name] = {'text': text, 'voice': voice, 'speed': speed, 'sourceSampleRate': SR, 'sourceSha256': sha(path), 'sourceDuration': len(y) / SR}
        if target:
            processed = librosa.effects.time_stretch(trimmed, rate=len(trimmed) / (target * SR))
            frames = round(target * SR)
            assets[name] = np.pad(processed[:frames], (0, max(0, frames - len(processed))))
        print(f'Generated {name}: {len(y) / SR:.3f}s', flush=True)
    ah, ah_f0 = tune_vowel(takes['female-ah'], 69, .95)
    ye, ye_f0 = tune_vowel(takes['female-ye'], 69, .85)
    female, _ = tune_vowel(takes['female-ah'], 62, 3.6)
    male, male_f0 = tune_vowel(takes['male-ah'], 62, 3.6)
    assets['ah-a4'], assets['ye-a4'] = ah, ye
    # One centered choir layer: mixed neural vowels, slow breathing, no singer clone.
    breathing = .73 + .27 * np.sin(np.linspace(-np.pi / 2, 5 * np.pi / 2, len(female)))
    assets['choir-d4'] = (female * .65 + male * .35) * breathing
    reverse = librosa.effects.time_stretch(ah[::-1], rate=len(ah) / (1.3 * SR))
    assets['reverse-a4'] = reverse * np.linspace(0, 1, len(reverse)) ** 1.8
    files = []
    for name, y in assets.items():
        y = resample_poly(polish(y), 2, 1)
        path = out / f'{name}.wav'
        sf.write(path, y, 48000, subtype='PCM_24')
        files.append({'id': name, 'filename': path.name, 'sampleRate': 48000, 'sourceSampleRate': SR, 'bits': 24, 'channels': 1, 'frames': len(y), 'duration': len(y) / 48000, 'sha256': sha(path)})
    manifest = {
        'model': REPO, 'revision': REVISION, 'license': 'Apache-2.0', 'weightSha256': WEIGHT_HASH,
        'voices': {v: sha(model_dir / f'{v}.pt') for v in voices}, 'seed': 261014, 'takes': records,
        'processing': 'Trim, phase-vocoder speech time fit, WORLD F0 replacement with preserved spectral envelope, centered breathing choir, reverse swell, high/low-pass, soft compression, polyphase 24-to-48 kHz conversion; PCM24.',
        'measuredSourceMedianF0Hz': {'femaleAh': ah_f0, 'femaleYe': ye_f0, 'maleAh': male_f0},
        'libraries': {v: importlib.metadata.version(v) for v in ['kokoro', 'misaki', 'torch', 'transformers', 'numpy', 'scipy', 'soundfile', 'librosa', 'pyworld']},
        'manualListening': 'not performed', 'files': files,
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'saved': str(out), 'files': len(files)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
