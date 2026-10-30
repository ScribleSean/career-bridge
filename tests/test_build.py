import unittest
import unittest.mock

try:
    from pipeline import build
except ImportError:
    build = None

CURVE = [[2023, 0.5], [2024, 2.0], [2025, 7.0], [2026, 14.0]]


@unittest.skipIf(build is None, "pandas or numpy not installed")
class YearsBehindTest(unittest.TestCase):
    def test_statuses(self):
        self.assertEqual(build.years_behind(None, CURVE), (None, "too_few_ads"))
        self.assertEqual(build.years_behind(14.0, CURVE), (0.0, "level"))
        self.assertEqual(build.years_behind(0.1, CURVE), (None, "not_started"))
        self.assertEqual(build.years_behind(4.5, CURVE), (1.5, "behind"))

    def test_curve_must_rise(self):
        for curve in ([[2023, 0.5], [2024, 7.0], [2025, 2.0], [2026, 14.0]],
                      [[2023, 0.5], [2024, 2.0], [2025, 2.0], [2026, 14.0]]):
            with self.assertRaises(ValueError):
                build.years_behind(4.5, curve)


@unittest.skipIf(build is None, "pandas or numpy not installed")
class SimMethodTest(unittest.TestCase):
    def test_unknown_cb_sim_is_rejected_where_it_is_used(self):
        vec = build.pd.DataFrame([[1.0, 2.0], [2.0, 1.0]], index=["a", "b"])
        with unittest.mock.patch.object(build, "SIM_METHOD", "zscores"):
            with self.assertRaisesRegex(ValueError, "CB_SIM must be zscore or row"):
                build.cosine_matrix(vec)


if __name__ == "__main__":
    unittest.main()
