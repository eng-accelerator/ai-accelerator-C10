"""Print the running scoreboard of all module evals.

Reads from scripts/eval_results.json (auto-populated by m0/m2/m3/m4/m5 when
they finish their RAGAS eval). Run any time during or after a build.

Run:  python show_results.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import print_scoreboard  # noqa: E402

if __name__ == "__main__":
    print_scoreboard()
