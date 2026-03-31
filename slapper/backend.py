import sounddevice as sd
import numpy as np
import urllib.request
import time
import sys
import threading

# Cấu hình
PORT = 15320
SENSITIVITY = 0.05
COOLDOWN = 1.0
last_slap_time = 0

def on_slap(force):
    global last_slap_time
    now = time.time()
    if now - last_slap_time > COOLDOWN:
        last_slap_time = now
        print(f"[{now}] BÙM! TÁT PHÁT HIỆN TỪ BACKEND PYTHON. Lực: {force}")
        try:
            # Báo cho Node.js Backend
            urllib.request.urlopen(f"http://localhost:{PORT}/slap", timeout=0.1)
        except Exception as e:
            pass

def audio_callback(indata, frames, time_info, status):
    if status:
        pass
    
    # indata shape is (frames, channels)
    # Convert to mono
    mono_data = indata[:, 0]
    
    # 1. Tính RMS cơ bản
    rms = np.sqrt(np.mean(mono_data**2))
    
    # 2. Trần biên độ (Peak) - Rất quan trọng để phát hiện Transient
    peak = np.max(np.abs(mono_data))
    
    # 3. Phân cực sóng sốc (Shockwave crest factor)
    # Tát máy tính tạo ra Peak cực lớn so với RMS (Crest Factor cao)
    if rms > 0.001:
        crest_factor = peak / rms
    else:
        crest_factor = 0
        
    # Một cú tát cứng (vật lý) thường có Crest Factor > 8.0 trong milliseconds đầu tiên
    # Và peak > ngưỡng sensitivity
    if peak > (0.1 + SENSITIVITY) and crest_factor > 6.0:
        on_slap(peak)

def start_sensor():
    print("Khởi động Python Hard-Sensor Backend...")
    # Thử gọi API cảm biến gia tốc Windows (nếu có), nếu không dùng Microphone
    print("Sử dụng High-precision Microphone Acoustic Sensor")
    
    # Lắng nghe liên tục với blocksize nhỏ để bắt Transient
    stream = sd.InputStream(callback=audio_callback, channels=1, samplerate=44100, blocksize=512)
    with stream:
        while True:
            time.sleep(1)

if __name__ == "__main__":
    # Đọc tham số từ Node.js nếu có
    if len(sys.argv) > 1:
        try:
            SENSITIVITY = float(sys.argv[1])
        except:
            pass
            
    start_sensor()
