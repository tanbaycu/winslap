import numpy as np
import sounddevice as sd
import soundfile as sf
import pystray
from PIL import Image, ImageDraw
import time
import os
import wave
import struct
import math
import sys

# Thư viện để truy cập Windows Sensor API (Gia tốc kế)
try:
    from winrt.windows.devices.sensors import Accelerometer
except ImportError:
    print("Cần cài đặt winrt-Windows.Devices.Sensors. Chạy: pip install winrt-Windows.Devices.Sensors")
    sys.exit(1)

# CẤU HÌNH MẶC ĐỊNH SENSOR API
SENSOR_SENSITIVITY = 1.0   # Mức độ nhạy gia tốc (g-force delta)
SENSOR_COOLDOWN = 1.0      # Thời gian chờ giữa các lần tát bằng Sensor (giây)

# CẤU HÌNH MẶC ĐỊNH AUDIO API (FALLBACK)
AUDIO_SENSITIVITY = 15.0   # Mức độ nhạy âm thanh khi không có phần cứng Sensor
AUDIO_COOLDOWN = 1.0       # Thời gian chờ âm thanh (giây)

AUDIO_FILE = "scream.wav"

last_slap_time = 0
is_running = True
audio_data = None
audio_fs = 44100

# Trạng thái Sensor
sensor_token = None
accel = None
using_sensor = False

# Trạng thái Microphone (Dùng làm Backup)
mic_stream = None

def generate_default_sound():
    if not os.path.exists(AUDIO_FILE):
        print("Đang tạo âm thanh mặc định...")
        sample_rate = 44100.0
        wave_file = wave.open(AUDIO_FILE, 'w')
        wave_file.setnchannels(1)
        wave_file.setsampwidth(2)
        wave_file.setframerate(sample_rate)
        
        for i in range(int(sample_rate * 1.2)):
            time_sec = i / sample_rate
            freq = max(200, 1000 - time_sec * 800)
            envelope = math.exp(-time_sec * 3)
            value = int(32767.0 * envelope * math.sin(2 * math.pi * freq * time_sec))
            data = struct.pack('<h', value)
            wave_file.writeframesraw(data)
        wave_file.close()

def load_audio_file():
    global audio_data, audio_fs
    if os.path.exists(AUDIO_FILE):
        try:
            audio_data, audio_fs = sf.read(AUDIO_FILE, dtype='float32')
        except Exception as e:
            print("Lỗi đọc file âm thanh:", e)

def trigger_slap(force_val, sensitivity_threshold, mode_name, max_cap=3):
    """Xử lý phát âm báo sau khi nhận diện Slap hợp lệ"""
    global last_slap_time
    current_time = time.time()
    
    cooldown = SENSOR_COOLDOWN if using_sensor else AUDIO_COOLDOWN
    
    if force_val > sensitivity_threshold and (current_time - last_slap_time) > cooldown:
        print(f"👋 [TÁT! - {mode_name}] Lực: {force_val:.2f} (Ngưỡng: {sensitivity_threshold})")
        last_slap_time = current_time
        
        # Tiếng thét tỉ lệ thuận với lực
        max_force = sensitivity_threshold * max_cap
        scaled_vol = min(1.0, max(0.2, (force_val - sensitivity_threshold) / max_force + 0.2))
        
        if audio_data is not None:
             scaled_data = audio_data * scaled_vol
             sd.play(scaled_data, audio_fs)

# ==================== CƠ CHẾ 1: ACCELEROMETER SENSOR ====================

def reading_changed_handler(sender, args):
    """Hàm lắng nghe cảm biến gia tốc để phát hiện chấn động cứng."""
    reading = args.reading
    force = math.sqrt(reading.acceleration_x**2 + reading.acceleration_y**2 + reading.acceleration_z**2)
    delta = abs(force - 1.0)
    trigger_slap(delta, SENSOR_SENSITIVITY, "SENSOR", max_cap=3)

# ==================== CƠ CHẾ 2: MICROPHONE CẢM BIẾN (FALLBACK) ====================

def audio_callback(indata, frames, time_info, status):
    """Hàm lắng nghe âm thanh nếu máy không có cảm biến vật lý."""
    if status:
        pass
    volume_norm = np.linalg.norm(indata) * 10
    trigger_slap(volume_norm, AUDIO_SENSITIVITY, "MICROPHONE", max_cap=4)

# ==================== HỆ THỐNG GIAO DIỆN KHAY (TRAY) ====================

