#!/usr/bin/env python3
"""Flowers / Glasshouse Flip: isolated lead vocal, newly written house and UKG.

All input recordings and large renders live under artifacts/. Run from repo root.
This arrangement intentionally replaces the source accompaniment.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import math
from pathlib import Path

import numpy as np
from scipy import signal
import soundfile as sf

from dj_remix import SR, fade, filt, master_one, read_audio, save_json, stereo, stretch

ROOT = Path("artifacts/audio/flowers-reimagined")
SOURCE_OFFSET = 27.980113378684806
SOURCE_BPM = 118
BPM = 128
SPB = 60 / BPM
BARS = 52
TITLE = "Flowers — Glasshouse Flip"
STEM = "flowers-glasshouse-flip"


def compressor(y, threshold=.17, ratio=3., makeup=1., release=.09):
    """Linked channels, 1 ms peak envelope, smooth attack and release."""
    hop = 44
    pad = (-len(y)) % hop
    blocks = np.pad(np.max(np.abs(y), axis=1), (0, pad)).reshape(-1, hop).max(axis=1)
    env, state = np.zeros(len(blocks)), 0.
    attack_c, release_c = np.exp(-hop / SR / .003), np.exp(-hop / SR / release)
    for i, value in enumerate(blocks):
        c = attack_c if value > state else release_c
        state = c * state + (1 - c) * value
        env[i] = state
    gain = np.minimum(1, (np.maximum(env, 1e-8) / threshold) ** (1 / ratio - 1)) * makeup
    curve = np.interp(np.arange(len(y)), np.arange(len(gain)) * hop, gain)
    return (y * curve[:, None]).astype(np.float32)


def room(y, seconds=.65, predelay=.018, seed=1):
    """Small, decorrelated room; the dry signal is routed separately."""
    rng = np.random.default_rng(seed)
    t = np.arange(round(seconds * SR)) / SR
    ir = rng.normal(0, 1, (len(t), 2)).astype(np.float32)
    ir = filt(filt(ir, 430, "highpass"), 6500)
    ir *= np.exp(-t * 7 / seconds)[:, None]
    ir[:round(predelay * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    return np.column_stack([signal.fftconvolve(y[:, c], ir[:, c])[:len(y)] for c in range(2)]).astype(np.float32)


class Glasshouse:
    def __init__(self, output):
        self.output = output
        self.output.mkdir(parents=True, exist_ok=True)
        self.work = output / "work"
        self.work.mkdir(exist_ok=True)
        self.frames = round((BARS * 4 * SPB + .5) * SR)
        self.buses = {name: np.zeros((self.frames, 2), np.float32)
                      for name in ["vocals", "vocal_chops", "piano", "bass", "lead", "drums", "atmosphere", "fx"]}
        self.rng = np.random.default_rng(26101503)
        self.events = []
        self.kicks = []
        self.source_vocal = None
        self.sections = [("玻璃钢琴 / 人声暗号", 0, 4), ("蓄力", 4, 8),
                         ("Piano House / 完整副歌", 8, 22), ("器乐回答", 22, 24),
                         ("抽空 / 人声与空间", 24, 28), ("再蓄力", 28, 32),
                         ("UK Garage / 切分低音", 32, 40), ("Hook 与鼓组对答", 40, 44),
                         ("人声乐器 / 第二次器乐回答", 44, 48), ("退出与尾音", 48, 52)]

    def put(self, bus, y, beat, gain=1., pan=0):
        y = stereo(y, pan)
        pos = round(beat * SPB * SR)
        if pos < 0:
            y, pos = y[-pos:], 0
        end = min(self.frames, pos + len(y))
        if end > pos:
            self.buses[bus][pos:end] += y[:end - pos] * gain

    def echo(self, y, beat, gain=.16, spacing=.75, repeats=3):
        y = filt(filt(y, 550, "highpass"), 4500)
        for i in range(1, repeats + 1):
            self.put("fx", y[:, ::-1] if i % 2 else y, beat + spacing * i,
                     gain * .48 ** (i - 1))

    def load_vocals(self):
        p = ROOT / "source/separated/vocals.wav"
        y = filt(filt(read_audio(p), 120, "highpass"), 14500)
        # A smooth de-esser only reduces the upper band on loud sibilant peaks.
        upper = filt(y, 5400, "highpass")
        hop = 441
        n = len(upper) // hop
        rms = np.sqrt(np.mean(upper[:n * hop].reshape(n, hop, 2) ** 2, axis=(1, 2)))
        reduce = .40 * np.clip((rms - .045) / .06, 0, 1)
        reduction = np.interp(np.arange(len(y)), np.arange(n) * hop, reduce)
        y -= upper * reduction[:, None]
        y = compressor(y, .23, 2.6, 1.05, .10)
        self.source_vocal = stretch(y, BPM / SOURCE_BPM, self.work)
        # Only the lead-vocal stem enters this arrangement. No original music,
        # bass or drums are read by the renderer.

    def source_clip(self, start, end):
        factor = BPM / SOURCE_BPM
        a, b = [round((s - SOURCE_OFFSET) / factor * SR) for s in [start, end]]
        if a < 0 or b > len(self.source_vocal) or b <= a:
            raise ValueError(f"Vocal source outside joined preview: {start}..{end}")
        return fade(self.source_vocal[a:b], .008, .045)

    def vocal(self, start, end, beat, gain=.90, delay=True, label="phrase"):
        y = self.source_clip(start, end)
        self.put("vocals", y, beat, gain)
        if delay:
            self.echo(y, beat, .09 * gain, .75, 3)
        self.events.append({"kind": "vocal", "label": label, "sourceSeconds": [start, end],
                            "beat": beat, "durationSeconds": len(y) / SR})

    @lru_cache(maxsize=200)
    def piano_note(self, midi, beats=.75):
        bank = {45: "A2", 48: "C3", 51: "Ds3", 54: "Fs3", 57: "A3", 60: "C4",
                63: "Ds4", 66: "Fs4", 69: "A4", 72: "C5", 75: "Ds5", 78: "Fs5", 81: "A5"}
        pitch = min(bank, key=lambda p: abs(midi - p))
        sample = read_audio(Path("public/audio/salamander") / f"{bank[pitch]}.mp3")[:, 0]
        ratio = 2 ** ((midi - pitch) / 12)
        length = round((beats * SPB + .14) * SR)
        positions = np.arange(length) * ratio
        y = np.interp(positions, np.arange(len(sample)), sample, right=0).astype(np.float32)
        y *= np.exp(-np.arange(length) / SR * .45)
        # The distributed single-velocity piano bank is quiet next to mastered
        # drum samples; match its working level before the instrument fader.
        return fade(filt(y, 6800), .002, .14) * 4.

    def piano_chord(self, notes, beat, gain, duration=.7, spread=.007):
        for i, note in enumerate(notes):
            self.put("piano", self.piano_note(note, duration), beat + i * spread / SPB,
                     gain / math.sqrt(len(notes)), (i / max(1, len(notes) - 1) - .5) * .65)

    @lru_cache(maxsize=300)
    def bass(self, note, beats=.32, dirty=False, glide=False):
        dur = beats * SPB
        t = np.arange(round((dur + .045) * SR)) / SR
        freq = 440 * 2 ** ((note - 69) / 12)
        instant = freq * (1 + (.5 if glide else 0) * np.exp(-t / .028))
        phase = 2 * np.pi * np.cumsum(instant) / SR
        sub = np.sin(phase)
        if dirty:
            fm = np.sin(phase + 1.15 * np.sin(phase * 2) * np.exp(-t * 10))
            mid = sum(np.sin(phase * h + .03 * h) / h ** 1.35 for h in range(2, 11))
            mid = filt(np.tanh((fm + mid * .65) * 1.8), 1800)
            y = sub * .68 + mid * .32
        else:
            y = sub * .8 + np.sin(phase * 2) * .17 + np.sin(phase * 3) * .08
        env = (1 - np.exp(-t * 550)) * np.exp(-t * (3.5 if dirty else 2.6))
        env *= np.clip((dur + .045 - t) / .045, 0, 1)
        return fade(y * env * .32, .002, .025).astype(np.float32)

    @lru_cache(maxsize=300)
    def pluck(self, note, beats=.5, dark=False):
        t = np.arange(round((beats * SPB + .35) * SR)) / SR
        f = 440 * 2 ** ((note - 69) / 12)
        y = np.zeros((len(t), 2), np.float32)
        for c, cents in enumerate([-5, 5]):
            phase = 2 * np.pi * f * 2 ** (cents / 1200) * t
            y[:, c] = (np.sin(phase + .72 * np.sin(phase * 2) * np.exp(-t * 8))
                       + .19 * np.sin(phase * 3) * np.exp(-t * 11))
        envelope = (1 - np.exp(-t * 800)) * np.exp(-t * (9 if dark else 6))
        envelope *= np.clip((t[-1] - t) / .15, 0, 1)
        return filt(y * envelope[:, None] * .28, 3100 if dark else 7200)

    def pad(self, notes, beats):
        t = np.arange(round((beats * SPB + .7) * SR)) / SR
        y = np.zeros((len(t), 2), np.float32)
        for i, n in enumerate(notes):
            f = 440 * 2 ** ((n - 69) / 12)
            for c, detune in enumerate([-.003, .003]):
                phase = 2 * np.pi * f * (1 + detune) * t + i * .6
                y[:, c] += (np.sin(phase) + .2 * np.sin(phase * 2)) / len(notes)
        env = np.minimum(t / .38, 1) * np.clip((t[-1] - t) / .75, 0, 1)
        return filt(y * env[:, None], 1800)

    def chop_note(self, note, beat, duration=.4, gain=.28, reverse=False):
        # A sustained vowel becomes a playable instrument; it is used only in
        # answers, leaving the full chorus performance intact.
        y = self.source_clip(66.53, 66.85).mean(axis=1)
        # Median YIN estimate on this specific vowel: 297.28 Hz / MIDI 62.212.
        ratio = 2 ** ((note - 62.212) / 12)
        y = np.interp(np.arange(0, len(y), ratio), np.arange(len(y)), y).astype(np.float32)
        length = round(duration * SPB * SR)
        y = np.pad(y, (0, max(0, length - len(y))))[:length]
        if reverse:
            y = y[::-1]
        y = fade(filt(filt(y, 340, "highpass"), 6500), .012, .065)
        self.put("vocal_chops", y, beat, gain, -.25 if int(beat * 2) % 2 else .25)
        self.echo(stereo(y), beat, gain * .25, .75, 2)
        self.events.append({"kind": "pitchedVowel", "beat": beat, "midi": note,
                            "sourceSeconds": [66.53, 66.85], "sourceMidiEstimate": 62.212,
                            "varispeed": True})

    def synth_percussion(self, kind):
        if kind == "clap":
            t = np.arange(round(.23 * SR)) / SR
            y = filt(filt(self.rng.normal(0, 1, len(t)), 1000, "highpass"), 8800)
            e = sum(np.where(t >= x, np.exp(-np.maximum(t - x, 0) / d), 0) * g
                    for x, d, g in [(0, .005, .55), (.012, .005, .7), (.024, .037, 1)])
            return fade(y * e * .32, .001, .025)
        if kind == "rim":
            t = np.arange(round(.08 * SR)) / SR
            y = np.sin(2 * np.pi * 760 * t) + .4 * np.sin(2 * np.pi * 1230 * t)
            return fade(y * np.exp(-t * 90) * .25, .001, .01)
        t = np.arange(round(.065 * SR)) / SR
        y = filt(self.rng.normal(0, 1, len(t)), 6500, "highpass")
        return fade(y * np.exp(-t * 65) * .18, .002, .015)

    def drums(self):
        kit = {n: read_audio(ROOT / f"source/drums/{n}.wav") for n in ["kick", "snare", "hatClosed", "hatOpen"]}
        kit = {n: fade(y / max(np.max(np.abs(y)), .001), .0008, .018) for n, y in kit.items()}
        clap, rim, shaker = [self.synth_percussion(k) for k in ["clap", "rim", "shaker"]]
        for bar in range(BARS):
            b = bar * 4
            house, garage = 8 <= bar < 24, 32 <= bar < 48
            intro, build, air, outro = bar < 4, 4 <= bar < 8 or 28 <= bar < 32, 24 <= bar < 28, bar >= 48
            if house:
                kicks = [0, 1, 2, 3]
            elif garage:
                # UKG: displaced kicks, straight backbeat, swung sixteenths.
                kicks = ([0, 1.75, 2.5] if bar % 2 == 0 else [0, .75, 2.75])
            elif intro:
                kicks = [] if bar < 2 else [0, 2]
            elif build:
                kicks = [0, 2] if bar % 4 < 2 else [0, 1, 2, 3]
            elif outro:
                kicks = [0, 1, 2, 3] if bar < 50 else []
            else:
                kicks = []
            # End-of-build breath, then a clean downbeat; no vocal gating.
            if bar in [7, 31]:
                kicks = [0, 1, 2]
            if bar in [23, 47]:
                kicks = kicks[:2]
            for k in kicks:
                at = b + k
                self.put("drums", kit["kick"], at, .58 if house or garage else .40)
                self.kicks.append(at)
            if house or garage or build or outro and bar < 50:
                for sn in [1, 3]:
                    if bar in [7, 31] and sn == 3:
                        continue
                    self.put("drums", kit["snare"], b + sn + .008, .21 if garage else .16)
                    self.put("drums", clap, b + sn + .016, .35 if garage else .46)
            if air:
                if bar % 2 == 1:
                    self.put("drums", rim, b + 3, .15, -.15)
                continue
            for step in range(8):
                when = step * .5
                gain = (.072 if step % 2 else .042) * (1 if house or garage else .65)
                self.put("drums", kit["hatClosed"], b + when + (.025 if step % 2 else 0),
                         gain * self.rng.uniform(.88, 1.08), -.22)
            if house or garage:
                for k in ([.5, 1.5, 2.5, 3.5] if house else [.75, 2.75]):
                    self.put("drums", kit["hatOpen"], b + k + .012, .09 if house else .075, .25)
                for i in range(16):
                    if i % 4 == 0:
                        continue
                    off = .055 if i % 2 else 0
                    self.put("drums", shaker, b + i / 4 + off,
                             .14 if i % 4 == 2 else .085, .4 * (-1 if i % 2 else 1))
                if garage:
                    for k in [.75, 2.75, 3.25] if bar % 2 else [1.5, 3.75]:
                        self.put("drums", rim, b + k + .04, .27, .3)
                    self.put("drums", kit["snare"], b + 2.75, .048, -.2)
            if build:
                density = [1, .5, .5, .25][bar % 4]
                for t in np.arange(0, 4 if bar % 4 < 3 else 3, density):
                    self.put("drums", clap, b + t, .10 + .035 * (bar % 4))
                if bar % 4 == 3:
                    for i in range(6):
                        self.put("drums", rim, b + 3 + i / 8, .2 + .02 * i, (i % 2 - .5) * .6)
            if bar in [15, 23, 39, 47]:
                for t in [3.25, 3.5, 3.75]:
                    self.put("drums", kit["snare"], b + t, .10 if t < 3.75 else .14, .12)

    def music(self):
        chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [53, 59, 64, 69], [52, 59, 62, 67]]
        roots = [33, 38, 31, 36]
        hook = [[(.5, 76), (1.25, 79), (2, 81), (2.75, 84), (3.5, 81)],
                [(.5, 79), (1.5, 76), (2.25, 74), (3, 76), (3.5, 69)]]
        for bar in range(BARS):
            b = bar * 4
            house, garage = 8 <= bar < 24, 32 <= bar < 48
            build, air, intro, outro = 4 <= bar < 8 or 28 <= bar < 32, 24 <= bar < 28, bar < 4, bar >= 48
            idx = (bar - 8) % 4
            notes, root = chords[idx], roots[idx]
            if bar in [20, 44]:
                notes, root = [53, 57, 60, 64, 67], 29
            elif bar in [21, 45]:
                notes, root = [52, 56, 59, 62], 28
            elif bar in [22, 46]:
                notes, root = chords[0], roots[0]
            elif bar in [23, 47]:
                notes, root = [52, 56, 59, 62], 28
            if house or garage:
                spots = [0, .75, 1.5, 2.5, 3.25] if house else [.5, 1.75, 2.5, 3.5]
                for j, p in enumerate(spots):
                    self.piano_chord(notes, b + p, .19 if house else .135, .48 if j else .85)
                pattern = [(.5, .32, 0), (1.25, .22, 0), (1.75, .22, 7), (2.5, .32, 0), (3.25, .27, 12), (3.75, .17, 0)]
                if garage:
                    pattern = [(.5, .38, 0), (1.5, .25, 12), (2.75, .38, 0), (3.5, .3, 7)] if bar % 2 == 0 else [(0, .35, 0), (.75, .28, 0), (2, .28, 12), (2.75, .55, 0)]
                for p, dur, octave in pattern:
                    # Bass root remains in the sub range; harmonics carry the jump.
                    self.put("bass", self.bass(root + octave, dur, garage, garage and dur > .4), b + p, .90 if garage else 1.)
                instrumental = bar in [22, 23] or 44 <= bar < 48
                if instrumental:
                    for p, note in hook[bar % 2]:
                        if bar in [23, 45, 47]:
                            note = {79: 80, 69: 71}.get(note, note)
                        if garage:
                            self.put("lead", self.bass(note - 24, .32, True), b + p, .55, -.1)
                            self.chop_note(note - 12, b + p, .36, .42)
                        else:
                            y = self.pluck(note, .5)
                            self.put("lead", y, b + p, .75)
                            self.echo(y, b + p, .13)
                elif bar % 4 == 3:
                    # A recognisable answer at the phrase gap, then room for the singer.
                    for p, note in [(2.75, 79), (3.5, 76)]:
                        self.put("lead", self.pluck(note, .3, True), b + p, .19)
            elif intro or air or outro:
                self.piano_chord(notes, b, .16 if air else .12, 3.3, .018)
                if intro and bar % 2 == 0 or air:
                    self.put("atmosphere", self.pad(notes[-3:], 4), b, .055 if air else .035)
                if air:
                    self.put("bass", self.bass(root, 2.4), b, .33)
                if outro and bar < 50:
                    self.put("bass", self.bass(root, .6), b + .5, .6)
                if intro:
                    for p, note in hook[bar % 2][:3]:
                        self.put("lead", self.pluck(note, .5, True), b + p, .17)
            elif build:
                for p in [0, 1.5, 2.5]:
                    self.piano_chord(notes, b + p, .10 + .025 * (bar % 4), .55)
                self.put("atmosphere", self.pad(notes[-3:], 4), b, .055)

    def vocals(self):
        if self.source_vocal is None:
            self.load_vocals()
        chorus = 33.44830508474576
        post = chorus + 56 * 60 / SOURCE_BPM
        # Preserve complete, naturally paced singing, with pickup before the grid.
        pickup = .16
        self.vocal(chorus - pickup, 61.715, 32 - pickup / (BPM / SOURCE_BPM) / SPB,
                   .95, label="complete fourteen-bar chorus")
        self.vocal(chorus - pickup, 49.40,
                   128 - pickup / (BPM / SOURCE_BPM) / SPB, .94, label="chorus first four lines")
        # The hook phrase is repeated at two contrasting energies.
        post_start = 61.65
        post_pickup_beats = (post_start - post) / (BPM / SOURCE_BPM) / SPB
        self.vocal(post_start, 68.90, 96 + post_pickup_beats, .87, label="postchorus breakdown")
        self.vocal(post_start, 68.90, 160 + post_pickup_beats, .94, label="postchorus garage")
        # Teasers are a self-contained call, progressively shortening into the build.
        for bar, note in [(0, 64), (2, 67), (4, 69), (5, 67), (6, 64), (28, 64), (29, 67)]:
            self.chop_note(note, bar * 4 + .5, .7 if bar < 4 else .45, .32)
        for beat in [26.5, 27.5, 28.5, 29.25, 29.75, 30.25, 118.5, 119.5, 120.5, 121.25, 121.75, 122.25]:
            self.chop_note(64 if beat % 1 else 67, beat, .26, .33)
        # A single quiet, long echo closes the answer rather than another vocal loop.
        self.chop_note(64, 194, 1.0, .3)

    def transitions(self):
        for end in [32, 128]:
            length = 8 * SPB
            t = np.arange(round(length * SR)) / SR
            noise = filt(filt(self.rng.normal(0, 1, (len(t), 2)), 1600, "highpass"), 10500)
            env = np.linspace(0, 1, len(t)) ** 1.8
            pulse = .7 + .3 * np.sin(2 * np.pi * 4 / SPB * t) ** 2
            self.put("fx", fade(noise * (env * pulse)[:, None], .12, .04), end - 8, .043)
            # Reverse piano provides an identifiable musical transition.
            rev = self.piano_note(81, 2.2)[::-1].copy()
            self.put("fx", fade(rev, .15, .025), end - len(rev) / SR / SPB - .25, .14, .2)
            gap_a, gap_b = [round(v * SPB * SR) for v in [end - .5, end - .035]]
            for bus in ["piano", "bass", "lead", "atmosphere", "drums"]:
                self.buses[bus][gap_a:gap_b] *= np.linspace(1, 0, gap_b - gap_a)[:, None] ** 3
            # Sub impact and short downlifter sit behind the first kick.
            t = np.arange(round(1.2 * SR)) / SR
            down = filt(self.rng.normal(0, 1, (len(t), 2)), 5200, "highpass")
            down *= np.exp(-t * 5)[:, None]
            self.put("fx", fade(down, .003, .2), end, .05)
        for at in [88, 96, 176, 192]:
            t = np.arange(round(.8 * SR)) / SR
            noise = filt(self.rng.normal(0, 1, (len(t), 2)), 6500, "highpass")
            self.put("fx", fade(noise * np.exp(-t * 6)[:, None], .002, .12), at, .027)

    def mix(self):
        self.buses["bass"] *= 10 ** (-1 / 20)
        # Stereo room and dotted delay are effects returns, not the original backing.
        self.buses["fx"] += room(self.buses["vocals"], .64, .027, 10) * .055
        self.buses["fx"] += room(self.buses["piano"], .62, .011, 11) * .075
        self.buses["fx"] += room(self.buses["lead"] + self.buses["vocal_chops"], .9, .016, 12) * .085
        for bus, depth in [("bass", .68), ("piano", .43), ("lead", .32), ("atmosphere", .5), ("fx", .25)]:
            duck = np.ones(self.frames, np.float32)
            t = np.arange(round(.24 * SR)) / SR
            curve = 1 - depth * np.exp(-t / .068)
            for beat in self.kicks:
                a = round(beat * SPB * SR)
                b = min(a + len(curve), self.frames)
                duck[a:b] = np.minimum(duck[a:b], curve[:b - a])
            self.buses[bus] *= duck[:, None]
        for name in self.buses:
            y = self.buses[name]
            if name not in ["bass", "drums"]:
                y = filt(y, 105 if name in ["piano", "lead", "atmosphere"] else 50, "highpass")
            self.buses[name] = fade(y, .012, 1.0)
        mix = np.zeros((self.frames, 2), np.float32)
        stem_dir = self.output / "stems"
        stem_dir.mkdir(exist_ok=True)
        stats = {}
        for name, y in self.buses.items():
            if not np.isfinite(y).all():
                raise ValueError(f"Nonfinite audio on {name}")
            sf.write(stem_dir / f"{name}.wav", y, SR, subtype="FLOAT")
            mix += y
            stats[name] = {"peak": float(np.max(np.abs(y))), "rms": float(np.sqrt(np.mean(y ** 2)))}
        mix = filt(mix, 28, "highpass")
        mix = compressor(mix, .7, 1.6, 1., .09)
        gain = .88 / max(.88, float(np.max(np.abs(mix))))
        sf.write(self.output / "premaster.wav", mix * gain, SR, subtype="PCM_24")
        # A short audition edit includes the build, the full first chorus and answer.
        a, b = [round(v * SPB * SR) for v in [24, 96]]
        audition = fade(mix[a:b] * gain, .025, .45)
        sf.write(self.output / "drop-preview-premaster.wav", audition, SR, subtype="PCM_24")
        save_json(self.output / "arrangement.json", {
            "title": TITLE, "bpm": BPM, "sourceBpm": SOURCE_BPM, "bars": BARS,
            "durationSeconds": self.frames / SR, "key": "A minor",
            "sourceVocalOffsetSeconds": SOURCE_OFFSET,
            "accompaniment": "New piano, sub/FM bass, melodic hook, pad, house and UKG drums; source accompaniment excluded",
            "sections": [{"name": n, "startBar": a, "endBar": b,
                          "startSeconds": a * 4 * SPB, "endSeconds": b * 4 * SPB} for n, a, b in self.sections],
            "events": self.events, "busStats": stats, "premasterGain": gain,
            "listeningReview": {"performed": False, "note": "Signal measurements do not establish musical listening quality."}})
        print(f"Rendered {self.frames / SR:.2f}s / {BARS} bars at {BPM} BPM", flush=True)

    def render(self):
        self.load_vocals()
        self.drums()
        self.music()
        self.vocals()
        self.transitions()
        self.mix()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=["render", "master", "all"])
    p.add_argument("--out", type=Path, default=ROOT)
    args = p.parse_args()
    if args.command in ["render", "all"]:
        Glasshouse(args.out).render()
    if args.command in ["master", "all"]:
        result = master_one(args.out / "premaster.wav", STEM, args.out, TITLE)
        preview = master_one(args.out / "drop-preview-premaster.wav", STEM + "-drop-preview", args.out, TITLE + " / Drop Preview")
        save_json(args.out / "manifest.json", {
            "title": TITLE, "reference": "Miley Cyrus — Flowers", "bpm": BPM,
            "process": "Two aligned official AAC excerpts → htdemucs vocal → pitch-preserving atempo → entirely new accompaniment",
            "samples": {"piano": "Alexander Holm / Salamander Grand Piano / CC BY 3.0",
                        "drums": "DWSD / Deep House Drum Kit / CC Attribution via teropa/drumkit"},
            "renders": [result, preview],
            "subjectiveListeningReview": "未进行人工耳听；客观检查与浏览器播放验证单独记录。"})
        for rendered in [result, preview]:
            for f in rendered["files"]:
                print(f"{f['filename']}: {f['audioDurationSeconds']:.2f}s, {f['integratedLufs']} LUFS, {f['truePeakDbtp']} dBTP", flush=True)


if __name__ == "__main__":
    main()
