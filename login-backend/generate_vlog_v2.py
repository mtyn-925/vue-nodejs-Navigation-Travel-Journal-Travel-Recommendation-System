import argparse
import os
import tempfile
import requests
import pyttsx3
import random
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

from moviepy.editor import (
    ImageClip, TextClip, CompositeVideoClip,
    concatenate_videoclips, AudioFileClip, CompositeAudioClip
)
from moviepy.video.fx.all import fadein, fadeout

# ✅ 中文润色用 API 密钥
ZHIPU_API_KEY = "5b48d83de6434ce6b6524091fe2ec5b2.QbDHy4mzWx5VZtpy"

# ✅ 润色函数：按上下文多轮生成
def polish_segments_with_context(segments):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ZHIPU_API_KEY}"
    }
    messages = [
        {"role": "system", "content": "你是一个旅游vlog解说员，注意绝对不可以说和vlog解说无关的文字，请将用户输入的简短句子润色为自然流畅、富有变化的口语解说风格，注意不要重复、句式灵活，有前后关联性,语言为中文。"}
    ]
    results = []
    for i, s in enumerate(segments):
        messages.append({"role": "user", "content": s})
        try:
            res = requests.post(
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                headers=headers,
                json={"model": "glm-4", "messages": messages}
            )
            content = res.json()['choices'][0]['message']['content']
        except Exception as e:
            print(f"[第{i+1}段润色失败，用原句] {e}")
            content = s

        results.append(content)
        messages.append({"role": "assistant", "content": content})
    return results

# ✅ 本地 TTS 合成
def synthesize_tts(text, path):
    tts_engine = pyttsx3.init()
    tts_engine.setProperty('rate', 150)
    voices = tts_engine.getProperty('voices')
    for voice in voices:
        if 'zh' in voice.id or 'chinese' in voice.name.lower():
            tts_engine.setProperty('voice', voice.id)
            break
    tts_engine.save_to_file(text, path)
    tts_engine.runAndWait()

# ✅ 创建底部彩色弹幕字幕
def create_danmaku(text, video_width, video_height, duration):
    try:
        colors = ['white', 'red', 'yellow', 'orange', 'cyan', 'lime', 'violet', 'deepskyblue']
        color = random.choice(colors)

        txt = TextClip(
    txt=text,
    fontsize=32,
    color=color,
    font='SimHei',
    method='caption',
    size=(video_width - 600, None),  # 加大边距，避免贴边
)

        txt = txt.set_duration(duration)
        txt = txt.set_position(("center", video_height - 90))  # 贴近底部但不出界
        txt = txt.fadein(0.5).fadeout(0.5)
        return txt
    except Exception as e:
        print("弹幕创建失败：", e)
        return None

# ✅ 分句函数（补足 + 结尾）
def split_text(text, image_count):
    segments = [s.strip() for s in re.split(r'[，,。！？…?]', text) if s.strip()]
    if len(segments) >= image_count:
        selected = segments[:image_count]
    else:
        while len(segments) < image_count:
            segments.append(random.choice(segments))
        selected = segments[:image_count]
    selected.append("这次旅程真是令人难忘，下次还想再来！")
    return selected

# ✅ 主流程
def generate_vlog(paragraphs, images, output, bgm_path="assets/bgm.mp3"):
    assert len(paragraphs) <= len(images) + 1, "图片数量应不少于段落数量 - 1（结尾语除外）"
    W, H = 1280, 720
    all_clips = []
    audio_segments = []

    print("正在润色每段文本...")
    polished_list = polish_segments_with_context(paragraphs)

    for idx, (polished, img_path) in enumerate(zip(polished_list, images)):
        print(f"[第{idx+1}段] {polished}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tts_path = tmp.name
        synthesize_tts(polished, tts_path)
        tts_audio = AudioFileClip(tts_path)

        img_clip = (
            ImageClip(img_path)
            .resize(height=H)
            .set_duration(tts_audio.duration + 0.5)
            .set_position("center")
        )
        img_clip = fadein(img_clip, 0.5)
        img_clip = fadeout(img_clip, 0.5)

        danmaku = create_danmaku(polished, W, H, img_clip.duration)
        if danmaku:
            clip = CompositeVideoClip([img_clip, danmaku])
        else:
            clip = img_clip

        clip = clip.set_audio(tts_audio)
        all_clips.append(clip)
        audio_segments.append(tts_path)

    final_video = concatenate_videoclips(all_clips, method="compose")

    # 背景音乐
    if os.path.exists(bgm_path):
        bgm_audio = AudioFileClip(bgm_path).volumex(0.2).set_duration(final_video.duration)
        final_audio = CompositeAudioClip([final_video.audio, bgm_audio])
        final_video = final_video.set_audio(final_audio)

    # ✅ 导出视频：H.264 + AAC 格式
    final_video.write_videofile(
        output,
        fps=24,
        codec='libx264',
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True
    )

    for path in audio_segments:
        os.remove(path)

# ✅ CLI 入口
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True, help='用户输入的多段文字')
    parser.add_argument('--images', nargs='+', required=True, help='图片路径列表')
    parser.add_argument('--output', required=True, help='输出视频路径')
    args = parser.parse_args()

    segments = split_text(args.text, len(args.images))
    generate_vlog(segments, args.images, args.output)
    print("视频生成完成")
    print(f"输出文件：{args.output}")
