from pathlib import Path

"""
This script is used to recursively list all UFDR files in the "External Dumps" directory on the secured VM.
"""

def run_gen(gen):
    while True:
        try:
            ufdr_path = next(gen)
            ufdr_size = ufdr_path.stat().st_size
            yield ufdr_path, ufdr_size
        except StopIteration:
            break
        except OSError:
            continue

ufdrs = list(run_gen(Path("//?/Z:/").rglob("*.ufdr")))

for ufdr_path, ufdr_size in ufdrs:
    print(f"{ufdr_path}\t{ufdr_size}")
