#!/usr/bin/env python3
"""Build a small reusable sound library. Network is needed only on first build.

python scripts/build_sound_palette.py build   # source cache under artifacts/
python scripts/build_sound_palette.py verify  # offline, validates delivered assets
Requires requirements-palette.txt and FFmpeg. Does not import song renderers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/palette"
CACHE = ROOT / "artifacts/asset-research/downloads"
PRESET = ROOT / "scripts/presets/sound-palette.json"
SR = 44100
COMMIT = "440300901dfe9275fd84e0b7763af1f8443ae62e"
SFZ_COMMIT = "6dd651d55dde97fd4028699be9d4481f26917891"
BASE = f"https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{COMMIT}/"

# Root pitches come from the upstream SFZ, not the source filenames.
RECORDINGS = [
    ("marimba-B3", "马林巴 B3", "marimba", 59, "Percussion/Marimba/Marimba_hit_Outrigger_B2_loud_01.wav"),
    ("marimba-F4", "马林巴 F4", "marimba", 65, "Percussion/Marimba/Marimba_hit_Outrigger_F3_loud_01.wav"),
    ("marimba-C5", "马林巴 C5", "marimba", 72, "Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav"),
    ("marimba-G5", "马林巴 G5", "marimba", 79, "Percussion/Marimba/Marimba_hit_Outrigger_G4_loud_01.wav"),
    ("xylophone-C4", "木琴 C4", "xylophone", 60, "Percussion/Xylo/Xylo_Medium_C4_ff_01_far.wav"),
    ("xylophone-G4", "木琴 G4", "xylophone", 67, "Percussion/Xylo/Xylo_Medium_G4_ff_01_far.wav"),
    ("xylophone-C5", "木琴 C5", "xylophone", 72, "Percussion/Xylo/Xylo_Medium_C5_ff_01_far.wav"),
    ("xylophone-G5", "木琴 G5", "xylophone", 79, "Percussion/Xylo/Xylo_Medium_G5_ff_01_far.wav"),
    ("snare-soft-rr1", "军鼓轻击 · 变体 1", "snare", None, "Percussion/Snare2-HitSN_v3_rr1_Sum.wav"),
    ("snare-soft-rr2", "军鼓轻击 · 变体 2", "snare", None, "Percussion/Snare2-HitSN_v3_rr2_Sum.wav"),
    ("snare-hard-rr1", "军鼓重击 · 变体 1", "snare", None, "Percussion/Snare2-HitSN_v5_rr1_Sum.wav"),
    ("snare-hard-rr2", "军鼓重击 · 变体 2", "snare", None, "Percussion/Snare2-HitSN_v5_rr2_Sum.wav"),
    ("tambourine-rr1", "铃鼓 · 变体 1", "tambourine", None, "Percussion/Tamb1-Hit_v2_rr1_Sum.wav"),
    ("tambourine-rr2", "铃鼓 · 变体 2", "tambourine", None, "Percussion/Tamb1-Hit_v2_rr2_Sum.wav"),
    ("triangle", "三角铁", "triangle", None, "Percussion/Triangle3-Hit_v1_rr1_Sum.wav"),
    ("crash", "吊镲", "crash", None, "Percussion/cymbal-crash1_mf_rr1.wav"),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "ai-audio-sound-palette"})
        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read()
        # Never leave a half-written cached download after a network failure.
        path.with_suffix(path.suffix + ".tmp").write_bytes(data)
        path.with_suffix(path.suffix + ".tmp").replace(path)
    return path


def edge_fade(y, attack=.003, release=.025):
    y = y.copy()
    a, r = min(len(y), round(attack * SR)), min(len(y), round(release * SR))
    if a:
        y[:a] *= np.linspace(0, 1, a).reshape((-1,) + (1,) * (y.ndim - 1))
    if r:
        y[-r:] *= np.linspace(1, 0, r).reshape((-1,) + (1,) * (y.ndim - 1))
    return y


def normalize(y, peak=.7):
    return y * (peak / max(float(np.max(np.abs(y))), 1e-12))


def lowpass(y, cutoff):
    return signal.sosfilt(signal.butter(2, cutoff, fs=SR, output="sos"), y, axis=0)


def highpass(y, cutoff):
    return signal.sosfilt(signal.butter(2, cutoff, fs=SR, btype="highpass", output="sos"), y, axis=0)


def synth(family, midi, duration, seed):
    t = np.arange(round(duration * SR)) / SR
    f = 440 * 2 ** ((midi - 69) / 12)
    rng = np.random.default_rng(seed)
    if family == "electric-piano":
        # Additive/FM tine-like instrument, not a recording or branded emulation.
        y = np.sin(2 * np.pi * f * t + 1.7 * np.exp(-t * 4) * np.sin(2 * np.pi * 2 * f * t))
        y *= np.exp(-t * 1.5)
        y += .18 * np.sin(2 * np.pi * 7 * f * t) * np.exp(-t * 9)
        y *= 1 + .06 * np.sin(2 * np.pi * 4.7 * t)
    elif family == "sub":
        y = (np.sin(2 * np.pi * f * t) + .15 * np.sin(4 * np.pi * f * t)) * np.exp(-t * .5)
    elif family == "reese":
        y = sum(signal.sawtooth(2 * np.pi * f * 2 ** (cents / 1200) * t + phase)
                for cents, phase in [(-7, .3), (7, 1.1)]) / 2
        y = np.tanh(lowpass(y, 1100) * 1.6) * np.exp(-t * .35)
    elif family == "warm-pad":
        y = sum(np.sin(2 * np.pi * f * ratio * t + .07 * np.sin(2 * np.pi * .19 * t)) * amp
                for ratio, amp in [(1, .6), (2.002, .2), (2.996, .12), (4.003, .05)])
        y *= np.minimum(1, t / .8) * (1 + .07 * np.sin(2 * np.pi * .31 * t))
    elif family == "kick":
        freq = 48 + 115 * np.exp(-t * 35)
        y = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 10)
        y += highpass(rng.normal(size=len(t)), 2500) * np.exp(-t * 240) * .12
    elif family == "rim":
        y = sum(np.sin(2 * np.pi * hz * t) for hz in [780, 1210, 1740]) * np.exp(-t * 80) / 3
        y += highpass(rng.normal(size=len(t)), 1800) * np.exp(-t * 130) * .1
    elif family in ("hat-closed", "hat-open", "shaker"):
        decay = {"hat-closed": 55, "hat-open": 12, "shaker": 35}[family]
        y = highpass(rng.normal(size=len(t)), 6200) * np.exp(-t * decay)
    elif family in ("riser", "downlifter"):
        noise = rng.normal(size=len(t))
        # Crossfade dark/bright noise to create a reproducible spectral sweep.
        u = np.linspace(0, 1, len(t))
        if family == "downlifter":
            u = 1 - u
        y = (lowpass(noise, 900) * (1 - u) + highpass(noise, 3000) * u) * u ** 1.4
    elif family == "impact":
        y = lowpass(rng.normal(size=len(t)), 3200) * np.exp(-t * 3) * .35
        y += np.sin(2 * np.pi * (42 * t + 28 * (1 - np.exp(-t * 8)) / 8)) * np.exp(-t * 5)
    elif family == "reverse-bell":
        y = sum(np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * decay) * amp
                for ratio, decay, amp in [(1, 1.2, .7), (2.76, 2.2, .2), (5.4, 4, .1)])[::-1]
    else:
        raise ValueError(f"Unknown sound: {family}")
    return normalize(edge_fade(y, .008 if family in ("sub", "reese") else .003,
                               .45 if family == "warm-pad" else .04))


class Palette:
    def __init__(self, seed):
        self.seed = seed
        self.assets = []
        self.buffers = {}

    def write(self, asset_id, name, category, family, y, **metadata):
        path = OUT / category / f"{asset_id}.wav"
        path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(path, y, SR, subtype="PCM_24")
        self.buffers[asset_id] = y
        entry = dict(id=asset_id, name=name, category=category, family=family,
                     file=str(path.relative_to(OUT)), license="CC0-1.0", **metadata)
        self.assets.append(entry)
        return entry

    def recordings(self):
        reference = OUT / "sources"
        reference.mkdir(parents=True, exist_ok=True)
        for name in ["LICENSE", "README.md", "Readme.txt"]:
            source = download(BASE + name, CACHE / name)
            (reference / name).write_bytes(source.read_bytes())
        for preset in ["Marimba.sfz", "Xylophone.sfz"]:
            url = f"https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{SFZ_COMMIT}/{preset}"
            source = download(url, CACHE / preset)
            (reference / preset).write_bytes(source.read_bytes())
        for asset_id, name, family, midi, source in RECORDINGS:
            url = BASE + urllib.parse.quote(source, safe="/")
            path = download(url, CACHE / source)
            raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path),
                "-af", "pan=mono|c0=c0", "-ar", str(SR), "-f", "f32le", "-"])
            y = np.frombuffer(raw, dtype="<f4").astype(np.float64)
            # RMS blocks locate silence, preserving a 10 ms attack margin and
            # 350 ms room tail. Do not peak-normalize or average microphones.
            block = 441
            n = len(y) // block
            levels = np.sqrt(np.mean(y[:n * block].reshape(n, block) ** 2, axis=1))
            active = np.flatnonzero(levels > max(float(levels.max()) * .008, 1e-5))
            if not len(active):
                raise ValueError(f"Silent source: {source}")
            start = max(0, (int(active[0]) - 1) * block)
            end = min(len(y), (int(active[-1]) + 1) * block + round(.35 * SR))
            processed = edge_fade(y[start:end], .0005, .02)
            meta = dict(sourceUrl=url, sourcePath=source, sourceSha256=sha(path),
                        sourceFrames=len(y), trimStartFrame=start, trimEndFrame=end)
            if midi is not None:
                meta["rootMidi"] = midi
                meta["sfzPreset"] = "Marimba.sfz" if family == "marimba" else "Xylophone.sfz"
            if family == "snare":
                meta.update(velocityLayer="soft" if "soft" in asset_id else "hard",
                            roundRobin=1 if "rr1" in asset_id else 2)
            self.write(asset_id, name, "recorded", family, processed, **meta)
            print(f"Recorded: {asset_id}", flush=True)

    def generated(self):
        for family, name, pitches, duration in [
            ("electric-piano", "合成电钢琴", [48, 60, 72], 3.5),
            ("sub", "Sub 贝斯", [24, 36], 2.5),
            ("reese", "Reese 贝斯", [36, 48], 2.5),
            ("warm-pad", "暖 Pad", [48, 60], 6),
        ]:
            for midi in pitches:
                note = f"C{midi // 12 - 1}"
                self.write(f"{family}-{note}", f"{name} {note}", "synth", family,
                           synth(family, midi, duration, self.seed), rootMidi=midi,
                           source="Original procedural synthesis; build_sound_palette.py")
        for family, name, duration in [
            ("kick", "合成底鼓", .65), ("rim", "合成边击", .18),
            ("hat-closed", "合成闭镲", .22), ("hat-open", "合成开镲", .8),
            ("shaker", "合成沙锤", .3), ("riser", "噪声上升", 4),
            ("downlifter", "噪声下降", 4), ("impact", "低频冲击", 3),
            ("reverse-bell", "反向钟音 C5", 3),
        ]:
            meta = {"rootMidi": 72} if family == "reverse-bell" else {}
            self.write(family, name, "fx" if duration >= 3 else "synth", family,
                       synth(family, 72, duration, self.seed),
                       source="Original procedural synthesis; build_sound_palette.py", **meta)

    def note(self, family, midi, duration):
        entries = [e for e in self.assets if e["family"] == family and "rootMidi" in e]
        entry = min(entries, key=lambda e: abs(e["rootMidi"] - midi))
        y = self.buffers[entry["id"]]
        if entry["category"] == "recorded":
            y = normalize(y, .55)
        ratio = 2 ** ((midi - entry["rootMidi"]) / 12)
        n = min(round(duration * SR), math.ceil(len(y) / ratio))
        # Polyphase resampling includes anti-alias filtering for upward shifts.
        from fractions import Fraction
        rate = Fraction(1 / ratio).limit_denominator(1000)
        y = signal.resample_poly(y, rate.numerator, rate.denominator)[:n]
        return edge_fade(y, .008, min(.25, duration / 4))

    def styles(self, styles):
        for style in styles:
            beat = 60 / style["bpm"]
            frames = round(style["bars"] * 4 * beat * SR)
            # Render three cycles, including circular effect returns, and keep
            # the middle cycle. This carries note/room tails across loop seams.
            drums = np.zeros((frames * 3, 2))
            music = np.zeros_like(drums)

            def add(bus, y, at, level, pan=0):
                start = round(at * beat * SR)
                end = min(len(bus), start + len(y))
                if end <= start:
                    return
                gains = np.array([math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)])
                bus[start:end] += y[:end-start, None] * gains * level

            for cycle in range(3):
                for bar in range(style["bars"]):
                    start = cycle * style["bars"] * 4 + bar * 4
                    chord_index = (bar // 2) % 4
                    for part in ["kick", "snare", "hat"]:
                        for hit, (offset, velocity) in enumerate(style[part]):
                            asset_id = part if part == "kick" else "hat-closed"
                            if part == "snare":
                                layer = "soft" if velocity < .4 else "hard"
                                asset_id = f"snare-{layer}-rr{1 + (bar + hit) % 2}"
                            y = normalize(self.buffers[asset_id], .65)
                            swing = style["swingBeats"] if offset % 1 >= .5 else 0
                            add(drums, y, start + offset + swing, velocity * .7,
                                .15 if part == "hat" else 0)
                    if style["id"] == "ambient-mallets":
                        add(drums, normalize(self.buffers[f"tambourine-rr{1 + bar % 2}"], .5), start + 2, .15, -.3)
                        if bar % 2 == 0:
                            add(drums, normalize(self.buffers["triangle"], .5), start, .12, .4)
                    chord = style["chords"][chord_index]
                    stabs = [(0, 3.8)] if style["id"] != "uk-garage" else [(.5, .5), (1.75, .4), (3.5, .45)]
                    for offset, length in stabs:
                        for index, midi in enumerate(chord):
                            add(music, self.note(style["chordVoice"], midi, (length + .3) * beat),
                                start + offset + index * .012, .16, (index - 1.5) * .18)
                    root = style["bassMidi"][chord_index]
                    for offset in ([0, 1.75, 2.5] if style["id"] == "uk-garage" else [0, 2.5]):
                        add(music, self.note(style["bassVoice"], root, beat * 1.1), start + offset, .24)
                    for i, midi in enumerate(style["melodyMidi"][chord_index]):
                        if style["id"] == "uk-garage" and i % 2:
                            continue
                        family = "xylophone" if i == 3 else "marimba"
                        add(music, self.note(family, midi, beat * 1.8), start + i + .25, .18, -.25 if i % 2 else .25)
            drums = drums[frames:frames*2]
            music = music[frames:frames*2]
            # Circular, asymmetric taps create room/delay without shortening the
            # musical bar count. There is deliberately no fade on these loops.
            for seconds, level in [(.071, .10), (.113, .08), (beat * .75, .14), (beat * 1.5, .07)]:
                music += np.roll(lowpass(music, 6500), round(seconds * SR), axis=0)[:, ::-1] * level
            loop_id = style["id"] + "-drums"
            self.write(loop_id, style["name"] + " · 8 小节鼓循环", "loops", "drum-loop",
                       normalize(drums, .7), bpm=style["bpm"], bars=style["bars"], loop=True,
                       source="Original pattern; sound-palette.json; CC0 recordings and synthesis")
            # A music loop is useful in a DAW; the MP3 below is a faded audition.
            mix = normalize(drums + music, .78)
            mix_id = style["id"] + "-mix"
            self.write(mix_id, style["name"] + " · 8 小节编曲循环", "loops", "music-loop", mix,
                       bpm=style["bpm"], bars=style["bars"], loop=True, key=style["key"],
                       source="Original arrangement; sound-palette.json; CC0 recordings and synthesis")
            preview = OUT / "previews" / f"{style['id']}.mp3"
            preview.parent.mkdir(parents=True, exist_ok=True)
            temp = CACHE / f"{style['id']}-preview.wav"
            sf.write(temp, edge_fade(mix, .03, .7), SR, subtype="PCM_24")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(temp), "-map_metadata", "-1",
                "-c:a", "libmp3lame", "-b:a", "192k", str(preview)], check=True)
            self.assets.append(dict(id=style["id"], name=style["name"], category="previews",
                family="style-demo", file=str(preview.relative_to(OUT)), license="CC0-1.0",
                bpm=style["bpm"], key=style["key"], bars=style["bars"], loop=False,
                description=style["description"], source="Original arrangement; sound-palette.json"))

    def manifest(self):
        for entry in self.assets:
            path = OUT / entry["file"]
            y, sr = decode(path)
            entry.update(sha256=sha(path), sampleRate=sr, channels=1 if y.ndim == 1 else y.shape[1],
                         frames=len(y), seconds=round(len(y)/sr, 9),
                         peakDbFS=round(db(np.max(np.abs(y))), 5), rmsDbFS=round(db(np.sqrt(np.mean(y*y))), 5),
                         dcOffset=round(float(np.mean(y)), 9), bytes=path.stat().st_size)
            if entry.get("loop"):
                entry["seamDelta"] = round(float(np.max(np.abs(y[-1] - y[0]))), 9)
        manifest = dict(schemaVersion=1, seed=self.seed, license="CC0-1.0", humanListening="not performed",
                        sourceCommit=COMMIT, sfzCommit=SFZ_COMMIT, presetSha256=sha(PRESET), assets=self.assets)
        (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def decode(path):
    if path.suffix == ".wav":
        return sf.read(path, dtype="float64")
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype="<f4").reshape(-1, 2).astype(np.float64), SR


def db(value):
    return 20 * math.log10(max(float(value), 1e-12))


def verify():
    manifest = json.loads((OUT / "manifest.json").read_text())
    if sha(PRESET) != manifest["presetSha256"]:
        raise ValueError("Preset changed; rebuild the palette")
    ids = set()
    for entry in manifest["assets"]:
        if entry["id"] in ids:
            raise ValueError("Duplicate asset id")
        ids.add(entry["id"])
        path = OUT / entry["file"]
        if sha(path) != entry["sha256"]:
            raise ValueError(f"Hash mismatch: {path}")
        y, sr = decode(path)
        if not np.isfinite(y).all() or len(y) != entry["frames"] or sr != entry["sampleRate"]:
            raise ValueError(f"Invalid decoded audio: {path}")
        if np.max(np.abs(y)) >= 1 or np.sqrt(np.mean(y*y)) < 1e-6:
            raise ValueError(f"Clipped or silent audio: {path}")
        if entry.get("loop"):
            expected = round(entry["bars"] * 4 * 60 / entry["bpm"] * sr)
            # Compare seam with normal sample steps, as well as an absolute cap.
            delta = float(np.max(np.abs(y[-1] - y[0])))
            typical = float(np.quantile(np.abs(np.diff(y, axis=0)), .999))
            if len(y) != expected or delta > max(.005, typical * 2):
                raise ValueError(f"Loop length or seam: {path} ({delta=}, {typical=})")
    expected = {e["file"] for e in manifest["assets"]}
    actual = {str(p.relative_to(OUT)) for p in OUT.rglob("*") if p.suffix in (".wav", ".mp3")}
    if actual != expected:
        raise ValueError("Audio files and manifest differ")
    print(f"PASS: {len(ids)} assets decoded; hashes, finite samples, levels and loop boundaries verified.")
    print("Objective verification only; human listening has not been performed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["build", "verify"])
    args = parser.parse_args()
    if args.command == "verify":
        verify()
        return
    preset = json.loads(PRESET.read_text())
    palette = Palette(preset["seed"])
    palette.recordings()
    palette.generated()
    palette.styles(preset["styles"])
    palette.manifest()
    verify()


if __name__ == "__main__":
    main()
