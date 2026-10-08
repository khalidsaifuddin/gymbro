# Sumber dan lisensi MediaPipe

Library `@mediapipe/tasks-vision` 1.1.0 dan model pose BlazePose GHUM memakai Apache License 2.0. MediaPipe dikembangkan Google LLC. Salinan license tersedia di `frontend/assets/licenses/mediapipe-Apache-2.0.txt` dan ikut disiapkan bersama aset distribusi lokal. Library npm mempertahankan integrity pada lockfile.

Model card resmi: [BlazePose GHUM 3D](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf), bagian “LICENSED UNDER” menyebut Apache License, Version 2.0. Dokumentasi source MediaPipe commit `f6988c4769278bde600efd488dfc8645432dc92b`, `docs/solutions/pose.md`, menjelaskan detector-tracker BlazePose dan GHUM Full/Lite/Heavy.

Model kandidat Gymbro adalah bundle Full float16 v1 dari `mediapipe-models`, dipin dalam `model-manifest.json`. SHA-256 dihitung dari distribusi resmi ber-HTTPS dan diverifikasi pada setiap instalasi selanjutnya; checksum ini bukan tanda tangan publisher. Bundle berisi `pose_detector.tflite` dan `pose_landmarks_detector.tflite`, 9398198 bytes.

Tidak ada tagihan API per frame. Penggunaan kamera dan inferensi terjadi di browser pengguna. Pengujian performa/akurasi Gymbro tetap terpisah dari metrik pose estimation pada model card.
