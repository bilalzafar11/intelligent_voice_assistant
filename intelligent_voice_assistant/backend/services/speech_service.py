# pyright: reportMissingImports=false
import os

# imageio-ffmpeg may not be installed in all environments. Try to import it
# dynamically and fall back to a no-op shim that assumes 'ffmpeg' is
# available on PATH. Using importlib avoids some static-analysis import
# errors in environments where the package isn't installed.
import importlib

try:
    ffmpeg = importlib.import_module("imageio_ffmpeg")
except Exception:
    class _FFmpegShim:
        @staticmethod
        def get_ffmpeg_exe():
            # return 'ffmpeg' so os.path.dirname(...) yields '' and PATH is unchanged
            return 'ffmpeg'

    ffmpeg = _FFmpegShim()

# If imageio-ffmpeg provides an ffmpeg binary path, add its directory to PATH.
ffmpeg_exe = None
try:
    ffmpeg_exe = ffmpeg.get_ffmpeg_exe()
except Exception:
    ffmpeg_exe = None

if ffmpeg_exe:
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    if ffmpeg_dir:
        os.environ["PATH"] += os.pathsep + ffmpeg_dir

try:
    import whisper  # type: ignore[import-not-found]
except ImportError:
    whisper = None

try:
    import pyaudio  # type: ignore[import-not-found]
except ImportError:
    pyaudio = None

import wave
from functools import lru_cache

try:
    from backend.config import WHISPER_MODEL
except ModuleNotFoundError:  # pragma: no cover
    from config import WHISPER_MODEL


@lru_cache(maxsize=1)
def get_model():
    if whisper is None:
        raise RuntimeError("Whisper is not installed. Please install it before using voice transcription.")
    return whisper.load_model(WHISPER_MODEL)


def record_audio(filename="temp_audio/live.wav", duration=5, sample_rate=16000):
    if pyaudio is None:
        raise RuntimeError("PyAudio is not installed. Microphone recording is unavailable.")

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
    model = get_model()
    result = model.transcribe(
        audio_path,
        language="en",
        task="transcribe",
        temperature=0,
        condition_on_previous_text=False,
        initial_prompt=(
            "Voice commands for a student marks dashboard: select assignment, test, "
            "midterm, final or final term; roll number; marks; stop; exit."
        ),
    )
    return result["text"].strip()


# ⭐ THIS is what routes.py is importing
def listen_and_transcribe():

    audio_file = record_audio()
    text = speech_to_text(audio_file)

    return text