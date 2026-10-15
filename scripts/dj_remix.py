#!/usr/bin/env python3
"""DJ production: continuous source preservation or an excerpt-based arrangement.

Run from the repository root. Audio, model weights and QA stay under artifacts/.
Source recordings are supplied separately; this script does not fetch a song.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100


def run(args):
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result


def save_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def read_audio(path):
    # Decode through FFmpeg to support AAC/MP3 and normalize sample layout.
    raw = subprocess.run([
        "ffmpeg", "-v", "error", "-i", str(path), "-ar", str(SR), "-ac", "2",
        "-f", "f32le", "pipe:1",
    ], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, 2).copy()


def filt(y, hz, kind="lowpass", order=2):
    return signal.sosfilt(signal.butter(order, hz, kind, fs=SR, output="sos"), y, axis=0).astype(np.float32)


def fade(y, attack=.006, release=.018):
    y = y.copy()
    a, r = min(round(attack * SR), len(y)), min(round(release * SR), len(y))
    if a:
        y[:a] *= np.linspace(0, 1, a).reshape((-1,) + (1,) * (y.ndim - 1))
    if r:
        y[-r:] *= np.linspace(1, 0, r).reshape((-1,) + (1,) * (y.ndim - 1))
    return y


def stereo(y, pan=0):
    if y.ndim == 2:
        return y
    return np.column_stack([y * math.sqrt(1 - pan), y * math.sqrt(1 + pan)])


def stretch(y, factor, directory):
    # FFmpeg atempo changes duration while preserving pitch; no resampling trick.
    key = hashlib.sha256(y.tobytes() + str(factor).encode()).hexdigest()[:16]
    target = directory / f"stretch-{key}.wav"
    if not target.exists():
        source = directory / f"input-{key}.wav"
        sf.write(source, y, SR, subtype="FLOAT")
        run(["ffmpeg", "-v", "error", "-y", "-i", source, "-af", f"atempo={factor:.12f}",
             "-c:a", "pcm_f32le", target])
        source.unlink()
    return sf.read(target, dtype="float32", always_2d=True)[0]


def separate(source, destination, model_cache):
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    destination.mkdir(parents=True, exist_ok=True)
    torch.hub.set_dir(str(model_cache.resolve()))
    torch.manual_seed(261015)
    torch.set_num_threads(min(6, os.cpu_count() or 4))
    y = read_audio(source)
    sf.write(destination / "preview.wav", y, SR, subtype="FLOAT")
    model = get_model("htdemucs").eval()
    wave = torch.from_numpy(y.T.copy())
    reference = wave.mean(0)
    mean, deviation = reference.mean(), reference.std()
    if deviation < 1e-6:
        raise ValueError("Source is silent")
    with torch.no_grad():
        stems = apply_model(model, ((wave - mean) / deviation)[None], device="cpu",
                            shifts=1, split=True, overlap=.25, progress=True)[0]
        stems = stems * deviation + mean
    for name, audio in zip(model.sources, stems):
        sf.write(destination / f"{name}.wav", audio.T.numpy(), SR, subtype="FLOAT")
    save_json(destination / "separation.json", {
        "model": "htdemucs", "seed": 261015, "sampleRate": SR,
        "source": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "duration": len(y) / SR, "sources": model.sources,
        "note": "Machine-separated stems; these are not original studio multitracks.",
    })


class Production:
    def __init__(self, config, output):
        self.config = config
        self.output = output
        self.output.mkdir(parents=True, exist_ok=True)
        self.cache = output / "work"
        self.cache.mkdir(exist_ok=True)
        self.rng = np.random.default_rng(config["seed"])
        self.bpm = config["targetBpm"]
        self.spb = 60 / self.bpm
        self.source_spb = 60 / config["sourceBpm"]
        # Smooth, beat-based tempo ramp in the intro; all vocal phrases use one tempo.
        self.beat_durations = np.r_[60 / np.linspace(config["introBpm"], self.bpm, 16),
                                    np.full(44 * 4 - 16, self.spb)]
        self.grid = np.r_[0, np.cumsum(self.beat_durations)]
        self.frames = round((self.grid[-1] + 2.2) * SR)
        self.buses = {k: np.zeros((self.frames, 2), np.float32)
                      for k in ["vocals", "music", "drums", "bass", "synths", "fx"]}
        self.kick_times = []
        self.events = []
        self.sections = [
            ("intro", "渐速开场", 0, 4), ("build", "人声预告 / 上升", 4, 8),
            ("drop1", "第一段主唱 Drop", 8, 20), ("break", "抽空 / 人声回声", 20, 24),
            ("build2", "第二次蓄力", 24, 28), ("drop2", "第二段 Drop / 切片变化", 28, 40),
            ("outro", "鼓组退出 / 回声收尾", 40, 44),
        ]

    def at(self, beat):
        if beat <= 0:
            return beat * self.beat_durations[0]
        if beat >= len(self.beat_durations):
            return float(self.grid[-1] + (beat - len(self.beat_durations)) * self.spb)
        i = int(beat)
        return float(self.grid[i] + (beat - i) * self.beat_durations[i])

    def put(self, bus, audio, seconds, gain=1, pan=0):
        y = stereo(audio, pan)
        start = round(seconds * SR)
        if start < 0:
            y, start = y[-start:], 0
        end = min(start + len(y), self.frames)
        if end > start:
            self.buses[bus][start:end] += y[:end - start] * gain

    def echo(self, audio, seconds, gain=.2, beat=.75, repeats=3):
        dark = filt(filt(audio, 650, "highpass"), 4200)
        for i in range(1, repeats + 1):
            y = dark if i % 2 else dark[:, ::-1]
            self.put("fx", y, seconds + i * beat * self.spb, gain * .5 ** (i - 1))

    def kick(self):
        t = np.arange(round(.32 * SR)) / SR
        phase = 2 * np.pi * (49 * t + 100 * .016 * (1 - np.exp(-t / .016)))
        body = np.sin(phase) * np.exp(-t * 16) * (1 - np.exp(-t * 1900))
        click = filt(self.rng.normal(0, 1, len(t)).astype(np.float32), 2600, "highpass")
        return fade(np.tanh(body * 1.7) / 1.7 + click * .085 * np.exp(-t * 420), .001, .01)

    def clap(self):
        t = np.arange(round(.22 * SR)) / SR
        noise = self.rng.normal(0, 1, len(t)).astype(np.float32)
        noise = filt(filt(noise, 950, "highpass"), 9700)
        envelope = sum(np.where(t >= p, np.exp(-np.maximum(t - p, 0) / d), 0) * a
                       for p, d, a in [(0, .008, .55), (.011, .008, .6), (.024, .043, 1)])
        return fade(noise * envelope * .42, .001, .025)

    def hat(self, opened=False):
        t = np.arange(round((.24 if opened else .07) * SR)) / SR
        noise = filt(self.rng.normal(0, 1, len(t)).astype(np.float32), 7200, "highpass")
        metallic = np.sin(2 * np.pi * 8200 * t) * np.sin(2 * np.pi * 6357 * t)
        return fade((noise * .8 + metallic * .2) * np.exp(-t / (.052 if opened else .014)), .001, .012)

    def bass(self, midi, duration):
        t = np.arange(round((duration + .05) * SR)) / SR
        f = 440 * 2 ** ((midi - 69) / 12)
        y = sum(a * np.sin(2 * np.pi * f * h * t) for h, a in [(1, 1), (2, .3), (3, .17), (4, .055)])
        env = (1 - np.exp(-t * 300)) * np.exp(-t * 3.3)
        env *= np.clip((duration + .05 - t) / .05, 0, 1)
        return filt(np.tanh(y * env * 1.25) * .34, 1800)

    def chord(self, notes, duration, pad=False):
        t = np.arange(round((duration + (.6 if pad else .17)) * SR)) / SR
        y = np.zeros((len(t), 2), np.float32)
        for i, note in enumerate(notes):
            f = 440 * 2 ** ((note - 69) / 12)
            for channel, cents in [(0, -5), (1, 5)]:
                oscillator = sum(np.sin(2 * np.pi * f * 2 ** (cents / 1200) * h * t + i * .17) / h ** 1.6
                                 for h in range(1, 8))
                y[:, channel] += oscillator.astype(np.float32) / len(notes)
        env = np.minimum(1, t / (.22 if pad else .006))
        env *= np.exp(-t * (.45 if pad else 8))
        env *= np.clip((t[-1] - t) / (.5 if pad else .14), 0, 1)
        return filt(y * env[:, None], 1700 if pad else 3200)

    def load_source(self):
        source = Path(self.config["sourceDirectory"])
        self.stems = {name: sf.read(source / f"{name}.wav", dtype="float32", always_2d=True)
                      for name in ["vocals", "other", "bass", "drums"]}
        if any(rate != SR for _, rate in self.stems.values()):
            raise ValueError("Stems must be 44100 Hz")
        self.stems = {name: value[0] for name, value in self.stems.items()}
        start = self.config["phraseStartSeconds"]
        phrase_beats = self.config["phraseBars"] * 4
        length = phrase_beats * self.source_spb
        if start < 0 or start + length > min(len(x) for x in self.stems.values()) / SR:
            raise ValueError("The selected phrase is outside the source excerpt")
        self.source_start = start
        self.phrase = {}
        for name, y in self.stems.items():
            segment = y[round(start * SR):round((start + length) * SR)]
            warped = stretch(segment, self.bpm / self.config["sourceBpm"], self.cache)
            expected = round(phrase_beats * self.spb * SR)
            self.phrase[name] = fade(np.pad(warped, ((0, max(0, expected - len(warped))), (0, 0)))[:expected], .01, .06)
        self.phrase["vocals"] = filt(filt(self.phrase["vocals"], 145, "highpass"), 15000)
        self.phrase["other"] = filt(filt(self.phrase["other"], 270, "highpass"), 12500)
        self.roots = self.config["bassMidi"]
        self.chords = self.config["chordsMidi"]

    def chop(self, source_beat, length_beats, destination_beat, gain=.45, reverse=False, echo=True):
        start = round(source_beat * self.spb * SR)
        end = round((source_beat + length_beats) * self.spb * SR)
        y = self.phrase["vocals"][start:end]
        if reverse:
            y = y[::-1]
        y = fade(y, .009, .025)
        self.put("vocals", y, self.at(destination_beat), gain)
        if echo:
            self.echo(y, self.at(destination_beat), gain * .18, .75, 2)
        self.events.append({"kind": "vocalChop", "sourceBeat": source_beat,
                            "beats": length_beats, "destinationBeat": destination_beat,
                            "reverse": reverse})

    def arrangement(self):
        self.load_source()
        k, c, h, oh = self.kick(), self.clap(), self.hat(), self.hat(True)
        drop_bars = set(range(8, 20)) | set(range(28, 40))
        for bar in range(44):
            b = bar * 4
            drop = bar in drop_bars
            intro = bar < 4
            build = 4 <= bar < 8 or 24 <= bar < 28
            air = 20 <= bar < 24
            outro = bar >= 40
            local = bar - (8 if bar < 20 else 28) if drop else bar
            # Four-on-the-floor, with an explicit half-beat vacuum before each drop.
            if drop or (intro and bar >= 2) or (outro and bar < 43) or (build and bar % 4 < 3):
                for offset in range(4):
                    if outro and bar == 42 and offset > 1:
                        continue
                    at = self.at(b + offset)
                    self.put("drums", k, at, .76 if drop else .48)
                    self.kick_times.append(at)
            if drop or bar in [2, 3, 40, 41]:
                for offset in [1, 3]:
                    self.put("drums", c, self.at(b + offset) + .006, .37 if drop else .22, .035)
            if drop or (intro and bar >= 1) or (outro and bar < 43):
                for i in range(8):
                    offset = i / 2 + (.022 if i % 2 else 0)
                    self.put("drums", h, self.at(b + offset), (.08 if i % 2 == 0 else .047) * self.rng.uniform(.9, 1.06), -.25)
                if drop or bar in [2, 3]:
                    for offset in [.5, 1.5, 2.5, 3.5]:
                        self.put("drums", oh, self.at(b + offset + .012), .105 if drop else .055, .22)
                if drop and local % 4 == 3:
                    for offset in [3.25, 3.75]:
                        self.put("drums", h, self.at(b + offset), .06, .38)
            if build:
                progress = bar % 4
                step = [1, .5, .5, .25][progress]
                stop = 3.5 if progress == 3 else 4
                for offset in np.arange(0, stop, step):
                    self.put("drums", c, self.at(b + offset), .08 + progress * .023 + offset * .005, -.07)
            if drop:
                root = self.roots[local % 12]
                for offset, length, level in [(.5, .30, 1), (1.25, .19, .7), (1.5, .30, .9),
                                              (2.5, .30, 1), (3.25, .18, .66), (3.5, .26, .86)]:
                    self.put("bass", self.bass(root, length * self.spb), self.at(b + offset), level)
                # Low-mid stabs answer the rhythm, below the singer's presence band.
                chord = self.chords[local % 12]
                for offset in ([.75, 2.75] if bar < 28 else [.75, 1.75, 2.75]):
                    self.put("synths", self.chord(chord, .17), self.at(b + offset), .115 if bar < 28 else .14)
            if intro or air:
                if bar % 2 == 0:
                    chord = self.chords[0 if intro else 8]
                    self.put("synths", self.chord(chord, 7.5 * self.spb, True), self.at(b), .12 if intro else .17)
            if outro and bar < 43:
                self.put("bass", self.bass(self.roots[0], .16), self.at(b + .5), .55 * (1 - (bar - 40) / 3))

        # Intact, pitch-preserved phrases retain the identity of the original song.
        for bar, level in [(8, .96), (28, .96)]:
            self.put("vocals", self.phrase["vocals"], self.at(bar * 4), level)
            self.put("music", self.phrase["other"], self.at(bar * 4), .39 if bar == 8 else .30)
            # A quiet layer of original drums retains the recording's groove, with lows removed.
            self.put("music", filt(self.phrase["drums"], 1100, "highpass"), self.at(bar * 4), .065)

        # Recognizable vocal tease early; deliberately leave full-sentence passages intact.
        for src, dest, length, level in self.config["teaserChops"]:
            self.chop(src, length, dest, level)
        self.chop(self.config["breakSourceBeat"], 6, 80, .73)
        self.chop(self.config["hookSourceBeat"], 2, 86, .58)
        self.chop(self.config["hookSourceBeat"], 1, 92, .44)
        self.chop(self.config["hookSourceBeat"], .5, 96, .38)
        for i in range(6):
            self.chop(self.config["hookSourceBeat"], .25, 108 + i * .5, .40 + i * .035, echo=False)
        self.chop(self.config["hookSourceBeat"], 2, 160, .59)
        self.chop(self.config["hookSourceBeat"], 1, 168, .40)
        # A tonic chord rings through the exit instead of leaving an empty final bar.
        self.put("synths", self.chord(self.chords[0], 3.4, True), self.at(172), .18)
        self.put("bass", self.bass(self.roots[0], .6), self.at(172), .3)

        # A full eight-bar source phrase is followed by a four-bar production response.
        for i in range(4):
            for offset, size, gain in [(0, 1.5, .65), (2.5, .75, .48)]:
                self.chop(self.config["hookSourceBeat"] + (2 if i % 2 else 0), size,
                          64 + i * 4 + offset, gain)
        # A denser chop arrangement develops the final drop.
        a, z = round(self.at(144) * SR), round(self.at(160) * SR)
        self.buses["vocals"][a:z] = 0
        for i in range(4):
            src = self.config["hookSourceBeat"] + (2 if i % 2 else 0)
            for offset, size, gain in [(0, .75, .67), (1.5, .5, .47), (2.75, .75, .58)]:
                self.chop(src, size, 144 + i * 4 + offset, gain)

        for start_bar in [4, 24]:
            start, end = self.at(start_bar * 4), self.at((start_bar + 4) * 4 - .5)
            n = round((end - start) * SR)
            t = np.arange(n) / SR
            env = np.linspace(0, 1, n) ** 1.8
            noise = filt(filt(self.rng.normal(0, 1, n).astype(np.float32), 1800, "highpass"), 10000)
            rise = (noise * .035 + signal.chirp(t, 380, t[-1], 3000, method="logarithmic") * .012) * env
            self.put("fx", fade(rise, .15, .035), start)
        for bar in [8, 28]:
            t = np.arange(round(1.8 * SR)) / SR
            noise = filt(self.rng.normal(0, 1, len(t)).astype(np.float32), 3700, "highpass")
            self.put("fx", fade(noise * np.exp(-t * 4), .003, .15), self.at(bar * 4), .045)

        # Send selected phrase endings into filtered dotted-eighth echoes.
        phrase = self.phrase["vocals"]
        for bar in [8, 28]:
            for endbeat in range(16, self.config["phraseBars"] * 4 + 1, 16):
                y = fade(phrase[round((endbeat - 1) * self.spb * SR):round(endbeat * self.spb * SR)])
                self.echo(y, self.at(bar * 4 + endbeat - 1), .12, .75, 4)

        # Kick-driven ducking, independent of note placement, leaves a clear low-end pocket.
        for bus, depth in [("bass", .76), ("synths", .45), ("music", .22), ("fx", .12)]:
            envelope = np.ones(self.frames, np.float32)
            t = np.arange(round(.24 * SR)) / SR
            curve = 1 - depth * np.exp(-t / .065)
            for at in self.kick_times:
                i = round(at * SR)
                end = min(i + len(curve), self.frames)
                envelope[i:end] = np.minimum(envelope[i:end], curve[:end - i])
            self.buses[bus] *= envelope[:, None]

        # Small room reflections, with no added sub-bass in the reverb bus.
        room = filt(filt(self.buses["synths"], 750, "highpass"), 4700)
        for seconds, level in [(.027, .12), (.047, .09), (.079, .055)]:
            self.put("fx", room, seconds, level)
        # The half-beat stop is a brief designed gap, including effect tails.
        for end_beat in [32, 112]:
            start, end = round(self.at(end_beat - .5) * SR), round(self.at(end_beat) * SR)
            for bus in self.buses.values():
                bus[start:end] *= np.clip(1 - np.arange(end - start) / (.018 * SR), 0, 1)[:, None]

        for bus in self.buses.values():
            bus[:] = fade(bus, .012, 1.1)

    def render(self):
        self.arrangement()
        stems_dir = self.output / "stems"
        stems_dir.mkdir(exist_ok=True)
        mix = np.zeros((self.frames, 2), np.float32)
        for name, y in self.buses.items():
            if not np.isfinite(y).all():
                raise ValueError(f"Non-finite audio on {name}")
            sf.write(stems_dir / f"{name}.wav", y, SR, subtype="FLOAT")
            mix += y
        mix = filt(mix, 27, "highpass")
        # Reserve headroom; final loudness is set by a measured, two-pass master.
        scale = min(1., .88 / max(float(np.max(np.abs(mix))), .001))
        mix *= scale
        sf.write(self.output / "premaster.wav", mix, SR, subtype="PCM_24")
        sections = [{"id": key, "name": name, "startSeconds": self.at(start * 4),
                     "endSeconds": self.at(end * 4), "startBar": start + 1, "bars": end - start}
                    for key, name, start, end in self.sections]
        save_json(self.output / "arrangement.json", {
            "track": self.config["title"], "sourceBpm": self.config["sourceBpm"],
            "introBpm": self.config["introBpm"], "targetBpm": self.bpm, "pitchShiftSemitones": 0,
            "seed": self.config["seed"], "sourcePhraseStart": self.source_start,
            "sourcePhraseDuration": self.config["phraseBars"] * 4 * self.source_spb, "sections": sections,
            "beatTimes": self.grid.tolist(), "vocalEdits": self.events,
            "premasterGain": scale, "stemSumNote": "Stems are before mix highpass and headroom gain.",
            "listeningReview": {"performed": False, "note": "Signal measurements do not establish listening quality."},
        })
        # Short edit: four-bar build plus twelve bars of the first drop, with an echo exit.
        a, z = round(self.at(16) * SR), round(self.at(80) * SR)
        short = np.zeros((z - a + round(1.7 * SR), 2), np.float32)
        short[:z - a] = mix[a:z]
        # A fade at the edit boundary prevents a cut through a sustained waveform.
        end_fade = round(.18 * SR)
        short[z - a - end_fade:z - a] *= np.linspace(1, 0, end_fade)[:, None]
        snippet = fade(filt(mix[z - round(.25 * SR):z], 750, "highpass"), .01, .04)
        for i in range(1, 5):
            start = z - a - len(snippet) + round(i * .75 * self.spb * SR)
            end = min(len(short), start + len(snippet))
            if end > start:
                short[start:end] += snippet[:end - start, ::-1 if i % 2 else 1] * .24 * .56 ** (i - 1)
        sf.write(self.output / "short-premaster.wav", fade(short, .012, .4), SR, subtype="PCM_24")
        print(f"Rendered {len(mix) / SR:.2f}s DJ edit + {len(short) / SR:.2f}s short edit", flush=True)


class ContinuousProduction(Production):
    """Keep the entire original mix once, in order, with additive DJ layers.

    No source separation, vocal slicing, loop filling or ducking is applied to
    the original recording. Sections control only newly synthesized sounds.
    """

    def __init__(self, config, output, source):
        self.config, self.output, self.source = config, output, source
        self.rng = np.random.default_rng(config["seed"])
        self.bpm = float(config["targetBpm"])
        self.source_bpm = float(config["sourceBpm"])
        if not (60 <= self.source_bpm <= 200 and 60 <= self.bpm <= 200):
            raise ValueError("Source and target BPM must be between 60 and 200")
        self.spb, self.factor = 60 / self.bpm, self.bpm / self.source_bpm
        raw = read_audio(source)
        self.source_frames = len(raw)
        self.source_duration = self.source_frames / SR
        if not np.isfinite(raw).all() or not len(raw) or np.max(np.abs(raw)) < 1e-5:
            raise ValueError("Invalid or silent source recording")
        if self.source_duration < config.get("minimumSourceSeconds", 0):
            raise ValueError(f"Source is only {self.source_duration:.2f}s. This preset requires a complete "
                             f"recording of at least {config['minimumSourceSeconds']}s; a preview cannot fill it.")
        self.source_phase = float(config["sourceFirstBeatSeconds"])
        if not 0 <= self.source_phase < 60 / self.source_bpm:
            raise ValueError("sourceFirstBeatSeconds must describe the beat phase within one source beat")
        self.output.mkdir(parents=True, exist_ok=True)
        self.cache = output / "work"
        self.cache.mkdir(exist_ok=True)
        # Transform the complete recording in one operation. No trimming or padding.
        self.warped = stretch(raw, self.factor, self.cache)
        self.intro_beats = int(config.get("introBars", 4)) * 4
        if self.intro_beats < 4:
            raise ValueError("Use at least one bar of DJ intro")
        ramp = 60 / np.linspace(config.get("introBpm", self.source_bpm), self.bpm, self.intro_beats)
        source_beats = math.ceil(self.source_duration / (60 / self.source_bpm))
        self.song_end_beat = self.intro_beats + source_beats
        self.outro_beats = int(config.get("outroBars", 4)) * 4
        self.beat_durations = np.r_[ramp, np.full(source_beats + self.outro_beats, self.spb)]
        self.grid = np.r_[0, np.cumsum(self.beat_durations)]
        self.source_start_frame = round((self.at(self.intro_beats) - self.source_phase / self.factor) * SR)
        self.source_end_frame = self.source_start_frame + len(self.warped)
        self.frames = round((self.grid[-1] + .35) * SR)
        if self.source_start_frame < 0 or self.source_end_frame > self.frames:
            raise ValueError("Complete source must fit within the arrangement")
        self.buses = {k: np.zeros((self.frames, 2), np.float32)
                      for k in ["original", "drums", "synths", "fx"]}
        self.source_gain = float(config.get("sourcePeak", .78)) / float(np.max(np.abs(self.warped)))
        self.kick_times, self.events = [], []

    def source_at(self, seconds):
        return self.source_start_frame / SR + seconds / self.factor

    def section_at(self, source_seconds):
        entries = [s for s in self.config["songSections"] if s["start"] <= source_seconds]
        return entries[-1] if entries else self.config["songSections"][0]

    def arrangement(self):
        # A single placement of every transformed source frame; never fade or gate this bus.
        self.buses["original"][self.source_start_frame:self.source_end_frame] = self.warped * self.source_gain
        kick, clap, closed, opened = self.kick(), self.clap(), self.hat(), self.hat(True)
        for beat in range(len(self.beat_durations)):
            at = self.at(beat)
            source_seconds = (at - self.source_start_frame / SR) * self.factor
            before, after = source_seconds < 0, source_seconds >= self.source_duration
            section = self.section_at(max(0, source_seconds))
            energy = float(section.get("energy", .75))
            if before:
                energy = .36 + .30 * beat / self.intro_beats
            if after:
                energy = .58 * max(0, 1 - (beat - self.song_end_beat) / max(1, self.outro_beats))
            # Only the added kick is removed for a half-beat before a chorus.
            upcoming = next((s for s in self.config["songSections"]
                             if s["start"] > source_seconds), None)
            drop_gap = (upcoming is not None and upcoming.get("kind") == "chorus"
                        and 0 < upcoming["start"] - source_seconds < self.factor * self.spb * .65)
            if energy > .12 and not drop_gap:
                self.put("drums", kick, at, .49 * energy)
                self.kick_times.append(at)
            if beat % 2 == 1:
                self.put("drums", clap, at + .004, .25 * energy, .02)
            for sub in [0, .5]:
                self.put("drums", closed, self.at(beat + sub) + (.007 if sub else 0),
                         (.047 if sub == 0 else .035) * energy * self.rng.uniform(.93, 1.06), -.22)
            if energy > .66:
                self.put("drums", opened, self.at(beat + .5) + .005, .07 * energy, .22)
            if beat % 16 == 15 and not before and not after and energy > .75:
                for sub in [.25, .75]:
                    self.put("drums", closed, self.at(beat + sub), .037 * energy, .35)

        # Harmonic synths are confined to the new intro and outro. The full song
        # keeps its own original bass, chords and melodic instruments.
        chord = self.config.get("introChordMidi", [57, 60, 64])
        for beat, level in [(0, .10), (8, .12), (self.song_end_beat, .12),
                            (self.song_end_beat + 8, .09)]:
            self.put("synths", self.chord(chord, 7 * self.spb, True), self.at(beat), level)

        # Section cues are mapped from source seconds through the same time transform.
        for section in self.config["songSections"]:
            if section.get("kind") != "chorus" or section["start"] >= self.source_duration:
                continue
            end = self.source_at(section["start"])
            length = min(4 * self.spb, end)
            n = round(length * SR)
            t = np.arange(n) / SR
            noise = filt(filt(self.rng.normal(0, 1, n).astype(np.float32), 2500, "highpass"), 11000)
            riser = fade(noise * np.linspace(0, 1, n) ** 2, .04, .045)
            self.put("fx", riser, end - length, .012)
            t = np.arange(round(.75 * SR)) / SR
            down = filt(self.rng.normal(0, 1, len(t)).astype(np.float32), 5700, "highpass")
            self.put("fx", fade(down * np.exp(-t * 7), .005, .08), end, .014)

        for bus in ["synths", "fx"]:
            duck = np.ones(self.frames, np.float32)
            curve = 1 - .3 * np.exp(-np.arange(round(.2 * SR)) / SR / .06)
            for at in self.kick_times:
                start = round(at * SR)
                end = min(start + len(curve), self.frames)
                duck[start:end] = np.minimum(duck[start:end], curve[:end - start])
            self.buses[bus] *= duck[:, None]
        for name in ["drums", "synths", "fx"]:
            self.buses[name] = fade(self.buses[name], .012, 1.1)

    def render(self):
        self.arrangement()
        stems = self.output / "stems"
        stems.mkdir(exist_ok=True)
        mix = np.zeros((self.frames, 2), np.float32)
        for name, y in self.buses.items():
            if not np.isfinite(y).all():
                raise ValueError(f"Invalid samples on {name}")
            sf.write(stems / f"{name}.wav", y, SR, subtype="FLOAT")
            mix += y
        # Constant mix gain leaves the entire original recording's relative dynamics intact.
        scale = min(1., .88 / max(float(np.max(np.abs(mix))), .001))
        sf.write(self.output / "premaster.wav", mix * scale, SR, subtype="PCM_24")
        actual = self.buses["original"][self.source_start_frame:self.source_end_frame]
        reference = self.warped * self.source_gain
        exact = np.array_equal(actual, reference)
        if not exact:
            raise ValueError("Continuous-source verification failed")
        coverage = {
            "mode": "continuous-original-mix", "inputFile": str(self.source),
            "inputSha256": hashlib.sha256(self.source.read_bytes()).hexdigest(),
            "sourceFrames": self.source_frames, "sourceDurationSeconds": self.source_duration,
            "sourceRangeSeconds": [0, self.source_duration], "coveragePercent": 100,
            "outputStartFrame": self.source_start_frame, "outputEndFrame": self.source_end_frame,
            "outputStartSeconds": self.source_start_frame / SR,
            "outputEndSeconds": self.source_end_frame / SR,
            "transformedSourceFrames": len(self.warped), "occurrences": 1,
            "edits": [], "sourceGain": self.source_gain, "pitchShiftSemitones": 0,
            "sourceBpm": self.source_bpm, "targetBpm": self.bpm, "tempoFactor": self.factor,
            "expectedTransformedSeconds": self.source_duration / self.factor,
            "actualTransformedSeconds": len(self.warped) / SR,
            "sourceBusEqualsSingleTransformedRecording": bool(exact),
            "note": "All decoded source frames enter one atempo operation. Its complete output is placed once. "
                    "No original vocals, melody or instruments are removed, gated, looped or replaced.",
        }
        sections = [{"name": "DJ 渐速开场", "startSeconds": 0,
                     "endSeconds": self.source_start_frame / SR}]
        entries = self.config["songSections"]
        for i, s in enumerate(entries):
            start = min(s["start"], self.source_duration)
            end = min(entries[i + 1]["start"] if i + 1 < len(entries) else self.source_duration,
                      self.source_duration)
            if end > start:
                sections.append({"name": s["name"], "sourceStartSeconds": start,
                                 "sourceEndSeconds": end, "startSeconds": self.source_at(start),
                                 "endSeconds": self.source_at(end)})
        sections.append({"name": "DJ 尾奏", "startSeconds": self.source_end_frame / SR,
                         "endSeconds": self.frames / SR})
        save_json(self.output / "arrangement.json", {
            "title": self.config["title"], "sourceCoverage": coverage, "sections": sections,
            "beatTimes": self.grid.tolist(), "premasterGain": scale,
            "listeningReview": {"performed": False, "note": "Signal verification is not a listening review."},
        })
        save_json(self.output / "source-coverage.json", coverage)
        print(f"Rendered {self.frames / SR:.2f}s; preserved all {self.source_duration:.2f}s "
              f"of the recording in one continuous placement.", flush=True)


def measure(path):
    result = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                  "loudnorm=I=-13:TP=-1.7:LRA=9:print_format=json", "-f", "null", "-"])
    blocks = re.findall(r'\{\s*"input_i"[\s\S]*?\}', result.stderr)
    if not blocks:
        raise RuntimeError("No loudness measurement returned")
    raw = json.loads(blocks[-1])
    if not all(math.isfinite(float(raw[k])) for k in ["input_i", "input_tp", "input_lra"]):
        raise ValueError("Invalid/silent audio")
    return raw


def master_one(source, stem, output, title="Flowers — Night Bloom DJ Edit"):
    before = measure(source)
    filtstr = ("loudnorm=I=-13:TP=-1.7:LRA=9:"
               f"measured_I={before['input_i']}:measured_TP={before['input_tp']}:"
               f"measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:"
               f"offset={before['target_offset']}:linear=true:print_format=json")
    wav, mp3 = output / f"{stem}.wav", output / f"{stem}.mp3"
    run(["ffmpeg", "-v", "info", "-nostats", "-y", "-i", source, "-af", filtstr,
         "-ar", SR, "-c:a", "pcm_s24le", wav])
    corrections = []

    def attenuate(decibels):
        safe = output / f"{stem}.peak-safe.wav"
        run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", f"volume={decibels:.6f}dB",
             "-c:a", "pcm_s24le", safe])
        safe.replace(wav)
        corrections.append(decibels)

    # Loudnorm and MP3 encoding can overshoot their nominal true-peak setting.
    # Measure the actual files and preserve headroom with gain, not extra clipping.
    wav_peak = float(measure(wav)["input_tp"])
    if wav_peak > -1.9:
        attenuate(-1.95 - wav_peak)
    for attempt in range(3):
        run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "320k",
             "-metadata", f"title={title}", "-metadata", "artist=Unofficial DJ study",
             "-write_xing", "1", mp3])
        mp3_peak = float(measure(mp3)["input_tp"])
        if mp3_peak <= -1.5:
            break
        attenuate(-1.6 - mp3_peak)
    files = []
    for path in [wav, mp3]:
        m = measure(path)
        pcm = read_audio(path)
        files.append({"filename": path.name, "bytes": path.stat().st_size,
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                      "audioDurationSeconds": len(pcm) / SR, "sampleRate": SR, "channels": 2,
                      "integratedLufs": float(m["input_i"]), "truePeakDbtp": float(m["input_tp"]),
                      "loudnessRangeLu": float(m["input_lra"]),
                      "clippedSamples": int(np.count_nonzero(np.abs(pcm) >= 1)),
                      "finite": bool(np.isfinite(pcm).all()),
                      "stereoCorrelation": float(np.corrcoef(pcm.T)[0, 1])})
        if files[-1]["clippedSamples"] or files[-1]["truePeakDbtp"] > -1.5:
            raise ValueError(f"Final-file peak check failed: {path}")
    return {"before": before, "postMasterGainCorrectionsDb": corrections, "files": files}


def master(config, output):
    continuous = config.get("mode") == "continuous"
    if continuous:
        results = [master_one(output / "premaster.wav", config["outputStem"], output, config["title"])]
    else:
        results = [master_one(output / "premaster.wav", "flowers-night-bloom-dj-edit", output),
                   master_one(output / "short-premaster.wav", "flowers-night-bloom-short", output)]
    save_json(output / "manifest.json", {
        "title": config["title"], "artistReference": "Miley Cyrus — Flowers",
        "source": config["sourceReference"],
        "processing": ("Continuous original stereo mix + FFmpeg atempo + additive DJ drums"
                       if continuous else "htdemucs + FFmpeg atempo + deterministic DSP arrangement"),
        "sourceCoverage": (json.loads((output / "arrangement.json").read_text())["sourceCoverage"]
                           if continuous else None),
        "target": {"integratedLufs": -13, "normalizerTruePeakDbtp": -1.7,
                   "wavCeilingDbtp": -1.9, "mp3CeilingDbtp": -1.5,
                   "note": "Project target, not a platform requirement; final measured peaks take precedence over exact loudness"},
        "renders": results, "subjectiveListeningReview": "未进行人工耳听；只完成客观音频验证",
    })
    for r in results:
        for f in r["files"]:
            print(f"{f['filename']}: {f['audioDurationSeconds']:.2f}s, {f['integratedLufs']} LUFS, {f['truePeakDbtp']} dBTP")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["separate", "render", "master", "all"])
    parser.add_argument("--config", type=Path, default=Path("scripts/presets/flowers-dj.json"))
    parser.add_argument("--source", type=Path, help="Recording; required for separate/all and continuous rendering")
    parser.add_argument("--out", type=Path, default=Path("artifacts/audio/flowers-dj"))
    parser.add_argument("--model-cache", type=Path, default=Path("artifacts/dj-tools/model-cache"))
    parser.add_argument("--overwrite", action="store_true", help="Replace this edit's existing renders")
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if args.command in ["render", "all", "master"] and not args.overwrite:
        existing = [args.out / name for name in ["premaster.wav", "manifest.json"] if (args.out / name).exists()]
        if existing:
            parser.error(f"Existing output: {existing}. Choose --out or pass --overwrite.")
    continuous = config.get("mode") == "continuous"
    if args.command == "separate" or (args.command == "all" and not continuous):
        if args.source is None or not args.source.is_file():
            parser.error("--source must refer to an existing recording")
        separate(args.source, Path(config["sourceDirectory"]), args.model_cache)
    if args.command in ["render", "all"]:
        if continuous:
            if args.source is None or not args.source.is_file():
                parser.error("Continuous rendering requires --source with the complete recording")
            ContinuousProduction(config, args.out, args.source).render()
        else:
            Production(config, args.out).render()
    if args.command in ["master", "all"]:
        master(config, args.out)


if __name__ == "__main__":
    main()
