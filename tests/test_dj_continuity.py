"""Integration checks for the continuous-original DJ path (needs FFmpeg)."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("dj_remix", ROOT / "scripts/dj_remix.py")
DJ = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DJ)


class SourceContinuityTests(unittest.TestCase):
    def config(self):
        return {
            "mode": "continuous", "title": "continuity integration fixture", "seed": 123,
            "sourceBpm": 118, "introBpm": 118, "targetBpm": 126,
            "sourceFirstBeatSeconds": .19, "minimumSourceSeconds": 0,
            "introBars": 1, "outroBars": 1, "sourcePeak": .78,
            "songSections": [{"start": 0, "name": "fixture", "kind": "verse", "energy": .7}],
        }

    def fixture(self, path):
        # Different beginning/middle/end content exposes trimming or loop filling.
        t = np.arange(6 * DJ.SR) / DJ.SR
        hz = np.where(t < 2, 330, np.where(t < 4, 440, 550))
        phase = 2 * np.pi * np.cumsum(hz) / DJ.SR
        y = np.column_stack([.15 * np.sin(phase), .12 * np.cos(phase)])
        sf.write(path, y, DJ.SR, subtype="FLOAT")

    def test_preserves_the_whole_transformed_recording_once(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            self.fixture(p / "source.wav")
            production = DJ.ContinuousProduction(self.config(), p / "render", p / "source.wav")
            production.render()
            original, sr = sf.read(p / "render/stems/original.wav", dtype="float32")
            report = json.loads((p / "render/source-coverage.json").read_text())
            a, b = report["outputStartFrame"], report["outputEndFrame"]
            reference = production.warped * production.source_gain
            np.testing.assert_array_equal(original[a:b], reference)
            self.assertEqual(np.count_nonzero(original[:a]), 0)
            self.assertEqual(np.count_nonzero(original[b:]), 0)
            self.assertEqual(report["sourceFrames"], 6 * DJ.SR)
            self.assertEqual(report["occurrences"], 1)
            self.assertEqual(report["edits"], [])
            self.assertLess(abs(report["actualTransformedSeconds"] - report["expectedTransformedSeconds"]), .05)
            self.assertEqual(sr, DJ.SR)
            # The intro cannot truncate the source's lead-in before its first beat.
            self.assertLess(a / sr, production.at(production.intro_beats))
            self.assertLess(b, len(original))

    def test_full_song_preset_rejects_a_preview_before_creating_output(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            self.fixture(p / "preview.wav")
            config = self.config()
            config["minimumSourceSeconds"] = 180
            with self.assertRaisesRegex(ValueError, "preview cannot fill it"):
                DJ.ContinuousProduction(config, p / "should-not-exist", p / "preview.wav")
            self.assertFalse((p / "should-not-exist").exists())


if __name__ == "__main__":
    unittest.main()