def create_image():
    image = Image.new('RGB', (64, 64), (40, 40, 40))
    dc = ImageDraw.Draw(image)
    # Icon màu ĐỎ nều xài Sensor, màu XANH LÁ nếu xài Microphone
    color = "red" if using_sensor else "green"
    dc.ellipse((16, 16, 48, 48), fill=color) 
    return image

def set_sensitivity(icon, item):
    global SENSOR_SENSITIVITY, AUDIO_SENSITIVITY
    choice = str(item)
    if using_sensor:
        if "Rất nhạy" in choice: SENSOR_SENSITIVITY = 0.5
        elif "Vừa" in choice: SENSOR_SENSITIVITY = 1.0
        elif "Kém nhạy" in choice: SENSOR_SENSITIVITY = 2.0
        print(f"🎛️ (Sensor) Đã cập nhật độ nhạy: {SENSOR_SENSITIVITY}g")
    else:
        if "Rất nhạy" in choice: AUDIO_SENSITIVITY = 5.0
        elif "Vừa" in choice: AUDIO_SENSITIVITY = 15.0
        elif "Kém nhạy" in choice: AUDIO_SENSITIVITY = 40.0
        print(f"🎛️ (Microphone) Đã cập nhật độ nhạy: {AUDIO_SENSITIVITY}")

def quit_app(icon, item):
    global is_running, sensor_token, accel, mic_stream
    is_running = False
    
    if using_sensor and accel and sensor_token:
        accel.remove_reading_changed(sensor_token)
    elif mic_stream:
        mic_stream.stop()
        mic_stream.close()
        
    icon.stop()

def main():
    global sensor_token, accel, using_sensor, mic_stream
    
    print("🚀 Khởi động SlapWin trên Windows...")
    generate_default_sound()
    load_audio_file()
    
    # 1. Thử thiết lập bằng Gia Tốc Kế API trước
    accel = Accelerometer.get_default()
    if accel is not None:
        using_sensor = True
        sensor_token = accel.add_reading_changed(reading_changed_handler)
        print("✅ KHỞI TẠO THÀNH CÔNG: Windows Sensor API (Accelerometer)")
        print("📳 Đang bắt chấn động rung từ bo mạch...")
    else:
        # 2. Rớt đài -> Chuyển sang thu âm Micro Peak 
        print("⚠️ KHÔNG TÌM THẤY Accelerometer (Gia tốc kế) trên phần cứng máy này!")
        print("🔄 Chuyển sang cơ chế DỰ PHÒNG: Phân tích áp suất âm thanh qua Microphone")
        using_sensor = False
        try:
            mic_stream = sd.InputStream(channels=1, callback=audio_callback)
            mic_stream.start()
            print("🎙️ Đang lắng nghe sóng âm thanh microphone...")
        except Exception as e:
            print("❌ LỖI: Nhận diện Microphone dự phòng cũng thất bại", e)
            return

    # Hệ thống Tray Menu (Giá trị hiển thị tự điều chỉnh tuỳ theo Mode)
    def check_radio(sensitivity_val):
        return lambda item: (using_sensor and SENSOR_SENSITIVITY == sensitivity_val) or \
                            (not using_sensor and AUDIO_SENSITIVITY == sensitivity_val)
                            
    sens_1 = 0.5 if using_sensor else 5.0
    sens_2 = 1.0 if using_sensor else 15.0
    sens_3 = 2.0 if using_sensor else 40.0

    menu = (
        pystray.MenuItem("Cài đặt Độ Nhạy", pystray.Menu(
            pystray.MenuItem("Rất nhạy (Chạm nhẹ)", set_sensitivity, radio=True, checked=check_radio(sens_1)),
            pystray.MenuItem("Vừa (Tát bình thường)", set_sensitivity, radio=True, checked=check_radio(sens_2)),
            pystray.MenuItem("Kém nhạy (Đập tay mạnh)", set_sensitivity, radio=True, checked=check_radio(sens_3))
        )),
        pystray.MenuItem(f"Trạng thái: Đang chạy qua {'Sensor API' if using_sensor else 'Microphone'}", lambda: None),
        pystray.MenuItem("Thoát", quit_app)
    )
    
    icon = pystray.Icon("SlapWin", create_image(), "SlapWin (Laptop Scream)", menu)
    icon.run()
    
    print("Đã thoát SlapWin.")

if __name__ == '__main__':
    main()
