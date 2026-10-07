# Simple Plant Disease Checker (PKM-KC Kelompok 12)

Frontend: HTML/CSS/JS | Backend: Node.js + Express | Data: data.json

## Menjalankan
1. Pasang Node.js 18+ (nodejs.org)
2. Di folder ini:  npm install  lalu  npm start
3. Buka http://localhost:3000 -> Daftar -> upload foto daun -> Analisis daun

Opsional: SECRET="kata-rahasia-panjang" PORT=3000 npm start

## Catatan penting: analisis masih prototipe
Fungsi analyzeImage() di public/app.js memakai analisis warna piksel (hijau/kuning/cokelat),
BUKAN model CNN. Hasilnya hanya estimasi kasar.

## Mengganti dengan model CNN sungguhan
- Latih model (mis. dataset PlantVillage) dengan TensorFlow/Keras atau PyTorch.
- Opsi A: ekspor ke TensorFlow.js dan panggil di app.js menggantikan analyzeImage().
- Opsi B: jalankan model sebagai layanan Python (Flask/FastAPI), lalu buat endpoint
  POST /api/predict di server.js yang meneruskan gambar ke layanan itu.
- Keluaran yang diharapkan: { condition, confidence, info }.
"# leaf12" 
