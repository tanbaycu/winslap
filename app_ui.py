import customtkinter as ctk
import sounddevice as sd
import numpy as np
import pystray
from PIL import Image, ImageDraw
import time
import os
import wave
import struct
import math
import soundfile as sf
import threading
import sys

# Tình trạng ứng dụng
SENSITIVITY = 0.051  # Mô phỏng giá trị 0.051g trong SlapMac
COOLDOWN = 1.0     
AUDIO_FILE = ""
sound_options = ["scream", "fart", "quack", "bruh", "gunshot"]

audio_data = None
audio_fs = 44100
last_slap_time = 0
is_listening = True

# Đảm bảo đường dẫn chính xác khi build ra exe
if hasattr(sys, '_MEIPASS'):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

sounds_dir = os.path.join(base_dir, "sounds")
os.makedirs(sounds_dir, exist_ok=True)

def play_test_sound():
    if audio_data is not None:
        try:
             # Phát âm thanh với độ lớn tối đa (1.0)
             sd.play(audio_data * 1.0, audio_fs)
        except Exception:
             pass

def load_audio(name):
    global audio_data, audio_fs, AUDIO_FILE
    AUDIO_FILE = os.path.join(sounds_dir, f"{name}.wav")
    
    if not os.path.exists(AUDIO_FILE):
        print(f"Không tìm thấy {name}.wav, tiến hành tạo âm thanh ngẫu nhiên...")
        _create_fake_sound(AUDIO_FILE, name)
    
    try:
        audio_data, audio_fs = sf.read(AUDIO_FILE, dtype='float32')
        print(f"Đã tải {AUDIO_FILE}")
    except Exception as e:
        print("Lỗi load âm thanh:", e)

def _create_fake_sound(filepath, name):
    sample_rate = 44100.0
    wave_file = wave.open(filepath, 'w')
    wave_file.setnchannels(1)
    wave_file.setsampwidth(2)
    wave_file.setframerate(sample_rate)
    
    length = 0.5 if name != "scream" else 1.2
    for i in range(int(sample_rate * length)):
        time_sec = i / sample_rate
        if name == "fart":
            freq = 150 + (i % 50)  # Tiếng rung trầm
        elif name == "quack":
            freq = 600 - time_sec * 300
        elif name == "scream":
            freq = 1000 - time_sec * 800
        elif name == "gunshot":
            freq = 200 * math.exp(-time_sec*30) # Tiếng nổ trầm chát
        else:
            freq = 300
            
        envelope = math.exp(-time_sec * (5 if name != "scream" else 3))
        value = int(32767.0 * envelope * math.sin(2 * math.pi * freq * time_sec))
        wave_file.writeframesraw(struct.pack('<h', value))
    wave_file.close()

def audio_callback(indata, frames, time_info, status):
    global last_slap_time
    if not is_listening: return
    
    current_time = time.time()
    volume_norm = np.linalg.norm(indata) * 10
    
    # Map SENSITIVITY from [0.0 - 1.0] -> Threshold [5.0 (nhạy) to 100.0 (kém nhạy)]
    threshold = 5.0 + SENSITIVITY * 95.0
    
    if volume_norm > threshold and (current_time - last_slap_time) > COOLDOWN:
        print(f"👋 [SLAP] Lực: {volume_norm:.2f}")
        last_slap_time = current_time
        
        over_force = volume_norm - threshold
        scaled_vol = min(1.0, max(0.2, over_force / 40.0 + 0.2))
        
        if audio_data is not None:
             sd.play(audio_data * scaled_vol, audio_fs)

def start_audio_stream():
    try:
        stream = sd.InputStream(channels=1, callback=audio_callback)
        stream.start()
        while True:
            time.sleep(1)
    except Exception as e:
        print("Lỗi micro:", e)

threading.Thread(target=start_audio_stream, daemon=True).start()

ctk.set_appearance_mode("light")

class SlapApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("SlapWin - Đập Laptop!")
        self.geometry("550x500")
        self.resizable(False, False)
        
        # Thiết kế "SlapMac" (Nền trang kem sáng, Thẻ trắng)
        self.configure(fg_color="#EBEAEA")
        
        load_audio("scream")
        
        # Header title
        header = ctk.CTkLabel(self, text="SlapWin", font=("Segoe UI", 32, "bold"), text_color="#18201A")
        header.pack(pady=(20, 5))
        sub = ctk.CTkLabel(self, text="Đập laptop của bạn. Nó hét lại. Chỉ có vậy thôi.", font=("Segoe UI", 14), text_color="#637C67")
        sub.pack(pady=(0, 20))

        # CARD 1: Thể loại âm thanh
        self.card1 = ctk.CTkFrame(self, fg_color="white", corner_radius=15)
        self.card1.pack(pady=10, padx=30, fill="x")
        
        c1_title = ctk.CTkLabel(self.card1, text="🎵 Bảy thể loại phản kháng", font=("Segoe UI", 16, "bold"), text_color="#18201A")
        c1_title.pack(pady=(15, 5), padx=20, anchor="w")
        
        c1_desc = ctk.CTkLabel(self.card1, text="Nhiều đoạn âm thanh đủ loại xúc cảm. Thử xem văn phòng có nhìn bạn không.", font=("Segoe UI", 12), text_color="#7B8D7E")
        c1_desc.pack(padx=20, anchor="w", pady=(0, 15))
        
        self.sound_var = ctk.StringVar(value="scream")
        self.sound_menu = ctk.CTkComboBox(self.card1, values=sound_options, variable=self.sound_var, command=self.change_sound, 
                                          fg_color="#F8F9F8", border_color="#E2E4E1", button_color="#F8F9F8", 
                                          button_hover_color="#E2E4E1", text_color="#304133", dropdown_fg_color="white", dropdown_text_color="#304133")
        self.sound_menu.pack(pady=5, padx=20, fill="x")
        
        self.play_btn = ctk.CTkButton(self.card1, text="▶ Thử tiếng (Test)", command=play_test_sound, fg_color="#F0F4E8", text_color="#4F7B59", hover_color="#E4EBDB")
        self.play_btn.pack(pady=(10, 15), padx=20)

        # CARD 2: Chỉnh cú tát
        self.card2 = ctk.CTkFrame(self, fg_color="white", corner_radius=15)
        self.card2.pack(pady=10, padx=30, fill="x")
        
        c2_title = ctk.CTkLabel(self.card2, text="🎛️ Ấn định cú tát", font=("Segoe UI", 16, "bold"), text_color="#18201A")
        c2_title.pack(pady=(15, 10), padx=20, anchor="w")
        
        # Độ nhạy
        sens_fr = ctk.CTkFrame(self.card2, fg_color="transparent")
        sens_fr.pack(fill="x", padx=20)
        ctk.CTkLabel(sens_fr, text="Độ nhạy cảm (Sensitivity)", font=("Segoe UI", 13), text_color="#405041").pack(side="left")
        self.sens_val = ctk.CTkLabel(sens_fr, text=f"{SENSITIVITY:.3f}g", font=("Segoe UI", 12, "bold"), text_color="#405041")
        self.sens_val.pack(side="right")
        
        self.sens_sl = ctk.CTkSlider(self.card2, from_=0.0, to=1.0, command=self.update_sens, progress_color="#418433", button_color="#F4FFF2", button_hover_color="#D9FAD5")
        self.sens_sl.set(SENSITIVITY)
        self.sens_sl.pack(fill="x", padx=20, pady=(5, 0))
        
        s_hnt = ctk.CTkFrame(self.card2, fg_color="transparent")
        s_hnt.pack(fill="x", padx=20, pady=(0, 10))
        ctk.CTkLabel(s_hnt, text="Chạm nhẹ bướm lượn", font=("Segoe UI", 11), text_color="#9FA9A0").pack(side="left")
        ctk.CTkLabel(s_hnt, text="Một chưởng thủng máy", font=("Segoe UI", 11), text_color="#9FA9A0").pack(side="right")
        
        # Cooldown
        cool_fr = ctk.CTkFrame(self.card2, fg_color="transparent")
        cool_fr.pack(fill="x", padx=20)
        ctk.CTkLabel(cool_fr, text="Độ trễ (Cooldown)", font=("Segoe UI", 13), text_color="#405041").pack(side="left")
        self.cool_val = ctk.CTkLabel(cool_fr, text=f"{COOLDOWN:.1f}s", font=("Segoe UI", 12, "bold"), text_color="#405041")
        self.cool_val.pack(side="right")
        
        self.cool_sl = ctk.CTkSlider(self.card2, from_=0.1, to=3.0, command=self.update_cool, progress_color="#418433", button_color="#F4FFF2", button_hover_color="#D9FAD5")
        self.cool_sl.set(COOLDOWN)
        self.cool_sl.pack(fill="x", padx=20, pady=(5, 0))
        
        c_hnt = ctk.CTkFrame(self.card2, fg_color="transparent")
        c_hnt.pack(fill="x", padx=20, pady=(0, 15))
        ctk.CTkLabel(c_hnt, text="Súng liên thanh tát", font=("Segoe UI", 11), text_color="#9FA9A0").pack(side="left")
        ctk.CTkLabel(c_hnt, text="Phút mặc niệm", font=("Segoe UI", 11), text_color="#9FA9A0").pack(side="right")

        self.protocol("WM_DELETE_WINDOW", self.hide_window)

    def change_sound(self, choice):
        load_audio(choice)
        
    def update_sens(self, val):
        global SENSITIVITY
        SENSITIVITY = val
        self.sens_val.configure(text=f"{val:.3f}g")
        
    def update_cool(self, val):
        global COOLDOWN
        COOLDOWN = val
        self.cool_val.configure(text=f"{val:.1f}s")
        
    def hide_window(self):
        self.withdraw()

def show_window(icon, item):
    app.deiconify()

def quit_app(icon, item):
    icon.stop()
    os._exit(0)

def start_tray():
    image = Image.new('RGB', (64, 64), (65, 132, 51))
    dc = ImageDraw.Draw(image)
    dc.ellipse((16, 16, 48, 48), fill="white")
    
    menu = pystray.Menu(
        pystray.MenuItem("Mở SlapWin (Settings)", show_window),
        pystray.MenuItem("Thoát Khỏi App", quit_app)
    )
    icon = pystray.Icon("SlapWin", image, "SlapWin (Monitoring...)", menu)
    threading.Thread(target=icon.run, daemon=True).start()

if __name__ == "__main__":
    app = SlapApp()
    start_tray()
    app.mainloop()
