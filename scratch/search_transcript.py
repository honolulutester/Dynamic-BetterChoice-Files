import json
import os
import glob

brain_dir = r"C:\Users\USER\.gemini\antigravity\brain"
for log_file in glob.glob(os.path.join(brain_dir, "**", "transcript.jsonl"), recursive=True):
    # Skip the current conversation to find previous ones
    if "1114375e-f374-4b2a-9fdc-c9b05daddf10" in log_file:
        continue
    print(f"Scanning log: {log_file}")
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)
                content = data.get("content", "")
                if data.get("type") == "USER_INPUT" and ("sheet" in content.lower() or "webhook" in content.lower() or "code method" in content.lower()):
                    print(f"  Step {data.get('step_index')}: {content}\n")
            except Exception as e:
                pass
