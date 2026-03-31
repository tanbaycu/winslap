# winSLAP - The PC Screamer 💻😱

**winSLAP** là một ứng dụng vui nhộn dành cho Windows, biến chiếc máy tính của bạn thành một "sinh vật" biết kêu la khi bị tác động vật lý (vỗ, tát vào vỏ máy).

## 🚀 Giới thiệu dự án
Dự án được truyền cảm hứng từ SlapMac, mang trải nghiệm tương tác vật lý độc đáo lên hệ điều hành Windows. WinSLAP sử dụng engine xử lý âm thanh và cảm biến để nhận diện các cú "tát" hoặc va chạm vào thân máy, sau đó phát ra âm thanh tiếng hét ngay lập tức.

## 🛠 Cách hoạt động
Hiện tại, WinSLAP hoạt động dựa trên hai cơ chế chính:
1.  **Acoustic Sensing (Cảm biến âm thanh)**: Sử dụng Microphone để lắng nghe các tần số âm thanh đặc trưng khi có va chạm vật lý vào vỏ máy. Dữ liệu âm thanh được xử lý qua Python engine để phân biệt giữa tiếng động môi trường và tiếng va chạm thực sự.
2.  **Hybrid Engine**: Kết hợp giữa giao diện React/Vite (Frontend) và Python (Backend logic) để tối ưu hóa hiệu suất xử lý tín hiệu thời gian thực.

## ⚡ Các tính năng chính
-   **PC & Mobile Support**: Hỗ trợ cảm biến âm thanh (PC) và cảm biến gia tốc (Mobile). Nhận diện thiết bị nào để dùng cảm biến phù hợp.
-   **Customizable**: Cho phép điều chỉnh độ nhạy để phù hợp với từng môi trường.
-   **Auto-Build Workflow**: Tự động build ra bản `.zip` (source code), `.exe` (Windows) và `.apk` (Android) qua GitHub Actions mỗi khi push code lên!

## 🚧 Kế hoạch tương lai
-   **Calibration Tool**: Công cụ tự động cân chỉnh ngưỡng nhạy dựa trên môi trường thực tế của người dùng.

## 📦 Cài đặt & Sử dụng
Bạn không cần phải cài đặt phức tạp hay biết code web!
1.  **Dành cho PC (Windows):** Truy cập vào mục **[Actions](https://github.com/tanbaycu/winslap/actions)** hoặc **Releases** của GitHub, tìm phiên bản mới nhất và tải xuống tệp `winSLAP-Setup.exe`. Cài đặt và mở lên như phần mềm bình thường.
2.  **Dành cho Điện thoại (Android):** Ứng dụng gốc (Native) Android được phát triển tối ưu riêng với cảm biến gia tốc để ghi nhận lực chuẩn xác ngay trên phần cứng của smartphone. Tải tệp `.apk` được build sẵn tại mục **Actions** và cài đặt trực tiếp vào điện thoại.

*(Quá trình build tự động qua Actions có thể mất vài phút cho mỗi phiên bản mã nguồn cập nhật).*

---
*Dự án được phát triển với tình yêu (và một chút bạo lực với phần cứng).*
