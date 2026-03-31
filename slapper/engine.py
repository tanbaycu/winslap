import sys
import time
import math
import numpy as np

try:
    from winrt.windows.devices.sensors import Accelerometer
    accel = Accelerometer.get_default()
except ImportError:
    accel = None

using_sensor = (accel is not None)

def flush_print(*args, **kwargs):
    print(*args, **kwargs)
    sys.stdout.flush()

if using_sensor:
    def reading_changed_handler(sender, args):
        reading = args.reading
        force = math.sqrt(reading.acceleration_x**2 + reading.acceleration_y**2 + reading.acceleration_z**2)
        delta = abs(force - 1.0)
        flush_print(f"STAT|SENSOR|{delta:.6f}")
        
    sensor_token = accel.add_reading_changed(reading_changed_handler)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
else:
    import sounddevice as sd
    def audio_callback(indata, frames, time_info, status):
        volume_norm = np.linalg.norm(indata) * 10
        flush_print(f"STAT|MIC|{volume_norm:.6f}")

    try:
        with sd.InputStream(samplerate=44100, channels=1, callback=audio_callback):
            while True:
                time.sleep(1)
    except Exception as e:
        flush_print(f"ERROR|{e}")
