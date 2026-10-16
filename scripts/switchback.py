#!/usr/bin/env python3
"""Switchback: original DJ tool with newly synthesized, transformed speech.

Reuse the club synthesis/mix utilities, with a new 80-bar arrangement, motif,
voice processing and middle-section audition. Input dry speech stays local.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy import signal
import soundfile as sf

from club_dj import ClubDJ
from dj_remix import SR, fade, filt, master_one, read_audio, run, save_json, stereo
from flowers_glasshouse import compressor, room


def pitch_tempo(y, semitones, speed, directory):
    """Resample the voice/formants, then independently set its delivery speed.

    Both operations act on samples. Save the pre-EQ result for independent QA;
    changing event metadata alone cannot produce a passing audio measurement.
    """
    if not -12 <= semitones <= 12 or not .5 <= speed <= 2:
        raise ValueError("Voice pitch/speed is outside this project's range")
    rate = round(SR * 2 ** (semitones / 12))
    ratio = rate / SR
    key = hashlib.sha256(y.tobytes() + f"{rate}/{speed:.12f}".encode()).hexdigest()[:16]
    output = directory / f"pitch-tempo-{key}.wav"
    if not output.exists():
        source = directory / f"dry-{key}.wav"
        sf.write(source, y, SR, subtype="FLOAT")
        run(["ffmpeg", "-v", "error", "-y", "-i", source, "-af",
             f"asetrate={rate},aresample={SR},atempo={speed / ratio:.12f}",
             "-ar", SR, "-c:a", "pcm_f32le", output])
        source.unlink()
    return sf.read(output, dtype="float32", always_2d=True)[0], output


def tape_stop(y, seconds, end_rate=.10):
    """Continuous varispeed slowdown, with no segment joins or repeated grains."""
    n = round(seconds * SR)
    u = np.linspace(0, 1, n)
    # Choose the starting rate so the complete input fits the slowdown curve.
    shape = (1 - u) ** 1.45
    start_rate = (len(y) / n - end_rate) / shape.mean() + end_rate
    rates = end_rate + (start_rate - end_rate) * shape
    positions = np.cumsum(rates) - rates[0]
    result = np.column_stack([np.interp(positions, np.arange(len(y)), y[:, c], right=0)
                              for c in range(2)]).astype(np.float32)
    return fade(result, .012, .045), float(start_rate)


class Switchback(ClubDJ):
    def __init__(self, config, output):
        super().__init__(config, output)
        self.buses["vocal_fx"] = np.zeros((self.frames, 2), np.float32)
        self.voice_assets = []
        self.voice_dry = {}
        self.voice_text = {}

    @lru_cache(maxsize=8)
    def kick(self, soft=False):
        t = np.arange(round(.39 * SR)) / SR
        phase = 2 * np.pi * (47 * t + 104 * .020 * (1 - np.exp(-t / .020)))
        env = (1 - np.exp(-t * 3500)) * np.exp(-t * 14)
        body = np.sin(phase) * env
        beater = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 100) * .18
        click = filt(self.rng.normal(0, 1, len(t)), 3600, "highpass") * np.exp(-t * 650) * .07
        return fade((np.tanh((body + beater) * 1.8) / 1.65 + click).astype(np.float32),
                    .0006, .018) * (.78 if soft else 1)

    @lru_cache(maxsize=200)
    def riff(self, midi, beats, mode=0):
        t = np.arange(round((beats * self.spb + .095) * SR)) / SR
        f = self.frequency(midi)
        y = np.zeros((len(t), 2), np.float32)
        for channel, cents in enumerate([-4, 4]):
            phase = 2 * np.pi * f * 2 ** (cents / 1200) * t
            # Odd harmonics and a decaying FM attack give a hollow, percussive call.
            pulse = sum(np.sin(phase * h) / h ** 1.35 for h in [1, 3, 5, 7, 9])
            fm = np.sin(phase + (1.3 + mode * .9) * np.exp(-t * 16) * np.sin(phase * 2))
            y[:, channel] = np.tanh((pulse * .60 + fm * .55) * 1.6)
        env = (1 - np.exp(-t * 1100)) * np.exp(-t * (13 if mode else 10))
        env *= np.clip((t[-1] - t) / .055, 0, 1)
        return fade(filt(filt(y * env[:, None] * .21, 4600 + mode * 1500),
                         230, "highpass"), .002, .035)

    @lru_cache(maxsize=16)
    def tom(self, midi=48):
        t = np.arange(round(.22 * SR)) / SR
        f = self.frequency(midi)
        phase = 2 * np.pi * (f * t + f * .35 * .018 * (1 - np.exp(-t / .018)))
        y = np.sin(phase) * np.exp(-t * 24) + .15 * np.sin(phase * 2.7) * np.exp(-t * 50)
        return fade(y * .25, .001, .03)

    def arrange_drums(self):
        for bar in range(self.bars):
            b = bar * 4
            active = 8 <= bar < 32 or 40 <= bar < 72
            build = 4 <= bar < 8 or 36 <= bar < 40
            air = 32 <= bar < 36
            outro = bar >= 72
            if air:
                if bar in [33, 35]:
                    self.put("drums", self.metal("rim"), b + 3.5, .16, .3)
                continue
            kicks = [0, 1, 2, 3] if bar < 78 else []
            if bar in [7, 31, 39, 55, 63, 71]:
                kicks = [0, 1, 2]
            for p in kicks:
                self.put("drums", self.kick(), b + p, .68 if active else .52)
                self.kicks.append(b + p)
                self.events.append({"kind": "kick", "beat": b + p})
            if bar < 2 or bar >= 78:
                continue
            if active or build or 72 <= bar < 76:
                for p in [1, 3]:
                    if p == 3 and bar in [7, 31, 39, 55, 63, 71]:
                        continue
                    self.put("drums", self.clap(), b + p + .01, .55 if active else .29)
            for p in np.arange(0, 4, .5):
                level = .23 if p % 1 else .10
                self.put("drums", self.metal("closed"), b + p + (.014 if p % 1 else 0),
                         level * self.rng.uniform(.90, 1.05), -.22)
            if active or 72 <= bar < 76:
                for p in [.5, 1.5, 2.5, 3.5]:
                    self.put("drums", self.metal("open"), b + p, .28 if bar >= 40 else .22, .25)
                for step in [1, 3, 6, 7, 9, 11, 14, 15]:
                    p = step / 4 + (.035 if step % 2 else 0)
                    self.put("drums", self.metal("shaker"), b + p,
                             .15 if step % 4 == 3 else .09, -.45 if step % 2 else .45)
                if bar >= 24 and bar < 72:
                    for p in ([.75, 2.25, 3.5] if bar % 2 else [1.25, 2.75]):
                        self.put("drums", self.metal("rim"), b + p, .18, .35)
                if bar >= 56:
                    for p in [.5, 1.5, 2.5, 3.5]:
                        self.put("drums", self.metal("ride"), b + p, .075, -.20)
            if build:
                local = bar % 4
                for p in np.arange(0, 3.4 if local == 3 else 4, [1, .5, .5, .25][local]):
                    self.put("drums", self.clap(), b + p, .13 + .035 * local)
            if active and bar % 8 == 7:
                for i, p in enumerate([3.125, 3.375, 3.625]):
                    self.put("drums", self.tom([53, 51, 48][i]), b + p, .7, -.4 + .4 * i)

    def arrange_music(self):
        voicings = [(65, 68, 72, 79), (68, 72, 75, 82), (61, 65, 68, 75), (63, 67, 70, 77)]
        for bar in range(self.bars):
            b = bar * 4
            active = 8 <= bar < 32 or 40 <= bar < 72
            second = 40 <= bar < 72
            root = self.roots[bar % 8]
            notes = voicings[0 if bar % 8 < 3 else 1 if bar % 8 == 3 else 0 if bar % 8 < 6 else bar % 8 - 4]
            if active:
                bass = [(.5, .27, 0), (1.25, .16, 12), (1.75, .19, 0),
                        (2.5, .29, 0), (3.25, .16, 7), (3.75, .16, 12)]
                if second:
                    bass = [(.25, .17, 0), (.75, .17, 12), (1.5, .30, 0),
                            (2.25, .18, 7), (2.75, .18, 0), (3.5, .27, 12)]
                for p, dur, interval in bass:
                    if bar in [31, 55, 63, 71] and p >= 3:
                        continue
                    self.put("bass", self.bass(root + interval, dur, int(second)), b + p, .98)
                for p, note, dur in self.hook[bar % 2]:
                    if bar in [31, 55, 63, 71] and p >= 3:
                        continue
                    if bar % 8 == 6:
                        note = {65: 61, 68: 65, 63: 60, 72: 68, 60: 56}[note]
                    elif bar % 8 == 7:
                        note = {65: 63, 68: 67, 63: 61, 72: 70, 60: 58}[note]
                    if second and bar < 64:
                        note -= 12
                    y = self.riff(note, dur, int(second))
                    self.put("riff", y, b + p, 1.45 if second and bar < 64 else 1.0)
                    self.echo("fx", y, b + p, .042, .75, 2)
                    self.events.append({"kind": "originalRiff", "beat": b + p, "midi": note,
                                        "durationBeats": dur, "variant": "low" if second and bar < 64 else "upper"})
                    if bar >= 64 and p in [0, 1.75, 2.75]:
                        self.put("riff", self.riff(note + 12, dur), b + p, .22)
                if bar >= 24 and bar % 4 == 3:
                    response = [77, 80, 84, 79] if not second else [65, 68, 72, 75]
                    for p, note in zip([2.5, 2.875, 3.25, 3.625], response):
                        y = self.acid(note, .17, int(second))
                        self.put("acid", y, b + p, .31 if not second else .40, -.18)
                        self.echo("fx", y, b + p, .055, .75, 2)
                if bar % 4 == 0:
                    self.put("chords", self.chord(notes, 7, True), b, .048)
            elif bar < 8 or 36 <= bar < 40:
                local = bar % 4
                for p, note, dur in self.hook[bar % 2][:3 if bar < 4 else 5]:
                    self.put("riff", filt(self.riff(note, dur), 900 + 700 * local), b + p,
                             .18 + .04 * local if bar < 4 else .28 + .055 * local)
                if bar % 2 == 0:
                    self.put("chords", self.chord(notes, 7, True), b, .044)
                if 36 <= bar < 40:
                    for p in [0, 1.5, 3]:
                        self.put("bass", self.bass(41, .20), b + p, .3 + local * .08)
            elif 32 <= bar < 36:
                if bar % 2 == 0:
                    self.put("chords", self.chord((53, 56, 60, 67), 7.4), b, .095)
                if bar == 35:
                    self.put("acid", self.acid(77, .5), b + 3, .18)
            else:
                if bar < 76:
                    for p in [.5, 1.5, 2.5, 3.5]:
                        self.put("bass", self.bass(root, .23), b + p, .72)
                if bar in [72, 76, 78]:
                    self.put("chords", self.chord(notes, 7), b, .06 if bar < 78 else .035)

    def load_voices(self):
        source = Path(self.config["voiceDirectory"])
        provenance = json.loads((source / "provenance.json").read_text())
        for item in provenance["items"]:
            path = source / item["file"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
                raise ValueError(f"Dry voice changed after provenance: {path}")
            slug = path.stem.removeprefix("voice-")
            self.voice_dry[slug] = read_audio(path)
            self.voice_text[slug] = item["text"]

    def color_voice(self, y, color):
        y = filt(filt(y, 180 if color == "radio" else 250, "highpass"),
                 4400 if color == "radio" else 7600)
        y = compressor(y, .20, 3, 1., .07)
        if color == "radio":
            y = np.tanh(y * 2.5) / 1.75
        elif color == "vocoder":
            # Eight-band channel vocoder driven by speech envelopes and an F3
            # carrier. Consonant noise remains lightly present for intelligibility.
            t = np.arange(len(y)) / SR
            carrier = sum(np.sin(2 * np.pi * self.frequency(53) * h * t) / h
                          for h in range(1, 44)).astype(np.float32)
            out = np.zeros(len(y), np.float32)
            mono = y.mean(axis=1)
            edges = [200, 330, 540, 870, 1400, 2300, 3700, 6100, 9000]
            for low, high in zip(edges, edges[1:]):
                sos = signal.butter(2, [low, high], "bandpass", fs=SR, output="sos")
                band = signal.sosfilt(sos, mono)
                envelope = signal.sosfilt(signal.butter(2, 45, fs=SR, output="sos"), np.abs(band))
                tone = signal.sosfilt(sos, carrier)
                out += (tone / max(float(np.sqrt(np.mean(tone ** 2))), .0001) * envelope).astype(np.float32)
            y = stereo(out * 1.8) + y * .22
        y = fade(y, .010, .042)
        # Match the five dry takes before their compositional faders. This is
        # peak matching, not a claim about equal perceptual loudness.
        return (y * (.56 / max(float(np.max(np.abs(y))), .001))).astype(np.float32)

    def place_voice(self, slug, beat, semitones, speed, color, gain, label,
                    max_beats=None, reverse=False, echoes=2):
        dry = self.voice_dry[slug]
        warped, asset = pitch_tempo(dry, semitones, speed, self.work)
        y = self.color_voice(warped, color)
        if max_beats:
            y = fade(y[:round(max_beats * self.spb * SR)], .008, .025)
        if reverse:
            y = fade(y[::-1], .04, .015)
        self.put("vocals", y, beat, gain)
        if echoes:
            tail = y[-min(len(y), round(.22 * SR)):]
            tail_beat = beat + (len(y) - len(tail)) / SR / self.spb
            self.echo("vocal_fx", tail, tail_beat, .13 * gain, .75, echoes)
        start = beat * self.spb
        self.vocal_regions.append((start, start + len(y) / SR))
        self.events.append({"kind": "transformedVoice", "source": slug,
                            "text": self.voice_text[slug], "label": label, "beat": beat,
                            "startSeconds": start, "endSeconds": start + len(y) / SR,
                            "pitchShiftSemitones": semitones, "speedFactor": speed,
                            "color": color, "reverse": reverse, "truncated": bool(max_beats),
                            "processingAsset": str(asset)})
        self.voice_assets.append({"source": slug, "drySeconds": len(dry) / SR,
                                  "processedSecondsBeforeSlice": len(warped) / SR,
                                  "pitchSemitones": semitones, "speedFactor": speed,
                                  "path": str(asset)})
        return y

    def arrange_vocals(self):
        self.load_voices()
        for insert in self.config["vocalInserts"]:
            self.place_voice(insert["source"], insert["beat"], insert["pitchSemitones"],
                             insert["speed"], insert["color"], insert["gain"], insert["label"])
        # The central answer accelerates by rhythm and playback rate, then falls
        # away. It is confined to the build; the main drops keep instrumental leads.
        for i, (beat, length) in enumerate([(149, .8), (151, .65), (152.5, .5),
                                          (153.5, .45), (154.25, .35), (154.75, .28)]):
            self.place_voice("now", beat, [0, 3, 7, 7, 10, 12][i], 1.1 + i * .08,
                             "bright", .42 + i * .015, "现在 / 加速碎片", length, echoes=0)
        # Reversed whispered fragment is an effect return, not another full line.
        reverse, _ = pitch_tempo(self.voice_dry["frequency"], 7, 1.4, self.work)
        reverse = self.color_voice(reverse, "bright")[::-1].copy()
        self.put("vocal_fx", fade(reverse, .18, .02), 144 - len(reverse) / SR / self.spb, .21)
        stopped, rate = tape_stop(self.color_voice(self.voice_dry["go"], "radio"),
                                  2.25 * self.spb)
        self.put("vocals", stopped, 156.75, .65)
        self.vocal_regions.append((156.75 * self.spb, 159 * self.spb))
        self.events.append({"kind": "voiceTapeStop", "source": "go", "text": "走。",
                            "beat": 156.75, "durationBeats": 2.25,
                            "startPlaybackRate": rate, "endPlaybackRate": .10,
                            "startPitchSemitones": float(12 * np.log2(rate)),
                            "endPitchSemitones": float(12 * np.log2(.10))})
        # Short vocoded commands only at two phrase endings after the main riff.
        self.place_voice("go", 222.25, -2, 1.35, "vocoder", .48, "走 / 声码击打", .70)
        self.place_voice("now", 286.25, 7, 1.35, "bright", .38, "现在 / 最后回应", .75)
        # Smooth local space for speech. The centre break has no kick or bass;
        # direct words in a drop lower only the competing midrange instruments.
        for start, end in self.vocal_regions:
            a, b = round(start * SR), min(self.frames, round((end + .04) * SR))
            curve = np.full(b - a, .53, np.float32)
            ramp = min(round(.035 * SR), len(curve) // 2)
            if ramp:
                curve[:ramp] = np.linspace(1, .53, ramp)
                curve[-ramp:] = np.linspace(.53, 1, ramp)
            for bus in ["riff", "acid", "chords"]:
                self.buses[bus][a:b] *= curve[:, None]
        unique = {a["path"]: a for a in self.voice_assets}
        save_json(self.output / "voice-processing.json", {
            "method": "Actual resampling + compensating atempo; transformed samples saved before EQ and slicing.",
            "assets": list(unique.values()), "humanListening": False})

    def transitions(self):
        for end in [32, 160, 256]:
            t = np.arange(round(8 * self.spb * SR)) / SR
            noise = filt(filt(self.rng.normal(0, 1, (len(t), 2)), 1800, "highpass"), 10500)
            envelope = np.linspace(0, 1, len(t)) ** 1.8
            gate = .45 + .55 * np.sin(np.pi * t / self.spb * 4) ** 4
            self.put("fx", fade(noise * (envelope * gate)[:, None], .12, .045), end - 8, .048)
            t = np.arange(round(.9 * SR)) / SR
            down = filt(self.rng.normal(0, 1, (len(t), 2)), 5100, "highpass")
            self.put("fx", fade(down * np.exp(-t * 6)[:, None], .002, .15), end, .055)
            # A complete last-beat breath makes the tape stop clear before drop B.
            a = round((end - 1 if end == 160 else end - .5) * self.spb * SR)
            b = round(end * self.spb * SR)
            for name in ["drums", "bass", "rumble", "riff", "acid", "chords"]:
                self.buses[name][a:b] *= np.linspace(1, 0, b - a)[:, None] ** 3
        for beat in [96, 128, 224, 288]:
            t = np.arange(round(.6 * SR)) / SR
            n = filt(self.rng.normal(0, 1, (len(t), 2)), 6200, "highpass")
            self.put("fx", fade(n * np.exp(-t * 9)[:, None], .002, .10), beat, .035)

    def mix(self):
        self.buses["vocal_fx"] += room(self.buses["vocals"], .55, .035, 261016) * .065
        self.buses["vocal_fx"] = filt(self.buses["vocal_fx"], 350, "highpass")
        super().mix()
        # Cut the actual premaster through the central transformation and 8 bars
        # of the second drop. Do not regenerate a different arrangement for preview.
        y = read_audio(self.output / "premaster.wav")
        a, b = [round(beat * self.spb * SR) for beat in self.config["previewBeats"]]
        sf.write(self.output / "preview-premaster.wav", fade(y[a:b], .018, .12), SR, subtype="PCM_24")
        arrangement = json.loads((self.output / "arrangement.json").read_text())
        arrangement["composition"] = "New F-minor instrumental and 80-bar DJ arrangement; original Chinese text synthesized locally and transformed as sparse inserts."
        arrangement["preview"] = {"startSeconds": a / SR, "endSeconds": b / SR,
                                    "description": "Central low-pitched call, sped-up answer, slices, tape stop and second drop."}
        arrangement["voiceProcessingReport"] = "voice-processing.json"
        save_json(self.output / "arrangement.json", arrangement)

    def rumble(self):
        # Apply transition automation after generating the wet low-frequency
        # return; otherwise mix would recreate rumble underneath the DJ breath.
        wet = super().rumble()
        for end in [32, 160, 256]:
            a = round((end - 1 if end == 160 else end - .5) * self.spb * SR)
            b = round(end * self.spb * SR)
            wet[a:b] *= np.linspace(1, 0, b - a)[:, None] ** 3
        return wet


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["render", "master", "all"])
    parser.add_argument("--config", type=Path, default=Path("scripts/presets/switchback.json"))
    parser.add_argument("--out", type=Path, default=Path("artifacts/audio/switchback"))
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if args.command in ["render", "all"]:
        Switchback(config, args.out).render()
    if args.command in ["master", "all"]:
        results = [master_one(args.out / "premaster.wav", config["outputStem"], args.out, config["title"]),
                   master_one(args.out / "preview-premaster.wav", config["outputStem"] + "-middle-preview",
                              args.out, config["title"] + " / 中场试听")]
        provenance = Path(config["voiceDirectory"]) / "provenance.json"
        save_json(args.out / "manifest.json", {
            "title": config["title"], "style": config["style"], "bpm": config["bpm"], "key": config["key"],
            "sourceCredit": config["sourceCredit"], "voiceProvenance": json.loads(provenance.read_text()),
            "renders": results,
            "subjectiveListeningReview": "未进行人工耳听；文件测量和浏览器播放属于客观验证。"})
        for result in results:
            for f in result["files"]:
                print(f"{f['filename']}: {f['audioDurationSeconds']:.2f}s / {f['integratedLufs']} LUFS / {f['truePeakDbtp']} dBTP", flush=True)


if __name__ == "__main__":
    main()
