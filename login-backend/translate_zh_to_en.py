# translate_zh_to_en.py

import requests
import sys

# 允许命令行输入中文参数
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "a10fe877a6dc4358b6bf5a36712ef568.EwBYJqle0uduBVIi"  # 替换为你的 API 密钥

def translate_to_english(text):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    messages = [
        {
            "role": "system",
            "content": "You are a translator, translating the user's input accurately into English, neither more nor less, and be careful not to include any text that does not belong to the user's input."
        },
        {
            "role": "user",
            "content": text
        }
    ]

    try:
        res = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers=headers,
            json={"model": "glm-4", "messages": messages}
        )
        content = res.json()['choices'][0]['message']['content']
        return content
    except Exception as e:
        print(f"[❌ 翻译失败，用原文] {e}")
        return text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("请在命令行传入中文句子，例如：python translate_zh_to_en.py 你好世界")
        sys.exit(1)

    chinese_input = sys.argv[1]
    english_output = translate_to_english(chinese_input)
    print(english_output)
