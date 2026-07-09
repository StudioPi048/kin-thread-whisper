import json

with open("/Users/pietrobaccin/.gemini/antigravity/brain/19d01b85-3c3b-4743-8f15-13bc7f1637f0/.system_generated/logs/transcript_full.jsonl") as f:
    for line in f:
        data = json.loads(line)
        if data.get("type") == "USER_INPUT":
            content = data.get("content", "")
            if "AÇÃO 1" in content:
                print(content)
