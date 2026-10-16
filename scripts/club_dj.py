#!/usr/bin/env python3
"""Original club instrumental with occasional licensed vocal phrases.

The DJ composition owns the arrangement, melody, bass and drums. Configured
vocal inserts are self-contained phrases rather than the basis of the drops.
Run from the repository root; recordings and rendered audio stay in artifacts/.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy import signal
import soundfile as sf

from dj_remix import SR, fade, filt, master_one, read_audio, save_json, stereo, stretch
from flowers_glasshouse import compressor, room


class ClubDJ:
    def __init__(self, config, output):
        self.config = config
        self.output = output
        output.mkdir(parents=True, exist_ok=True)
        self.work = output / "work"
        self.work.mkdir(exist_ok=True)
        self.bpm = float(config["bpm"])
        self.spb = 60 / self.bpm
        self.bars = int(config["bars"])
        self.frames = round((self.bars * 4 * self.spb + config["tailSeconds"]) * SR)
        self.rng = np.random.default_rng(config["seed"])
        self.buses = {name: np.zeros((self.frames, 2), np.float32) for name in
                      ["drums", "bass", "rumble", "riff", "acid", "chords", "vocals", "fx"]}
        self.kicks = []
        self.events = []
        self.sections = config["sections"]
        self.roots = config["bassRootsMidi"]
        self.hook = config["hook"]
        self.vocal_regions = []

    def put(self, bus, y, beat, gain=1., pan=0):
        y = stereo(y, pan)
        a = round(beat * self.spb * SR)
        if a < 0:
            y, a = y[-a:], 0
        b = min(a + len(y), self.frames)
        if b > a:
            self.buses[bus][a:b] += y[:b - a] * gain

    def echo(self, bus, y, beat, gain=.12, interval=.75, repeats=3):
        y = filt(filt(stereo(y), 550, "highpass"), 4800)
        for i in range(1, repeats + 1):
            self.put(bus, y[:, ::-1] if i % 2 else y, beat + i * interval,
                     gain * .48 ** (i - 1))

    def frequency(self, midi):
        return 440 * 2 ** ((midi - 69) / 12)

    @lru_cache(maxsize=8)
    def kick(self, soft=False):
        t = np.arange(round(.45 * SR)) / SR
        # Deep body, upper transient and a tiny noisy beater are designed here.
        phase = 2 * np.pi * (49 * t + 91 * .023 * (1 - np.exp(-t / .023)))
        env = (1 - np.exp(-t * 2800)) * np.exp(-t * 13)
        body = np.sin(phase) * env
        knock = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 90) * .13
        click = filt(self.rng.normal(0, 1, len(t)), 4200, "highpass") * np.exp(-t * 600) * .15
        y = np.tanh((body + knock) * 1.85) / 1.6 + click
        return fade(y.astype(np.float32), .0005, .025) * (.78 if soft else 1.)

    @lru_cache(maxsize=8)
    def clap(self):
        t = np.arange(round(.22 * SR)) / SR
        n = filt(filt(self.rng.normal(0, 1, len(t)), 950, "highpass"), 10000)
        env = sum(np.where(t >= p, np.exp(-np.maximum(t - p, 0) / d), 0) * a
                  for p, d, a in [(0, .006, .6), (.011, .007, .8), (.026, .045, 1)])
        snap = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 65) * .20
        return fade((n * env * .36 + snap).astype(np.float32), .001, .025)

    @lru_cache(maxsize=8)
    def metal(self, kind):
        dur = {"closed": .075, "open": .25, "ride": .6, "rim": .07, "shaker": .09}[kind]
        t = np.arange(round(dur * SR)) / SR
        noise = self.rng.normal(0, 1, len(t)).astype(np.float32)
        if kind == "rim":
            y = (np.sin(2 * np.pi * 790 * t) + .55 * np.sin(2 * np.pi * 1370 * t))
            y *= np.exp(-t * 85)
        else:
            partial = sum(np.sin(2 * np.pi * f * t) for f in [3377, 4791, 6229, 8113, 10433]) / 5
            y = filt(noise * .6 + partial * .4, 6000 if kind == "shaker" else 4800, "highpass")
            decay = {"closed": .015, "open": .07, "ride": .17, "shaker": .023}[kind]
            y *= np.exp(-t / decay)
        return fade(y, .001, .018) * .40

    @lru_cache(maxsize=500)
    def bass(self, midi, beats, mode=0):
        dur = beats * self.spb
        t = np.arange(round((dur + .035) * SR)) / SR
        f = self.frequency(midi)
        phase = 2 * np.pi * f * t
        sub = np.sin(phase)
        index = (.9 if mode == 0 else 1.7) * np.exp(-t * 12) + .18
        upper = np.sin(phase + index * np.sin(phase * 2))
        saw = sum(np.sin(phase * h) / h ** 1.4 for h in range(2, 9))
        upper = filt(np.tanh((upper + saw * .35) * 1.7), 1550 if mode == 0 else 2300)
        y = sub * .69 + upper * .31
        env = (1 - np.exp(-t * 700)) * np.exp(-t * 3)
        env *= np.clip((dur + .035 - t) / .035, 0, 1)
        return fade((y * env * .31).astype(np.float32), .0015, .02)

    @lru_cache(maxsize=500)
    def riff(self, midi, beats, mode=0):
        t = np.arange(round((beats * self.spb + .11) * SR)) / SR
        f = self.frequency(midi)
        y = np.zeros((len(t), 2), np.float32)
        for channel, cents in enumerate([-6, 6]):
            phase = 2 * np.pi * f * 2 ** (cents / 1200) * t
            index = (2.6 if mode else 1.65) * np.exp(-t * 11) + .38
            fm = np.sin(phase + index * np.sin(2 * phase))
            saw = sum(np.sin(phase * h) / h ** 1.15 for h in range(1, min(18, int(14000 / f))))
            y[:, channel] = np.tanh((fm * .67 + saw * .33) * 1.45)
        env = (1 - np.exp(-t * 900)) * np.exp(-t * (9 if mode else 7))
        env *= np.clip((t[-1] - t) / .075, 0, 1)
        y = filt(y * env[:, None] * .24, 5700 if mode else 4100)
        return fade(filt(y, 200, "highpass"), .002, .045)

    @lru_cache(maxsize=500)
    def acid(self, midi, beats=.22, bright=0):
        t = np.arange(round((beats * self.spb + .08) * SR)) / SR
        f = self.frequency(midi)
        phase = 2 * np.pi * f * t
        # Harmonic decay acts as a moving spectral envelope; a resonant band
        # around the third partial gives the short acid response its character.
        y = sum(np.sin(h * phase) / h * np.exp(-t * (4 + h * 1.3))
                for h in range(1, min(24, int(14000 / f))))
        band = signal.iirpeak(min(f * (3 + bright), 6500), 3, fs=SR)
        resonant = signal.lfilter(*band, y)
        y = np.tanh((y + resonant * 1.8) * 1.4)
        env = (1 - np.exp(-t * 1200)) * np.clip((t[-1] - t) / .055, 0, 1)
        return fade(filt(y * env * .22, 7700), .002, .025)

    @lru_cache(maxsize=80)
    def chord(self, notes, beats=4., gated=False):
        t = np.arange(round((beats * self.spb + .4) * SR)) / SR
        y = np.zeros((len(t), 2), np.float32)
        for i, note in enumerate(notes):
            f = self.frequency(note)
            for c, cents in enumerate([-9, 9]):
                phase = 2 * np.pi * f * 2 ** (cents / 1200) * t + i * .37
                y[:, c] += (np.sin(phase) + .30 * np.sin(phase * 2) + .12 * np.sin(phase * 3)) / len(notes)
        env = np.minimum(t / .15, 1) * np.clip((t[-1] - t) / .45, 0, 1)
        if gated:
            env *= (.25 + .75 * np.sin(np.pi * t / self.spb * 2) ** 4)
        return filt(y * env[:, None], 3200 if gated else 1600)

    def arrange_drums(self):
        kick, clap = self.kick(), self.clap()
        for bar in range(self.bars):
            b = bar * 4
            drop = 8 <= bar < 24 or 32 <= bar < 56
            build = 4 <= bar < 8 or 28 <= bar < 32
            second = 32 <= bar < 56
            breakdown = 24 <= bar < 28
            outro = bar >= 56
            if breakdown:
                if bar == 27:
                    self.put("drums", self.metal("rim"), b + 2.5, .18, .35)
                continue
            if drop or build or 56 <= bar < 60:
                pattern = [0, 1, 2, 3]
            elif 2 <= bar < 4:
                pattern = [0, 2]
            elif bar in [60, 61]:
                pattern = [0, 2]
            else:
                pattern = []
            if bar in [7, 31, 47, 55]:
                pattern = [0, 1, 2]
            for p in pattern:
                self.put("drums", kick, b + p, .66 if drop else .49)
                self.kicks.append(b + p)
                self.events.append({"kind": "kick", "beat": b + p})
            if drop or build or 56 <= bar < 60:
                for p in [1, 3]:
                    if bar in [7, 31, 47, 55] and p == 3:
                        continue
                    self.put("drums", clap, b + p + .012, .61 if drop else .37)
            if bar >= 62:
                continue
            for p in np.arange(0, 4, .5):
                velocity = .22 if p % 1 else .12
                self.put("drums", self.metal("closed"), b + p + (.018 if p % 1 else 0),
                         velocity * self.rng.uniform(.88, 1.08), -.20)
            if drop or 56 <= bar < 60:
                for p in [.5, 1.5, 2.5, 3.5]:
                    self.put("drums", self.metal("open"), b + p + .005, .28 if second else .22, .22)
                if bar >= 16:
                    for p in [.5, 1.5, 2.5, 3.5]:
                        self.put("drums", self.metal("ride"), b + p, .095 if second else .065, -.25)
                for i in range(16):
                    if i % 4 == 0:
                        continue
                    self.put("drums", self.metal("shaker"), b + i / 4 + (.025 if i % 2 else 0),
                             .18 if i % 4 == 2 else .11, .4 * (-1 if i % 2 else 1))
                if second:
                    for p in [.75, 2.25, 3.75] if bar % 2 else [1.25, 2.75]:
                        self.put("drums", self.metal("rim"), b + p, .24, .27)
            if build:
                interval = [1., .5, .5, .25][bar % 4]
                for p in np.arange(0, 3.35 if bar % 4 == 3 else 4, interval):
                    self.put("drums", clap, b + p, .14 + .035 * (bar % 4))
            if bar % 8 == 7 and (drop or build):
                for i, p in enumerate([3.125, 3.375, 3.625]):
                    self.put("drums", self.metal("rim"), b + p, .2 + i * .035, -.3 + i * .3)

    def arrange_music(self):
        voicings = [(60, 63, 67, 74), (56, 60, 63, 70), (58, 62, 65, 72), (55, 59, 62, 65)]
        for bar in range(self.bars):
            b = bar * 4
            drop_a = 8 <= bar < 24
            drop_b = 32 <= bar < 56
            active = drop_a or drop_b
            root = self.roots[bar % 8]
            chord_index = 0 if bar % 8 < 4 else 1 if bar % 8 < 6 else 2 if bar % 8 == 6 else 3
            notes = voicings[chord_index]
            if active:
                pattern = [(.5, .30, 0), (1.25, .17, 0), (1.75, .18, 12), (2.5, .30, 0), (3.25, .17, 7), (3.75, .15, 0)]
                if drop_b:
                    pattern = [(.25, .16, 0), (.75, .18, 12), (1.5, .30, 0), (2.25, .16, 0), (2.75, .18, 7), (3.5, .32, 0)]
                for p, dur, transpose in pattern:
                    if bar in [23, 47, 55] and p >= 3:
                        continue
                    self.put("bass", self.bass(root + transpose, dur, int(drop_b)), b + p, .91)
                # A composed two-bar motif belongs to this instrumental, not
                # to the sampled song. Evolve its timbre and register by section.
                motif = self.hook[bar % 2]
                for p, note, duration in motif:
                    if bar % 8 == 7:
                        note = {58: 59, 63: 62, 65: 66}.get(note, note)
                    if drop_b and bar < 48:
                        note -= 12
                    y = self.riff(note, duration, int(drop_b))
                    # The lower register loses energy through the lead's
                    # high-pass, so match it without raising the bass bus.
                    level = .88 if drop_a else 1.5 if bar < 48 else .86
                    self.put("riff", y, b + p, level)
                    self.echo("fx", y, b + p, .055, .75, 2)
                    self.events.append({"kind": "originalRiff", "beat": b + p, "midi": note,
                                        "durationBeats": duration, "variant": "low-fm" if drop_b and bar < 48 else "upper-fm"})
                    if bar >= 48 and p in [0, 1.5, 3]:
                        self.put("riff", self.riff(note + 12, duration, 0), b + p, .23)
                if bar % 4 == 3:
                    for p, note in zip([2.5, 2.75, 3.25, 3.5], [72, 75, 79, 77]):
                        if bar % 8 == 7:
                            note = {75: 74, 77: 78}.get(note, note)
                        y = self.acid(note, .20, int(drop_b))
                        self.put("acid", y, b + p, .34 if drop_a else .49, .18)
                        self.echo("fx", y, b + p, .075, .75, 2)
                if bar >= 48:
                    # Three-beat accent against the four-beat grid, resolving
                    # after the eight-bar development; no continuous extra sub.
                    for p in [v for v in np.arange(0, 4, .75) if (bar * 4 + v) % 3 < .1]:
                        self.put("acid", self.acid(84 if bar % 2 else 79, .18, 1), b + p, .25, -.25)
                if bar % 2 == 0:
                    self.put("chords", self.chord(notes, 6.5, True), b, .054)
            elif bar < 4:
                if bar % 2 == 0:
                    self.put("chords", self.chord(notes, 7.5), b, .065)
                for p, note, dur in self.hook[bar % 2][:3]:
                    self.put("riff", filt(self.riff(note, dur), 1100), b + p, .20 + bar * .025)
            elif 4 <= bar < 8 or 28 <= bar < 32:
                for p, note, dur in self.hook[bar % 2]:
                    y = filt(self.riff(note, dur), 1300 + (bar % 4) * 900)
                    self.put("riff", y, b + p, .25 + (bar % 4) * .055)
                self.put("chords", self.chord(notes, 4, True), b, .06)
            elif 24 <= bar < 28:
                if bar % 2 == 0:
                    self.put("chords", self.chord(notes, 7.3), b, .09)
                if bar == 27:
                    self.put("acid", self.acid(72, .5), b + 3, .24)
            elif bar >= 56:
                if bar < 60:
                    for p in [.5, 1.5, 2.5, 3.5]:
                        self.put("bass", self.bass(root, .3), b + p, .65)
                if bar in [56, 60, 62]:
                    self.put("chords", self.chord(notes, 7), b, .075 if bar < 62 else .04)
                if bar == 60:
                    for p, note, dur in self.hook[0][:3]:
                        self.put("riff", self.riff(note, dur), b + p, .16)

    def arrange_vocals(self):
        source_path = Path(self.config["vocalSource"])
        y = read_audio(source_path)
        y = filt(filt(y, 150, "highpass"), 13800)
        y = compressor(y, .20, 2.4, 1., .1)
        y = stretch(y, self.bpm / self.config["sourceBpm"], self.work)
        factor = self.bpm / self.config["sourceBpm"]
        for insert in self.config["vocalInserts"]:
            a, b = [round(s / factor * SR) for s in insert["sourceSeconds"]]
            if a < 0 or b > len(y) or b <= a:
                raise ValueError("Vocal phrase is outside the downloaded recording")
            phrase = fade(y[a:b], .012, .065)
            beat, level = insert["beat"], insert.get("gain", .8)
            self.put("vocals", phrase, beat, level)
            # Delay only the final half-second, rather than repeating the whole
            # line under the drop. This keeps the song cameo brief.
            tail = phrase[-round(.5 * SR):]
            tail_beat = beat + (len(phrase) - len(tail)) / SR / self.spb
            self.echo("fx", tail, tail_beat, .12 * level, .75, 3)
            start, end = beat * self.spb, beat * self.spb + len(phrase) / SR
            self.vocal_regions.append((start, end))
            self.events.append({"kind": "licensedVocalInsert", "label": insert["label"],
                                "sourceSeconds": insert["sourceSeconds"], "beat": beat,
                                "startSeconds": start, "endSeconds": end,
                                "pitchShiftSemitones": 0})
            # The cameo takes the foreground for a moment, then the original
            # riff resumes. Broad-band instrumental duck is local and smooth.
            dest_a, dest_b = round(start * SR), min(self.frames, round((end + .1) * SR))
            n = dest_b - dest_a
            curve = np.full(n, .62, np.float32)
            ramp = min(round(.06 * SR), n // 2)
            if ramp:
                curve[:ramp] = np.linspace(1, .62, ramp)
                curve[-ramp:] = np.linspace(.62, 1, ramp)
            for name in ["riff", "acid", "chords"]:
                self.buses[name][dest_a:dest_b] *= curve[:, None]

    def transitions(self):
        for end in [32, 128, 192]:
            length = 8 * self.spb
            t = np.arange(round(length * SR)) / SR
            n = filt(filt(self.rng.normal(0, 1, (len(t), 2)), 1600, "highpass"), 10500)
            envelope = np.linspace(0, 1, len(t)) ** 1.8
            gate = .55 + .45 * np.sin(np.pi * t / self.spb * 4) ** 4
            self.put("fx", fade(n * (envelope * gate)[:, None], .1, .045), end - 8, .055)
            t = np.arange(round(1.1 * SR)) / SR
            down = filt(self.rng.normal(0, 1, (len(t), 2)), 5200, "highpass")
            self.put("fx", fade(down * np.exp(-t * 6)[:, None], .003, .15), end, .06)
            # Last half beat breath; leave only the FX/reverb return.
            a, b = [round(v * self.spb * SR) for v in [end - .5, end - .02]]
            for name in ["drums", "bass", "riff", "acid", "chords"]:
                self.buses[name][a:b] *= np.linspace(1, 0, b - a)[:, None] ** 2
        for beat in [96, 224]:
            t = np.arange(round(.7 * SR)) / SR
            n = filt(self.rng.normal(0, 1, (len(t), 2)), 6500, "highpass")
            self.put("fx", fade(n * np.exp(-t * 8)[:, None], .002, .1), beat, .04)

    def rumble(self):
        """Kick-derived room, kept mono below 125 Hz before mix sidechain."""
        rumble_source = np.zeros((self.frames, 2), np.float32)
        for beat in self.kicks:
            a = round(beat * self.spb * SR)
            k = stereo(self.kick())
            b = min(a + len(k), self.frames)
            rumble_source[a:b] += k[:b - a] * .55
        wet = room(rumble_source, .65, .045, 145)
        wet = filt(filt(wet, 38, "highpass"), 125)
        return stereo(wet.mean(axis=1)) * .42

    def mix(self):
        self.buses["rumble"] = self.rumble()
        self.buses["fx"] += room(self.buses["riff"] + self.buses["acid"], .55, .022, 146) * .065
        self.buses["fx"] += room(self.buses["vocals"], .8, .032, 147) * .055
        for name, depth in [("bass", .61), ("rumble", .87), ("riff", .40), ("acid", .34), ("chords", .55), ("fx", .32)]:
            duck = np.ones(self.frames, np.float32)
            t = np.arange(round(.24 * SR)) / SR
            curve = 1 - depth * np.exp(-t / .063)
            for beat in self.kicks:
                a = round(beat * self.spb * SR)
                b = min(a + len(curve), self.frames)
                duck[a:b] = np.minimum(duck[a:b], curve[:b - a])
            self.buses[name] *= duck[:, None]
        mix = np.zeros((self.frames, 2), np.float32)
        stems = self.output / "stems"
        stems.mkdir(exist_ok=True)
        levels = {}
        for name, y in self.buses.items():
            if name in ["riff", "acid", "chords", "fx"]:
                y = filt(y, 170 if name != "fx" else 140, "highpass")
            y = fade(y, .012, 1.25)
            if not np.isfinite(y).all():
                raise ValueError(f"Invalid samples in {name}")
            self.buses[name] = y
            sf.write(stems / f"{name}.wav", y, SR, subtype="FLOAT")
            mix += y
            levels[name] = {"rms": float(np.sqrt(np.mean(y ** 2))), "peak": float(np.max(np.abs(y)))}
        mix = filt(mix, 28, "highpass")
        mix = compressor(mix, .67, 1.55, 1., .085)
        gain = .88 / max(.88, float(np.max(np.abs(mix))))
        sf.write(self.output / "premaster.wav", mix * gain, SR, subtype="PCM_24")
        # The audition includes a song cameo, a complete build and 8 bars of
        # original DJ material, so its balance reflects the declared style.
        a, b = [round(v * self.spb * SR) for v in [16, 64]]
        sf.write(self.output / "preview-premaster.wav", fade(mix[a:b] * gain, .025, .3), SR, subtype="PCM_24")
        regions = sorted(self.vocal_regions)
        merged = []
        for start, end in regions:
            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        vocal_duration = sum(b - a for a, b in merged)
        duration = self.frames / SR
        save_json(self.output / "arrangement.json", {
            "title": self.config["title"], "style": self.config["style"], "bpm": self.bpm,
            "key": self.config["key"], "bars": self.bars, "durationSeconds": duration,
            "composition": "New instrumental melody, bass, chords, drums, synthesis and arrangement. Only configured short vocal phrases are sampled.",
            "sections": [{**s, "startSeconds": s["startBar"] * 4 * self.spb,
                          "endSeconds": s["endBar"] * 4 * self.spb} for s in self.sections],
            "events": self.events, "busStats": levels, "premasterGain": gain,
            "vocalCoverage": {"directPhraseSeconds": vocal_duration, "percentOfFile": 100 * vocal_duration / duration,
                              "intervalsSeconds": merged, "includesEffectTails": False,
                              "note": "Duration is a compositional measurement, not a copyright exemption."},
            "source": self.config["sourceCredit"],
            "listeningReview": {"performed": False, "note": "Objective analysis and playback checks are not actual listening."}})
        print(f"Rendered {duration:.2f}s; direct singing {vocal_duration:.2f}s ({100 * vocal_duration / duration:.1f}%)", flush=True)

    def render(self):
        self.arrange_drums()
        self.arrange_music()
        self.arrange_vocals()
        self.transitions()
        self.mix()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["render", "master", "all"])
    parser.add_argument("--config", type=Path, default=Path("scripts/presets/night-transit.json"))
    parser.add_argument("--out", type=Path, default=Path("artifacts/audio/night-transit"))
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if args.command in ["render", "all"]:
        ClubDJ(config, args.out).render()
    if args.command in ["master", "all"]:
        results = [master_one(args.out / "premaster.wav", config["outputStem"], args.out, config["title"]),
                   master_one(args.out / "preview-premaster.wav", config["outputStem"] + "-preview", args.out, config["title"] + " / Preview")]
        source = Path(config["vocalSource"])
        save_json(args.out / "manifest.json", {
            "title": config["title"], "style": config["style"], "bpm": config["bpm"],
            "sourceCredit": config["sourceCredit"], "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "renders": results, "subjectiveListeningReview": "未进行人工耳听；客观测量与浏览器播放验证单独记录。"})
        for result in results:
            for f in result["files"]:
                print(f"{f['filename']}: {f['audioDurationSeconds']:.2f}s / {f['integratedLufs']} LUFS / {f['truePeakDbtp']} dBTP", flush=True)


if __name__ == "__main__":
    main()
