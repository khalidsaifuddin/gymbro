# Proses video workout di perangkat pengguna

Gymbro memproses video kamera langsung di browser untuk MVP web dan tidak mengunggah video ke backend. Pilihan ini mengurangi kebutuhan penyimpanan server dibanding analisis video di server, tetapi mengharuskan validasi performa dan kompatibilitas model di perangkat pengguna. Backend Go menyimpan hasil workout; perekaman mati secara default dan video yang dipilih untuk disimpan berada di perangkat pengguna.
