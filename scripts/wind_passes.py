#!/usr/bin/env python3
"""《风经过的地方 / Where the Wind Passes》 — an original melodic pop ballad.

Everything is written for this piece: form, harmony, melody, counterlines,
piano figuration, bass, drums and mix.  The score lives in
`scripts/presets/wind-passes.json`; this module adds sampling, synthesis,
arrangement, mixing and mastering.  Piano, strings, cello, flute and harp
come from the project's licensed sample banks; pad, choir, bells, bass and
percussion are synthesized here.

Run from the repository root:

    artifacts/dj-tools/bin/python scripts/wind_passes.py all

Outputs stay under artifacts/audio/wind-passes/ (ignored) and releases/wind-passes/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dj_remix import SR, fade, filt, read_audio, save_json  # noqa: E402
from flowers_glasshouse import compressor  # noqa: E402

SCORE_PATH = Path(__file__).resolve().parent / "presets" / "wind-passes.json"
SCORE = json.loads(SCORE_PATH.read_text(encoding="utf-8"))

BPM = SCORE["bpm"]
SPB = 60 / BPM
BARS = SCORE["bars"]
TAIL = SCORE.get("tailSeconds", 4.0)
FRAMES = round((BARS * 4 * SPB + TAIL) * SR)

TITLE = SCORE["title"]
SUBTITLE = SCORE["subtitle"]
ARTIST = SCORE["artist"]
STEM = SCORE.get("stem", "wind-passes")
ROOT = Path("releases/wind-passes")
WORK = Path("artifacts/audio/wind-passes")

rng = np.random.default_rng(261019)

# --------------------------------------------------------------------------
# Score — loaded from the reusable preset so the writing can be edited apart
# from the sampler and mix engine.
# --------------------------------------------------------------------------

SECTIONS = [(s["name"], s["startBar"], s["bars"], s["style"]) for s in SCORE["sections"]]
PROG = SCORE["progressions"]
CHORDS = SCORE["chords"]
MELODY = {style: [tuple(e) for e in events] for style, events in SCORE["melody"].items()}
for alias, source in SCORE.get("melodyAliases", {}).items():
    MELODY[alias] = MELODY[source]
INTRO_MELODY = [tuple(e) for e in SCORE["introMelody"]]
OUTRO_MELODY = [tuple(e) for e in SCORE["outroMelody"]]

# --------------------------------------------------------------------------
# Sound sources
# --------------------------------------------------------------------------

PIANO_BANK = {45: "A2", 48: "C3", 51: "Ds3", 54: "Fs3", 57: "A3", 60: "C4",
              63: "Ds4", 66: "Fs4", 69: "A4", 72: "C5", 75: "Ds5", 78: "Fs5", 81: "A5"}
VSCO = {
    "strings": {55: "strings-G3", 59: "strings-B3", 62: "strings-D4", 66: "strings-Fs4",
                69: "strings-A4", 72: "strings-C5", 76: "strings-E5"},
    "cello": {47: "cello-B2", 50: "cello-D3", 53: "cello-F3", 57: "cello-A3", 60: "cello-C4"},
    "flute": {60: "flute-C4", 64: "flute-E4", 69: "flute-A4", 72: "flute-C5", 76: "flute-E5", 81: "flute-A5"},
    "harp": {55: "harp-G3", 59: "harp-B3", 62: "harp-D4", 65: "harp-F4", 69: "harp-A4",
             72: "harp-C5", 76: "harp-E5"},
}
DRUM = Path("public/audio/teropa-drums")


def midi_hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def db(x):
    return 20 * math.log10(max(float(x), 1e-9))


def pan_gains(pan):
    p = max(-1.0, min(1.0, pan))
    return math.sqrt(max(0.0, 1 - p)), math.sqrt(max(0.0, 1 + p))


def rms(y):
    return float(np.sqrt(np.mean(np.square(y)) + 1e-12))


def read_mono(path):
    y = read_audio(path)[:, 0]
    return y.astype(np.float32)


class Bank:
    """One-shot sampler with per-family level matching and simple envelopes."""

    def __init__(self):
        self.cache: dict[str, np.ndarray] = {}

    def sample(self, path, level_db=-23.0):
        key = str(path)
        if key not in self.cache:
            y = read_mono(path)
            a = int(.15 * SR)
            b = min(len(y), int(1.7 * SR))
            seg = y[a:b] if b > a + SR // 10 else y
            self.cache[key] = (y * (10 ** (level_db / 20) / max(rms(seg), 1e-7))).astype(np.float32)
        return self.cache[key]

    def note(self, family, midi, beats, vel=.8, gain=1.0, attack=None, release=None,
             brightness=None, tail=None):
        bank = PIANO_BANK if family == "piano" else VSCO[family]
        pitch = min(bank, key=lambda p: abs(midi - p))
        root = Path("public/audio/salamander") if family == "piano" else Path("public/audio/vsco")
        y = self.sample(root / f"{bank[pitch]}.mp3")
        ratio = 2 ** ((midi - pitch) / 12)
        dur = max(.05, beats * SPB)
        if family == "piano":
            att, rel, extra = (.004, .22, .30) if attack is None else (attack, release, .30)
        elif family == "strings":
            att, rel, extra = (.20, .45, .35) if attack is None else (attack, release, .35)
        elif family == "cello":
            att, rel, extra = (.12, .35, .30) if attack is None else (attack, release, .30)
        elif family == "flute":
            att, rel, extra = (.055, .22, .22) if attack is None else (attack, release, .22)
        else:  # harp
            att, rel, extra = (.003, .60, .50) if attack is None else (attack, release, .50)
        if tail is not None:
            extra = tail
        n = round((dur + extra) * SR)
        pos = np.arange(n) * ratio
        out = np.interp(pos, np.arange(len(y)), y, right=0).astype(np.float32)
        # Natural register weight, gently reduced for the very top.
        out *= 10 ** ((np.clip(69 - midi, -8, 12) * .12) / 20)
        env = np.ones(n, np.float32)
        a = min(n, round(att * SR))
        if a:
            env[:a] = np.linspace(0, 1, a) ** .7
        r = min(n, round(rel * SR))
        if r:
            env[-r:] *= np.linspace(1, 0, r) ** 1.4
        # Gentle body/swell so a long sampled note does not sit completely flat.
        t = np.arange(n) / SR
        if family in ("strings", "cello", "flute"):
            env *= 1 + .045 * np.sin(2 * np.pi * .23 * t + midi)
        out *= env * (vel ** 1.55) * gain
        if brightness is not None and brightness > 0:
            out = filt(out, min(brightness, 12000))
        return out.astype(np.float32)


# --------------------------------------------------------------------------
# Synthesizers
# --------------------------------------------------------------------------

def synth_bass(note, beats, vel=.8):
    dur = beats * SPB
    t = np.arange(round((dur + .10) * SR)) / SR
    f = midi_hz(note)
    phase = 2 * np.pi * np.cumsum(f * (1 + .015 * np.exp(-t / .03))) / SR
    y = np.sin(phase) + .12 * np.sin(2 * phase) + .05 * np.sin(3 * phase)
    y += .10 * signal.sawtooth(phase * 1.003)
    env = (1 - np.exp(-t * 90)) * (0.55 + 0.45 * np.exp(-t * 1.6))
    env *= np.clip((dur + .10 - t) / .10, 0, 1)
    y = np.tanh(y * 1.15) * env
    return fade(filt(y, 520), .004, .05) * vel ** 1.2 * .34


def synth_pad(notes, beats, vel=.6, bright=1500):
    dur = beats * SPB
    t = np.arange(round((dur + .9) * SR)) / SR
    y = np.zeros((len(t), 2), np.float32)
    for i, n in enumerate(notes):
        f = midi_hz(n)
        for c, cents in enumerate([-5.5, 0, 5.5]):
            vib = 1 + .0015 * np.sin(2 * np.pi * (.17 + .03 * i) * t + i)
            phase = 2 * np.pi * f * 2 ** (cents / 1200) * t * vib
            y[:, c % 2] += (signal.sawtooth(phase + i * .7) * .20
                            + np.sin(phase) * .35) / len(notes)
    env = (1 - np.exp(-t * 1.6)) * np.clip((dur + .9 - t) / .9, 0, 1)
    y *= env[:, None] * vel * .30
    return filt(y, bright)


def synth_choir(notes, beats, vel=.5):
    dur = beats * SPB
    t = np.arange(round((dur + .7) * SR)) / SR
    y = np.zeros((len(t), 2), np.float32)
    for i, n in enumerate(notes):
        f = midi_hz(n)
        vib = 1 + .006 * np.sin(2 * np.pi * 4.6 * t + i * 1.7) * np.minimum(t / .8, 1)
        phase = 2 * np.pi * f * t * vib
        src = signal.sawtooth(phase) * .5 + np.sin(phase) * .5
        # Three fixed formants give a soft, wordless "ah".
        vowels = 0
        for fc, q, g in [(730, 6, 1.0), (1090, 7, .62), (2440, 9, .28)]:
            b, a = signal.iirpeak(fc, q, fs=SR)
            vowels = vowels + signal.lfilter(b, a, src) * g
        y[:, i % 2] += vowels * .62 / len(notes)
    env = (1 - np.exp(-t * 1.2)) * np.clip((dur + .7 - t) / .7, 0, 1)
    return fade(y * env[:, None] * vel, .02, .3).astype(np.float32)


def synth_bell(note, beats, vel=.5):
    t = np.arange(round((beats * SPB + 1.2) * SR)) / SR
    f = midi_hz(note)
    mod = 2.0 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 3.2)
    y = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.2)
    y += .25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 5.5)
    env = np.minimum(t / .002, 1) * np.clip((t[-1] - t) / .2, 0, 1)
    return fade(y * env * vel * .16, .001, .08)


def synth_brush(vel=.5):
    t = np.arange(round(.34 * SR)) / SR
    noise = rng.normal(0, 1, len(t))
    body = filt(filt(noise, 1800, "highpass"), 7200)
    low = filt(filt(noise, 500, "highpass"), 2400) * .55
    env = (1 - np.exp(-t / .018)) * np.exp(-t / .085)
    return fade((body * .8 + low) * env * vel * .20, .004, .04)


def synth_shaker(vel=.4):
    t = np.arange(round(.10 * SR)) / SR
    noise = filt(filt(rng.normal(0, 1, len(t)), 5200, "highpass"), 12500)
    env = (1 - np.exp(-t / .006)) * np.exp(-t / .028)
    return fade(noise * env * vel * .16, .002, .015)


def synth_soft_kick(vel=.8):
    t = np.arange(round(.34 * SR)) / SR
    f = 42 + 52 * np.exp(-t / .035)
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(phase) * np.exp(-t / .16)
    click = filt(rng.normal(0, 1, len(t)), 1800, "highpass") * np.exp(-t / .0032) * .12
    return fade((y + click) * vel * .32, .001, .05)


def load_drum(name):
    y = read_mono(DRUM / f"{name}.wav")
    peak = np.max(np.abs(y))
    return (y / max(peak, 1e-6)).astype(np.float32)


# --------------------------------------------------------------------------
# Reverb & mix helpers
# --------------------------------------------------------------------------

class Hall:
    """Small feedback-delay reverb: eight combs + four allpasses, decorrelated L/R."""

    def __init__(self):
        rng2 = np.random.default_rng(7)
        self.combs = [
            [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116],
            [1583, 1601, 1481, 1447, 1291, 1331, 1201, 1103],
        ]
        self.ap = [[556, 441, 341, 225], [547, 449, 337, 229]]
        self.jitter = [rng2.uniform(.94, 1.06, 8) for _ in range(2)]

    def comb(self, x, delay, feedback, damp=.30):
        n = len(x)
        y = np.zeros(n, np.float32)
        state = 0.0
        a = 1 - damp
        for s in range(0, n, delay):
            e = min(s + delay, n)
            prev = y[s - delay:e - delay] if s >= delay else np.zeros(e - s, np.float32)
            if s >= delay:
                prev, state = signal.lfilter([a], [1, -(1 - a)], prev, zi=[state])
                state = state[0]
            y[s:e] = x[s:e] + feedback * prev
        return y

    def allpass(self, x, delay, g=.5):
        n = len(x)
        y = np.zeros(n, np.float32)
        for s in range(0, n, delay):
            e = min(s + delay, n)
            prev_x = x[s - delay:e - delay] if s >= delay else np.zeros(e - s, np.float32)
            prev_y = y[s - delay:e - delay] if s >= delay else np.zeros(e - s, np.float32)
            y[s:e] = -g * x[s:e] + prev_x + g * prev_y
        return y

    def __call__(self, send, decay=2.4, predelay=.026, damp=.34):
        n = len(send) + round(3.0 * SR)
        x = np.zeros(n, np.float32)
        p = round(predelay * SR)
        x[p:p + len(send)] = send
        out = []
        for ch in range(2):
            acc = np.zeros(n, np.float32)
            base = max(1, int(decay * SR))
            for i, d0 in enumerate(self.combs[ch]):
                d = max(17, round(d0 * self.jitter[ch][i]))
                fb = 10 ** (-3 * d / base)
                acc += self.comb(x, d, fb, damp)
            acc /= len(self.combs[ch])
            for d in self.ap[ch]:
                acc = self.allpass(acc, d, .5)
            out.append(acc)
        y = np.column_stack(out).astype(np.float32)
        y = filt(filt(y, 180, "highpass"), 7800)
        return fade(y, .01, .4) / max(np.max(np.abs(y)), 1e-6) * .72


class Song:
    def __init__(self):
        self.frames = FRAMES
        self.buses = {name: np.zeros((self.frames, 2), np.float32) for name in [
            "piano", "lead", "strings", "cello", "flute", "harp", "bass",
            "pad", "choir", "bells", "drums", "fx"]}
        self.events = []
        self.bank = Bank()
        self.hat = load_drum("hatClosed")
        self.openhat = load_drum("hatOpen")

    def put(self, bus, y, beat, gain=1.0, pan=0.0):
        if y.ndim == 1:
            y = np.stack([y, y], 1)
        if y.shape[1] == 1:
            y = np.repeat(y, 2, 1)
        if pan:
            l, r = pan_gains(pan)
            y = y * np.array([l, r], np.float32)
        pos = round(beat * SPB * SR)
        if pos < 0:
            y = y[-pos:]
            pos = 0
        end = min(self.frames, pos + len(y))
        if end > pos:
            self.buses[bus][pos:end] += y[:end - pos] * np.float32(gain)

    def piano(self, bus, note, beat, beats, vel=.8, gain=1.0, pan=0.0):
        y = self.bank.note("piano", note, beats, vel, gain)
        self.put(bus, y, beat, 1.0, pan)
        self.events.append({"bus": bus, "midi": note, "beat": round(beat, 3), "beats": beats})

    def string_chord(self, notes, beat, beats, vel=.5, gain=1.0, spread=.03):
        for i, n in enumerate(notes):
            y = self.bank.note("strings", n, beats, vel * (1 - .04 * abs(i - len(notes) / 2)), gain)
            self.put("strings", y, beat + i * spread, .7, (i / max(1, len(notes) - 1) - .5) * .45)

    def cello_note(self, n, beat, beats, vel=.6, gain=1.0):
        y = self.bank.note("cello", n, beats, vel, gain)
        self.put("cello", y, beat, .8, -.12)

    def flute_note(self, n, beat, beats, vel=.7, gain=1.0):
        y = self.bank.note("flute", n, beats, vel, gain)
        self.put("flute", y, beat, .85, .08)

    def harp_note(self, n, beat, beats=.6, vel=.5, gain=1.0):
        y = self.bank.note("harp", n, beats, vel, gain)
        self.put("harp", y, beat, .9, .22)

    def drum(self, name, beat, gain=1.0, pan=0.0, vel=1.0, lowpass=None):
        src = {"hat": self.hat, "openhat": self.openhat}[name]
        y = src * gain * vel
        if lowpass:
            y = filt(y, lowpass)
        self.put("drums", fade(y, .001, .02), beat, 1.0, pan)


# --------------------------------------------------------------------------
# Arrangement
# --------------------------------------------------------------------------

def section_start_beats():
    return {name: bar * 4 for name, bar, bars, style in SECTIONS}


def bars_of(style):
    for name, bar, bars, st in SECTIONS:
        if st == style:
            yield bar, bars


def chord_at(style, bar_index):
    return CHORDS[PROG[style][bar_index % len(PROG[style])]]


def transpose(notes, amount):
    return [n + amount for n in notes]


def add_piano_accompaniment(song, style, start_bar, key=0, gain=1.0):
    """Broken-chord piano writing.  Left hand anchors harmony; right hand stays
    below the melodic register so the tune is never masked."""
    bars = dict((st, (b, n)) for _, b, n, st in SECTIONS)[style]
    total = bars[1]
    if style in ("intro", "outro"):
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            root = ch["piano"][0] + key
            song.piano("piano", ch["bass"] + 12 + key, b, 4.1, .40, .55)
            voicing = [n + key for n in ch["piano"]]
            pattern = [0, 2, 1, 3, 2, 1, 3, 2]
            for j, idx in enumerate(pattern):
                song.piano("piano", voicing[idx % len(voicing)] + (12 if idx > 0 else 0),
                           b + j * .5, .9, .30 + .03 * (j % 2), .55, -.18)
    elif style in ("verse", "verse2"):
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            voicing = [n + key for n in ch["piano"]]
            song.piano("piano", ch["bass"] + 12 + key, b, 2.2, .38, .55)
            song.piano("piano", ch["piano"][1] + key, b + 2, 1.8, .30, .45)
            pattern = [0, 2, 1, 3, 2, 3, 1, 2]
            for j, idx in enumerate(pattern):
                song.piano("piano", voicing[idx % len(voicing)] + (0 if idx < 2 else 0),
                           b + j * .5, .55, .27 + .02 * (j % 3), .38, -.22)
    elif style in ("pre", "pre2"):
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            voicing = [n + key for n in ch["piano"]]
            for j in range(4):
                song.piano("piano", ch["bass"] + 12 + key, b + j, .55, .30 + .03 * j, .50, -.18)
            for j, off in enumerate([.5, 1.5, 2.5, 3.5]):
                for k, idx in enumerate([0, 2, 3]):
                    song.piano("piano", voicing[idx] + 12, b + off + k * .02, .42,
                               .26 + .02 * j, .36, -.15 + .1 * k)
    elif style in ("chorus", "chorus2", "final"):
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            voicing = [n + key for n in ch["piano"]]
            song.piano("piano", ch["bass"] + 12 + key, b, 1.9, .48, .62)
            song.piano("piano", ch["bass"] + 24 + key, b, 1.9, .30, .40)
            song.piano("piano", ch["bass"] + 12 + key, b + 2, 1.9, .42, .58)
            pattern = [0, 2, 1, 3, 2, 3, 1, 2]
            for j, idx in enumerate(pattern):
                song.piano("piano", voicing[idx] + 12, b + j * .5, .62,
                           .31 + .04 * (j % 2), .46, -.24)
    elif style == "bridge":
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            voicing = [n + key for n in ch["piano"]]
            song.piano("piano", ch["bass"] + 12 + key, b, 3.9, .38, .55)
            for k, n in enumerate(voicing[1:]):
                song.piano("piano", n + 12, b + .04 * k, 3.8, .30, .42)
    elif style == "interlude":
        for i in range(total):
            ch = CHORDS[PROG[style][i]]
            b = (start_bar + i) * 4
            song.piano("piano", ch["bass"] + 12 + key, b, 3.8, .34, .5)
            for j, idx in enumerate([0, 2, 1, 3]):
                song.piano("piano", ch["piano"][idx % len(ch["piano"])] + 12 + key,
                           b + j * .5, 1.2, .28, .38, -.2)


def add_bass(song, style, start_bar, key=0, gain=1.0):
    total = dict((st, n) for _, b, n, st in SECTIONS)[style]
    for i in range(total):
        ch = CHORDS[PROG[style][i]]
        b = (start_bar + i) * 4
        root = ch["bass"] + key
        if style in ("intro", "outro"):
            song.put("bass", synth_bass(root, 3.8, .62 * gain), b, .8)
        elif style in ("verse", "verse2", "bridge"):
            song.put("bass", synth_bass(root, 1.6, .58 * gain), b, .85)
            song.put("bass", synth_bass(root, 1.2, .46 * gain), b + 2.5, .7)
        elif style in ("pre", "pre2"):
            for j in range(4):
                song.put("bass", synth_bass(root, .42, (.48 + .05 * j) * gain), b + j, .8)
        elif style in ("chorus", "chorus2", "final"):
            song.put("bass", synth_bass(root, 1.4, .66 * gain), b, .9)
            song.put("bass", synth_bass(root + 12, .45, .38 * gain), b + 1.5, .7)
            song.put("bass", synth_bass(root, 1.3, .58 * gain), b + 2, .85)
            song.put("bass", synth_bass(root, .42, .42 * gain), b + 3.5, .7)


def add_strings(song, style, start_bar, key=0, high=False):
    total = dict((st, n) for _, b, n, st in SECTIONS)[style]
    for i in range(total):
        ch = CHORDS[PROG[style][i]]
        b = (start_bar + i) * 4
        notes = transpose(ch["strings"], key)
        if high:
            notes = [n + 12 if n <= 66 else n for n in notes]
        vel = {"intro": .34, "verse": .30, "verse2": .38, "pre": .42, "pre2": .48,
               "chorus": .54, "chorus2": .58, "final": .68, "bridge": .34,
               "interlude": .34, "outro": .34}[style]
        beats = 4.0 if style not in ("final",) else 4.0
        if style == "bridge" and i < 4:
            continue
        song.string_chord(notes, b, beats, vel * (1.0 if i >= 2 else .9), .85)


def add_cello(song, style, start_bar, key=0):
    total = dict((st, n) for _, b, n, st in SECTIONS)[style]
    for i in range(total):
        ch = CHORDS[PROG[style][i]]
        b = (start_bar + i) * 4
        root = ch["bass"] + 12 + key
        if style in ("intro", "interlude", "outro"):
            if i % 2 == 0:
                song.cello_note(root, b, 3.8, .46)
        elif style == "verse":
            song.cello_note(root, b, 3.8, .46)
            if i % 2 == 1:
                song.cello_note(root + 7 if root + 7 <= 60 else root, b + 2, 1.8, .34)
        elif style == "verse2":
            # The second verse hands the cello the tune an octave below the piano.
            for off, n, d, v in MELODY["verse2"]:
                if b <= start_bar * 4 + off < b + 4 and n - 12 >= 47:
                    song.cello_note(n - 12, start_bar * 4 + off, d * .96, v * .62)
            if i % 4 == 0:
                song.cello_note(root, b, 3.6, .30)
        elif style in ("pre", "pre2"):
            song.cello_note(root, b, 1.8, .48)
            song.cello_note(root + (7 if i % 2 else 12) if root + 12 <= 60 else root,
                            b + 2, 1.7, .40)
        elif style == "bridge":
            # The cello sings the bridge melody an octave below the piano.
            if i >= 2:
                for off, n, d, v in MELODY["bridge"]:
                    if b <= (start_bar * 4 + off) < b + 4 and n - 12 >= 47:
                        song.cello_note(n - 12, start_bar * 4 + off, d * .95, v * .72)
        else:
            song.cello_note(root, b, 3.8, .50)
            if i % 2 == 1:
                song.cello_note(root + 7 if root + 7 <= 60 else root, b + 2.5, 1.3, .38)


def add_pad(song, style, start_bar, key=0):
    total = dict((st, n) for _, b, n, st in SECTIONS)[style]
    for i in range(total):
        ch = CHORDS[PROG[style][i]]
        b = (start_bar + i) * 4
        notes = transpose(ch["pad"], key)
        vel = {"intro": .46, "verse": .28, "verse2": .34, "pre": .40, "pre2": .46,
               "chorus": .48, "chorus2": .52, "final": .56, "bridge": .30,
               "interlude": .32, "outro": .34}[style]
        song.put("pad", synth_pad(notes, 4.05, vel, 1300 + 250 * (style in ("final",))),
                 b, .9)


def add_melody(song, style, start_bar, key=0, lead="piano", gain=1.0, phrase_offset=0.0):
    events = MELODY[style]
    for off, note, dur, vel in events:
        beat = start_bar * 4 + off + phrase_offset
        note += key
        if lead in ("piano", "both"):
            song.piano("lead", note, beat, dur, .78 * vel + .12, gain, .04)
        if lead in ("piano", "both") and style in ("chorus", "chorus2", "final"):
            song.flute_note(note, beat + .012, dur * .97, .62 * vel, .9 * gain)
        if lead == "flute":
            song.flute_note(note, beat, dur, vel, gain)


def add_harp_fill(song, beat, notes, direction="up", gain=.6):
    seq = notes if direction == "up" else list(reversed(notes))
    for i, n in enumerate(seq):
        song.harp_note(n, beat + i * .125, .8, .42, gain)


def add_drums(song, style, start_bar):
    total = dict((st, n) for _, b, n, st in SECTIONS)[style]
    for i in range(total):
        b = (start_bar + i) * 4
        last = i == total - 1
        if style in ("intro", "outro"):
            continue
        if style == "verse":
            if i >= 4:
                song.put("drums", synth_soft_kick(.30), b, .9)
                song.put("drums", synth_soft_kick(.26), b + 2, .85)
                song.put("drums", synth_shaker(.22), b + 1, .7, .3)
                song.put("drums", synth_shaker(.20), b + 3, .7, .3)
            if i >= 6:
                song.put("drums", synth_brush(.24), b + 2, .7, .1)
        elif style == "verse2":
            song.put("drums", synth_soft_kick(.26), b, .9)
            song.put("drums", synth_soft_kick(.22), b + 2, .85)
            for j in range(8):
                song.put("drums", synth_shaker(.18 + .02 * (j % 2)), b + j * .5, .55, .35)
            if i >= 2:
                song.put("drums", synth_brush(.26), b + 2, .6, .1)
        elif style in ("pre", "pre2"):
            song.put("drums", synth_soft_kick(.30), b, .9)
            song.put("drums", synth_soft_kick(.26), b + 2, .85)
            for j in range(8):
                sh = synth_shaker(.16 + .02 * (j % 2) + .06 * (i / total))
                song.put("drums", sh, b + j * .5, .55, .35)
            if i >= 2:
                song.put("drums", synth_brush(.28), b + 2, .7, .1)
            if i >= 4:
                song.put("drums", synth_brush(.22), b + 3.5, .5, -.1)
            if last:
                for j, n in enumerate([0, 1, 2, 3]):
                    song.put("drums", synth_brush(.20 + .06 * j), b + 2 + j * .5, .6, .1, )
        elif style in ("chorus", "chorus2", "final"):
            song.put("drums", synth_soft_kick(.58), b, .95)
            song.put("drums", synth_soft_kick(.46), b + 2, .9)
            if i % 4 == 3:
                song.put("drums", synth_soft_kick(.30), b + 3.5, .8)
            song.put("drums", synth_brush(.46), b + 1, .9, .05)
            song.put("drums", synth_brush(.50), b + 3, .95, .05)
            for j in range(8):
                song.put("drums", synth_shaker(.20 + .03 * (j % 2)), b + j * .5, .65, .42)
            if i % 2 == 1:
                song.put("drums", synth_soft_kick(.20), b + 1.5, .7)
                song.put("drums", synth_brush(.18), b + 3.5, .5, -.1)
            for j in (1.5, 3.5):
                song.drum("hat", b + j, .055, .25)
            if style == "final":
                song.put("drums", synth_soft_kick(.20), b + 3.5, .75)
                for j in [0, 1, 2, 3]:
                    song.put("drums", synth_shaker(.12 + .02 * j), b + j * .25, .4, .45)
                for j in (0.5, 1.5, 2.5, 3.5):
                    song.drum("openhat", b + j, .045, -.2)
        elif style == "bridge":
            if i >= 6:
                song.put("drums", synth_soft_kick(.26), b, .8)
                song.put("drums", synth_soft_kick(.22), b + 2, .7)
                song.put("drums", synth_brush(.24), b + 2, .55, .1)
            if i == 7:
                for j in range(4):
                    song.put("drums", synth_brush(.22 + .06 * j), b + j * .25, .5, .1 + .1 * j)


def add_choir(song, start_bar, key=0):
    for i in range(8):
        ch = CHORDS[PROG["final"][i]]
        b = (start_bar + i) * 4
        notes = transpose(ch["strings"], key)
        notes = [n + 12 if n <= 62 else n for n in notes]
        song.put("choir", synth_choir(notes, 4.05, .50), b, .9)
    for i in range(2):
        ch = CHORDS[PROG["outro"][i]]
        b = (start_bar + 8 + i) * 4
        song.put("choir", synth_choir(transpose(ch["strings"], key), 4.05, .30), b, .8)


def add_bells(song, start_bar, key=0):
    events = MELODY["final"]
    for off, note, dur, vel in events:
        if dur >= 1.2:
            shift = 12 if note + 12 + key <= 86 else 0
            song.put("bells", synth_bell(note + shift + key, min(dur, 2.0), .26 * vel),
                     start_bar * 4 + off, .8, .25)


def add_transitions(song):
    # Reverse-style swells into the first and second choruses, plus a low
    # tom/brush lift into the key change.
    for beat, length, gain in [(84, 4, .16), (188, 4, .20), (250, 4, .24)]:
        n = round(length * SPB * SR)
        t = np.arange(n) / SR
        noise = filt(filt(rng.normal(0, 1, n), 900, "highpass"), 6800)
        env = (t / max(t[-1], 1e-6)) ** 2.2
        song.put("fx", fade(noise * env * gain, .02, .12), beat, .8, .0)
    # Harp arpeggios marking the intro, interlude and the last chord.
    add_harp_fill(song, 22 * 4, [62, 66, 69, 74, 78], "up", .55)
    add_harp_fill(song, 30 * 4, [66, 69, 74, 78], "up", .42)
    add_harp_fill(song, 48 * 4, [62, 66, 69, 74, 78], "up", .5)
    add_harp_fill(song, 56 * 4, [59, 62, 66, 71], "down", .35)
    add_harp_fill(song, 64 * 4, [64, 68, 71, 76, 80], "up", .55)
    add_harp_fill(song, 76 * 4, [64, 68, 71, 76, 80, 83], "up", .55)


def compose():
    song = Song()
    starts = {style: bar for name, bar, bars, style in SECTIONS}

    # Intro
    add_piano_accompaniment(song, "intro", starts["intro"], 0, .95)
    add_strings(song, "intro", starts["intro"], 0)
    add_pad(song, "intro", starts["intro"], 0)
    for off, n, d, v in INTRO_MELODY:
        song.piano("lead", n, off, d, v, .9, .03)
    # A soft high answer at the end of the intro.
    song.flute_note(81, 21, 2.4, .28, .55)
    add_harp_fill(song, 18, [69, 74, 78, 81], "up", .32)

    # Verse 1
    add_piano_accompaniment(song, "verse", starts["verse"], 0, 1.0)
    add_melody(song, "verse", starts["verse"], 0, "piano", 1.0)
    add_bass(song, "verse", starts["verse"], 0, .85)
    add_pad(song, "verse", starts["verse"], 0)
    add_strings(song, "verse", starts["verse"], 0)
    add_cello(song, "verse", starts["verse"], 0)
    add_drums(song, "verse", starts["verse"])

    # Pre 1
    add_piano_accompaniment(song, "pre", starts["pre"], 0, 1.0)
    add_melody(song, "pre", starts["pre"], 0, "piano", 1.0)
    add_bass(song, "pre", starts["pre"], 0, .9)
    add_pad(song, "pre", starts["pre"], 0)
    add_strings(song, "pre", starts["pre"], 0)
    add_cello(song, "pre", starts["pre"], 0)
    add_drums(song, "pre", starts["pre"])

    # Chorus 1
    add_piano_accompaniment(song, "chorus", starts["chorus"], 0, 1.05)
    add_melody(song, "chorus", starts["chorus"], 0, "both", 1.1)
    add_bass(song, "chorus", starts["chorus"], 0, 1.0)
    add_pad(song, "chorus", starts["chorus"], 0)
    add_strings(song, "chorus", starts["chorus"], 0)
    add_cello(song, "chorus", starts["chorus"], 0)
    add_drums(song, "chorus", starts["chorus"])
    for off, n, d, v in MELODY["chorus"]:
        if d >= 1.0:
            song.piano("lead", n + 12, starts["chorus"] * 4 + off + .012, d * .98,
                       .24 * v, .30, .06)

    # Interlude
    add_piano_accompaniment(song, "interlude", starts["interlude"], 0, .9)
    add_strings(song, "interlude", starts["interlude"], 0)
    add_cello(song, "interlude", starts["interlude"], 0)
    add_pad(song, "interlude", starts["interlude"], 0)
    add_bass(song, "interlude", starts["interlude"], 0, .5)
    for i in range(2):
        ch = CHORDS[PROG["interlude"][i]]
        song.put("bass", synth_bass(ch["bass"], 3.6, .40), (starts["interlude"] + i) * 4, .7)
    for off, n in [(0, 69), (1.5, 71), (3, 74), (4.5, 73), (6, 71)]:
        song.flute_note(n, starts["interlude"] * 4 + off, 1.3, .30, .85)
    add_harp_fill(song, starts["interlude"] * 4 + 4, [62, 66, 69, 74], "up", .32)

    # Verse 2
    add_piano_accompaniment(song, "verse2", starts["verse2"], 0, 1.0)
    add_melody(song, "verse2", starts["verse2"], 0, "piano", 1.0)
    add_bass(song, "verse2", starts["verse2"], 0, .9)
    add_pad(song, "verse2", starts["verse2"], 0)
    add_strings(song, "verse2", starts["verse2"], 0)
    add_cello(song, "verse2", starts["verse2"], 0)
    add_drums(song, "verse2", starts["verse2"])
    # A flute answer at the end of the second verse.
    song.flute_note(69, starts["verse2"] * 4 + 28, 1.4, .42, .6)
    song.flute_note(71, starts["verse2"] * 4 + 29.5, 1.0, .4, .6)
    song.flute_note(73, starts["verse2"] * 4 + 30.5, 1.5, .44, .6)

    # Pre 2
    add_piano_accompaniment(song, "pre2", starts["pre2"], 0, 1.0)
    add_melody(song, "pre2", starts["pre2"], 0, "piano", 1.0)
    add_bass(song, "pre2", starts["pre2"], 0, .95)
    add_pad(song, "pre2", starts["pre2"], 0)
    add_strings(song, "pre2", starts["pre2"], 0)
    add_cello(song, "pre2", starts["pre2"], 0)
    add_drums(song, "pre2", starts["pre2"])

    # Chorus 2
    add_piano_accompaniment(song, "chorus2", starts["chorus2"], 0, 1.05)
    add_melody(song, "chorus2", starts["chorus2"], 0, "both", 1.15)
    add_bass(song, "chorus2", starts["chorus2"], 0, 1.0)
    add_pad(song, "chorus2", starts["chorus2"], 0)
    add_strings(song, "chorus2", starts["chorus2"], 0, high=True)
    add_cello(song, "chorus2", starts["chorus2"], 0)
    add_drums(song, "chorus2", starts["chorus2"])
    for i in range(8):
        ch = CHORDS[PROG["chorus2"][i]]
        song.put("choir", synth_choir([n + 12 for n in ch["strings"]], 4.05, .30),
                 (starts["chorus2"] + i) * 4, .8)
    # Piano octave doubling for the second chorus lift.
    for off, n, d, v in MELODY["chorus2"]:
        if d >= 1.0:
            song.piano("lead", n + 12, starts["chorus2"] * 4 + off + .012, d * .98,
                       .30 * v, .35, .06)

    # Bridge
    add_piano_accompaniment(song, "bridge", starts["bridge"], 0, 1.0)
    add_melody(song, "bridge", starts["bridge"], 0, "piano", .95)
    add_bass(song, "bridge", starts["bridge"], 0, .6)
    add_pad(song, "bridge", starts["bridge"], 0)
    add_cello(song, "bridge", starts["bridge"], 0)
    add_drums(song, "bridge", starts["bridge"])
    add_strings(song, "bridge", starts["bridge"], 0)
    # Flute joins the last two bars of the bridge.
    for off, n, d, v in MELODY["bridge"]:
        if off >= 28:
            song.flute_note(n, starts["bridge"] * 4 + off, d, v * .65, .8)

    # Final chorus, up a whole step.
    add_piano_accompaniment(song, "final", starts["final"], 0, 1.05)
    add_melody(song, "final", starts["final"], 2, "both", 1.2)
    add_bass(song, "final", starts["final"], 0, 1.0)
    add_pad(song, "final", starts["final"], 0)
    add_strings(song, "final", starts["final"], 0, high=True)
    add_cello(song, "final", starts["final"], 0)
    add_drums(song, "final", starts["final"])
    add_choir(song, starts["final"], 0)
    add_bells(song, starts["final"], 2)
    # Sub-octave weight and a bright cymbal-ish wash at the key change.
    for bar in range(8):
        root = CHORDS[PROG["final"][bar]]["bass"]
        low = root - 12
        if low >= 28:
            song.put("bass", synth_bass(low, 3.4, .34), (starts["final"] + bar) * 4, .55)
    for bar in (0, 4):
        n = round(2.6 * SR)
        t = np.arange(n) / SR
        wash = filt(filt(rng.normal(0, 1, n), 3800, "highpass"), 14500)
        env = (1 - np.exp(-t / .012)) * np.exp(-t / .5)
        song.put("fx", wash * env * .10, (starts["final"] + bar) * 4, .9, .3)

    # Descant: the flute holds a third/sixth above the last long notes.
    for bar, note in [(0, 78), (1, 76), (2, 78), (3, 75), (4, 80), (5, 78), (6, 78), (7, 76)]:
        if bar in (0, 2, 4, 6):
            song.flute_note(note, (starts["final"] + bar) * 4, 3.8, .34, .55)
    # Piano octave doubling on the final chorus melody.
    for off, n, d, v in MELODY["final"]:
        if d >= 1.0:
            song.piano("lead", n + 12, starts["final"] * 4 + off + .012, d * .98,
                       .28 * v, .32, .06)

    # Outro
    add_piano_accompaniment(song, "outro", starts["outro"], 0, .9)
    for off, n, d, v in OUTRO_MELODY:
        song.piano("lead", n, starts["outro"] * 4 + off, d, v, .85, .03)
    add_bass(song, "outro", starts["outro"], 0, .55)
    add_strings(song, "outro", starts["outro"], 0)
    add_pad(song, "outro", starts["outro"], 0)
    add_cello(song, "outro", starts["outro"], 0)
    # Final sustained E(add9) with a high flute and harp.
    end = starts["outro"] * 4 + 24
    song.put("pad", synth_pad([52, 56, 59, 64, 66], 8, .5, 1500), end, .9)
    song.string_chord([56, 59, 64, 66], end, 8, .4, .9)
    song.cello_note(40, end, 8, .42)
    song.put("bass", synth_bass(40, 7.5, .5), end, .8)
    song.flute_note(76, end + .1, 5.5, .32, .6)
    song.flute_note(81, end + 1.2, 4.0, .22, .45)
    add_harp_fill(song, end, [52, 56, 59, 64, 66, 71, 76], "up", .5)
    for off, n in [(0, 76), (1.5, 71), (3, 68)]:
        song.piano("lead", n, end + off, 2.0, .34, .8, .03)

    add_transitions(song)

    return song


# --------------------------------------------------------------------------
# Mix
# --------------------------------------------------------------------------

def apply_fades(song):
    for name, y in song.buses.items():
        f = min(round(.008 * SR), len(y))
        if f:
            y[:f] *= np.linspace(0, 1, f)[:, None]
    # fade the very end
    for name, y in song.buses.items():
        n = round(3.2 * SR)
        y[-n:] *= np.linspace(1, 0, n)[:, None] ** 1.5


def mix(song, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    b = song.buses
    # Stem treatment before the bus faders.
    piano = filt(filt(b["piano"], 55, "highpass"), 9500)
    lead = filt(filt(b["lead"], 75, "highpass"), 12000)
    strings = filt(filt(b["strings"], 70, "highpass"), 6200)
    cello = filt(filt(b["cello"], 55, "highpass"), 4800)
    flute = filt(filt(b["flute"], 180, "highpass"), 10500)
    harp = filt(filt(b["harp"], 130, "highpass"), 9000)
    bass = filt(b["bass"], 34, "highpass")
    pad = filt(filt(b["pad"], 90, "highpass"), 4200)
    choir = filt(filt(b["choir"], 150, "highpass"), 7500)
    bells = filt(b["bells"], 250, "highpass")
    drums = b["drums"]
    fx = filt(b["fx"], 250, "highpass")

    # Sends (mono sums) to one hall.  The reverb returns wider than the dry bus.
    send = (piano.mean(1) * .20 + lead.mean(1) * .26 + strings.mean(1) * .34
            + cello.mean(1) * .26 + flute.mean(1) * .30 + harp.mean(1) * .34
            + pad.mean(1) * .30 + choir.mean(1) * .38 + bells.mean(1) * .30
            + drums.mean(1) * .10 + fx.mean(1) * .20)
    verb = Hall()(send, decay=2.2, predelay=.030, damp=.38)[:song.frames]

    # Ping-pong-ish delay for the lead, only in the big sections.
    delay = np.zeros_like(lead)
    d = round(.75 * SPB * SR)  # dotted eighth
    tap = filt(lead.mean(1), 2400) * .30
    for k in range(1, 4):
        shifted = np.zeros_like(tap)
        shifted[d * k:] = tap[:-d * k] * (.55 ** (k - 1))
        delay[:, 0] += shifted * (1.0 if k % 2 else .55)
        delay[:, 1] += shifted * (.55 if k % 2 else 1.0)
    delay = filt(delay, 4500)

    buses = {
        "piano": (piano, 1.08, -.14),
        "lead": (lead, .90, .03),
        "strings": (strings, 1.00, -.30),
        "cello": (cello, .72, .18),
        "flute": (flute, 1.55, .12),
        "harp": (harp, 1.05, .26),
        "bass": (bass, .70, 0),
        "pad": (pad, .50, 0),
        "choir": (choir, 1.00, .1),
        "bells": (bells, .75, .3),
        "drums": (drums, .88, 0),
        "fx": (fx, .40, 0),
        "delay": (delay, .36, 0),
    }
    mixbus = np.zeros((song.frames, 2), np.float32)
    for name, (y, g, pan) in buses.items():
        l, r = pan_gains(pan)
        mixbus += y * np.array([l, r], np.float32) * g
    mixbus += verb * .42

    # Gentle glue compression and a broad final tone.
    mixbus = compressor(mixbus, .30, 1.65, 1.0, .16)
    mixbus = tonal(mixbus)
    mixbus = fade(mixbus, .02, .05)
    nf = round(.85 * SR)
    mixbus[:nf] *= (np.linspace(0, 1, nf) ** 1.6)[:, None]
    peak = np.max(np.abs(mixbus))
    mixbus *= .89 / max(peak, 1e-6)

    sf.write(out_dir / "premaster.wav", mixbus, SR, subtype="PCM_24")
    # Stems for QA.
    stems = out_dir / "stems"
    stems.mkdir(exist_ok=True)
    for name, (y, g, pan) in buses.items():
        sf.write(stems / f"{name}.wav", y * g, SR, subtype="PCM_24")
    sf.write(stems / "reverb.wav", verb * .55, SR, subtype="PCM_24")
    return mixbus


def tonal(y):
    # Low shelf +1.0 dB, gentle 300 Hz dip, 3.2 kHz presence, 12 kHz air.
    y = shelf(y, 90, 1.2, "low", 0.7)
    y = peaking(y, 330, -1.8, 1.0)
    y = peaking(y, 3500, 1.8, 0.8)
    y = shelf(y, 9500, 2.6, "high", 0.7)
    return y


def shelf(y, f, gain_db, kind="high", q=0.7):
    A = 10 ** (gain_db / 40)
    w0 = 2 * math.pi * f / SR
    alpha = math.sin(w0) / (2 * q)
    cw = math.cos(w0)
    if kind == "low":
        b0 = A * ((A + 1) - (A - 1) * cw + 2 * math.sqrt(A) * alpha)
        b1 = 2 * A * ((A - 1) - (A + 1) * cw)
        b2 = A * ((A + 1) - (A - 1) * cw - 2 * math.sqrt(A) * alpha)
        a0 = (A + 1) + (A - 1) * cw + 2 * math.sqrt(A) * alpha
        a1 = -2 * ((A - 1) + (A + 1) * cw)
        a2 = (A + 1) + (A - 1) * cw - 2 * math.sqrt(A) * alpha
    else:
        b0 = A * ((A + 1) + (A - 1) * cw + 2 * math.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - 2 * math.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * cw + 2 * math.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - 2 * math.sqrt(A) * alpha
    b = np.array([b0, b1, b2]) / a0
    a = np.array([1, a1 / a0, a2 / a0])
    return signal.lfilter(b, a, y).astype(np.float32)


def peaking(y, f, gain_db, q=1.0):
    A = 10 ** (gain_db / 40)
    w0 = 2 * math.pi * f / SR
    alpha = math.sin(w0) / (2 * q)
    cw = math.cos(w0)
    b = np.array([1 + alpha * A, -2 * cw, 1 - alpha * A])
    a = np.array([1 + alpha / A, -2 * cw, 1 - alpha / A])
    return signal.lfilter(b / a[0], a / a[0], y).astype(np.float32)


# --------------------------------------------------------------------------
# Rendering & mastering
# --------------------------------------------------------------------------

def run(args, **kw):
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True, **kw)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result


def measure(path):
    result = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                  "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"])
    blocks = re.findall(r'\{\s*"input_i"[\s\S]*?\}', result.stderr)
    if not blocks:
        raise RuntimeError("No loudness measurement returned")
    raw = json.loads(blocks[-1])
    if not all(math.isfinite(float(raw[k])) for k in ["input_i", "input_tp", "input_lra"]):
        raise ValueError("Invalid/silent audio")
    return raw


def first_measure(path):
    r = measure(path)
    return {k: float(r[k]) for k in
            ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}


def master(premaster: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    before = first_measure(premaster)
    filtstr = ("loudnorm=I=-14:TP=-1.7:LRA=9:"
               f"measured_I={before['input_i']}:measured_TP={before['input_tp']}:"
               f"measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:"
               f"offset={before['target_offset']}:linear=true:print_format=json")
    wav = out / f"{STEM}.wav"
    mp3 = out / f"{STEM}.mp3"
    run(["ffmpeg", "-v", "error", "-y", "-i", premaster, "-af", filtstr,
         "-ar", SR, "-c:a", "pcm_s24le", wav])
    # Guarantee a true-peak ceiling even if the linear normalization overshoots.
    peak = first_measure(wav)["input_tp"]
    if peak > -1.9:
        safe = out / "tmp-safe.wav"
        run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", f"volume={(-1.95 - peak):.6f}dB",
             "-c:a", "pcm_s24le", safe])
        safe.replace(wav)
    for _ in range(3):
        run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "320k",
             "-metadata", f"title={TITLE}", "-metadata", f"artist={ARTIST}",
             "-metadata", f"album={SUBTITLE}", "-write_xing", "1", mp3])
        if first_measure(mp3)["input_tp"] <= -1.4:
            break
        peak = first_measure(wav)["input_tp"]
        safe = out / "tmp-safe.wav"
        run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", f"volume={(-1.95 - peak):.6f}dB",
             "-c:a", "pcm_s24le", safe])
        safe.replace(wav)
    files = []
    for path in (wav, mp3):
        m = first_measure(path)
        pcm = read_audio(path)
        files.append({
            "filename": path.name, "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "audioDurationSeconds": round(len(pcm) / SR, 3), "sampleRate": SR, "channels": 2,
            "integratedLufs": m["input_i"], "truePeakDbtp": m["input_tp"],
            "loudnessRangeLu": m["input_lra"],
            "clippedSamples": int(np.count_nonzero(np.abs(pcm) >= 1)),
            "finite": bool(np.isfinite(pcm).all()),
            "stereoCorrelation": float(np.corrcoef(pcm.T)[0, 1]),
        })
        if files[-1]["clippedSamples"] or files[-1]["truePeakDbtp"] > -1.3:
            raise ValueError(f"Final-file peak check failed: {path}")
    return before, files


def section_report(premaster):
    pcm = read_audio(premaster)
    rows = []
    for name, bar, bars, style in SECTIONS:
        a, b = round(bar * 4 * SPB * SR), round((bar + bars) * 4 * SPB * SR)
        seg = pcm[a:min(b, len(pcm))]
        rows.append({"name": name, "style": style, "startSeconds": round(a / SR, 2),
                     "endSeconds": round(b / SR, 2), "rmsDbfs": round(db(rms(seg)), 2),
                     "peakDbfs": round(db(np.max(np.abs(seg))), 2)})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["render", "master", "all"], nargs="?", default="all")
    ap.add_argument("--out", default=str(WORK))
    args = ap.parse_args()
    work = Path(args.out)
    work.mkdir(parents=True, exist_ok=True)

    if args.command in ("render", "all"):
        print("composing…", flush=True)
        song = compose()
        apply_fades(song)
        print(f"mixing {FRAMES / SR:.1f}s…", flush=True)
        mix(song, work)
        save_json(work / "arrangement.json", {
            "title": TITLE, "subtitle": SUBTITLE, "artist": ARTIST,
            "bpm": BPM, "key": "D major → E major (final chorus)", "bars": BARS,
            "sections": [{"name": n, "style": s, "startBar": b, "bars": k,
                          "startSeconds": round(b * 4 * SPB, 2),
                          "endSeconds": round((b + k) * 4 * SPB, 2)}
                         for n, b, k, s in SECTIONS],
            "melodyReview": {"performed": False, "note": "客观渲染与测量；未进行人工耳听。"},
            "events": song.events[:2000],
        })
        print("rendered", work / "premaster.wav", flush=True)

    if args.command in ("master", "all"):
        print("mastering…", flush=True)
        before, files = master(work / "premaster.wav", ROOT)
        report = section_report(work / "premaster.wav")
        save_json(ROOT / "manifest.json", {
            "track": STEM, "title": TITLE, "subtitle": SUBTITLE, "artist": ARTIST,
            "bpm": BPM, "key": "D major → E major", "bars": BARS,
            "engine": "Python/numpy sampler + additive arrangement, FFmpeg loudnorm",
            "target": {"integratedLufs": -14, "truePeakDbtp": -1.5},
            "before": before, "files": files, "sections": report,
            "listeningReview": "未进行人工耳听；仅完成客观测量与结构核对。",
        })
        for f in files:
            print(f"{f['filename']}: {f['audioDurationSeconds']:.2f}s, "
                  f"{f['integratedLufs']} LUFS, {f['truePeakDbtp']} dBTP, "
                  f"corr {f['stereoCorrelation']:.2f}")
        for row in report:
            print(f"  {row['name']}: {row['rmsDbfs']:6.1f} dBFS RMS")


if __name__ == "__main__":
    main()
