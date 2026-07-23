import imageio_ffmpeg as ffmpeg
import os

os.environ["PATH"] += os.pathsep + os.path.dirname(ffmpeg.get_ffmpeg_exe())
import whisper
import pyaudio
import wave
from config import WHISPER_MODEL

model = whisper.load_model(WHISPER_MODEL)


def record_audio(filename="temp_audio/live.wav", duration=5, sample_rate=16000):

    chunk = 1024
    format = pyaudio.paInt16
    channels = 1

    p = pyaudio.PyAudio()

    stream = p.open(
        format=format,
        channels=channels,
        rate=sample_rate,
        input=True,
        frames_per_buffer=chunk
    )

    frames = []

    print("🎤 Listening...")

    for _ in range(0, int(sample_rate / chunk * duration)):
        data = stream.read(chunk)
        frames.append(data)

    print("✅ Recording Finished")

    stream.stop_stream()
    stream.close()
    p.terminate()

    wf = wave.open(filename, "wb")
    wf.setnchannels(channels)
    wf.setsampwidth(p.get_sample_size(format))
    wf.setframerate(sample_rate)
    wf.writeframes(b"".join(frames))
    wf.close()

    return filename


def speech_to_text(audio_path: str):

    result = model.transcribe(audio_path)
    return result["text"].strip()


# ⭐ THIS is what routes.py is importing
def listen_and_transcribe():

    audio_file = record_audio()
    text = speech_to_text(audio_file)

    return text