// All text the user sees, in Malay. Never hard-code user-facing strings elsewhere.
// Caregivers: please check the wording sounds natural.
export const STRINGS = Object.freeze({
  appTitle: 'WOCA',
  welcome: 'Selamat datang',
  ready: 'Sedia',
  paused: 'Dijeda',
  pausedHint: 'Pejam mata 3 saat untuk sambung semula.',
  pausedHintCaregiver: 'Penjaga: tekan P untuk sambung.',
  faceNotVisible: 'Wajah tidak kelihatan',
  yes: 'Ya',
  no: 'Tidak',

  cameraStarting: 'Membuka kamera…',
  cameraOn: 'Kamera aktif',
  retry: 'Cuba lagi',
  modelLoading: 'Memuatkan pengesan wajah…',
  modelFailed: 'Pengesan wajah gagal dimuatkan. Muat semula halaman.',
  modelReady: 'Pengesan wajah sedia',
  faceVisible: 'Wajah dikesan',

  // Boards
  board: Object.freeze({
    back: 'Kembali',
    yesNoHint: 'Pusing kepala untuk jawab. Kelip lama untuk kembali.',
    scanHint: 'Tunggu petak yang diserlahkan, kemudian kelip lama untuk memilih.',
  }),

  // Status banners over the board
  faceLostHint: 'Penjaga: betulkan kamera atau kedudukan kepala.',
  breakTitle: 'Rehat sekejap?',
  breakHint: 'Pejam mata 3 saat untuk rehat.',

  // Call for help (alarm). Caregivers: please check the wording.
  help: Object.freeze({
    spoken: 'Tolong datang ke sini. Saya perlukan bantuan.',
    title: 'Perlukan bantuan!',
    dismiss: 'Saya datang (Space)',
    hint: 'Penjaga: tekan Space atau klik butang untuk hentikan.',
  }),

  // Settings screen (for caregivers). Caregivers: please check the wording.
  settings: Object.freeze({
    open: 'Tetapan (S)',
    title: 'Tetapan',
    save: 'Simpan',
    cancel: 'Batal',
    reset: 'Kembali ke asal',
    resetConfirm: 'Kembalikan semua tetapan dan frasa ke asal? (Kalibrasi tidak berubah.)',
    recalibrateNote: 'Jika anda menukar gerakan, jalankan Kalibrasi (K) selepas menyimpan.',
    rowNote: 'Papan ada paling banyak 2 baris, jadi satu gerakan "Tukar baris" sudah cukup. Elakkan "Pandang ke bawah": ia mudah tertukar dengan kelip lama.',
    savedReload: 'Disimpan. Memuat semula…',
    none: 'Tiada',
    tabs: Object.freeze({ gestures: 'Gerakan', timing: 'Kepekaan', voice: 'Suara', phrases: 'Frasa', backup: 'Sandaran' }),
    events: Object.freeze({
      LEFT: 'Gerak ke kiri', RIGHT: 'Gerak ke kanan', SELECT: 'Pilih', PAUSE: 'Jeda / sambung',
      HELP: 'Panggil bantuan (dari semua skrin)', BACK: 'Kembali',
      UP: 'Tukar baris (atas / bawah)', DOWN: 'Tukar baris juga (biasanya tidak perlu)',
    }),
    gestures: Object.freeze({
      headLeft: 'Pusing kepala ke kiri', headRight: 'Pusing kepala ke kanan', headUp: 'Dongak kepala',
      headDown: 'Tunduk kepala', eyesLeft: 'Jeling ke kiri', eyesRight: 'Jeling ke kanan',
      eyesUp: 'Pandang ke atas', eyesDown: 'Pandang ke bawah', longBlink: 'Kelip lama (1 saat)',
      eyesClosed3s: 'Pejam mata 3 saat', smile: 'Senyum (tidak disyorkan)',
    }),
    fields: Object.freeze({
      thresholdPct: 'Kepekaan (lebih rendah = lebih mudah dikesan)',
      closedThresholdPct: 'Kelip lama: mata mesti tertutup sekurang-kurangnya',
      holdMs: 'Masa tahan untuk memilih',
      cooldownMs: 'Rehat antara dua pilihan',
      longBlinkMs: 'Kelip lama: sekurang-kurangnya',
      'eventHoldMs.HELP': 'Masa tahan untuk panggil bantuan',
      'expressionGuard.enabled': 'Abaikan pergerakan semasa ketawa atau bercakap',
      'voice.name': 'Suara',
      'voice.rate': 'Kelajuan suara',
      'help.volume': 'Kekuatan bunyi penggera',
      'board.yesSide': '"Ya" di sebelah',
      'board.tileColors': 'Warna pada petak (mengikut jenis)',
      'board.simpleMode': 'Mod mudah (3 petak besar sekali pandang)',
      'scan.enabled': 'Imbasan automatik (hanya kelip lama untuk memilih)',
      'scan.stepMs': 'Masa pada setiap petak (imbasan)',
      'scan.speakTiles': 'Imbasan bersuara (sebut setiap petak)',
      'board.returnHomeMs': 'Kembali ke papan Utama selepas',
      'breakReminder.afterMin': 'Peringatan rehat selepas',
    }),
    sides: Object.freeze({ left: 'Kiri', right: 'Kanan' }),
    voiceAuto: 'Automatik (suara Bahasa Melayu)',
    errors: Object.freeze({
      invalid: 'Nilai tidak sah.',
      duplicate: 'Gerakan ini sudah digunakan untuk tugas lain.',
      required: 'Tugas ini perlukan satu gerakan.',
      boards: 'Frasa tidak sah. Semak tab Frasa.',
      saveFailed: 'Tidak dapat disimpan.',
    }),
    phrases: Object.freeze({
      home: 'Utama', label: 'Nama', icon: 'Ikon', say: 'Ayat yang disebut',
      add: '+ Tambah frasa', remove: 'Buang', full: 'Papan ini sudah penuh (maksimum 6 petak).',
    }),
    backup: Object.freeze({
      note: 'Simpan fail sandaran di tempat selamat, contohnya pemacu USB.',
      export: 'Muat turun sandaran',
      import: 'Pulihkan dari fail sandaran',
      importOk: 'Sandaran dipulihkan. Memuat semula…',
      importErrors: Object.freeze({
        notJson: 'Fail ini bukan fail sandaran.',
        notBackup: 'Fail ini bukan sandaran WOCA.',
        invalid: 'Fail sandaran rosak atau tidak lengkap.',
      }),
    }),
  }),

  // Speller (Eja)
  speller: Object.freeze({
    actions: 'Aksi',
    suggestions: 'Cadangan',
    speak: 'Sebut',
    space: 'Ruang',
    delete: 'Padam',
    exit: 'Keluar',
    back: 'Kembali',
    empty: 'Pilih huruf…',
  }),

  // Start screen: browsers only allow sound after one click/keypress
  start: Object.freeze({
    button: 'Mula',
    hint: 'Penjaga: klik Mula (atau tekan Enter) untuk mengaktifkan suara.',
  }),

  // Speech
  speech: Object.freeze({
    testButton: 'Uji suara (T)',
    testPhrase: 'Saya nak minum air.',
    voiceOffline: (name) => `Suara: ${name} (luar talian)`,
    voiceOnline: (name) => `Suara: ${name}. Amaran: suara ini perlukan internet.`,
    noMalayVoice:
      'Tiada suara Bahasa Melayu. Pasang di Tetapan → Masa & bahasa → Bahasa & rantau → Bahasa Melayu (Pertuturan).',
    noSpeech: 'Pelayar ini tidak boleh bercakap. Teks akan dipaparkan sahaja.',
  }),

  // Re-centre after the bed angle changes
  recentre: Object.freeze({
    button: 'Tengahkan (C)',
    instruction: 'Pandang skrin dan jangan bergerak.',
    done: 'Berjaya ditengahkan.',
    hint: 'Kedudukan berubah? Tekan C untuk tengahkan semula.',
    failures: Object.freeze({
      noFace: 'Wajah tidak kelihatan. Betulkan kamera, kemudian tekan C semula.',
      moving: 'Kepala bergerak. Pandang skrin dan diam, kemudian tekan C semula.',
      saveFailed: 'Tidak dapat disimpan. Tekan C semula.',
    }),
  }),

  // Calibration wizard (caregiver reads it aloud; the user sees the big instruction)
  calibration: Object.freeze({
    open: 'Kalibrasi',
    title: 'Kalibrasi',
    intro:
      'WOCA akan belajar pergerakan pengguna. Ikut arahan pada skrin. Setiap langkah ada kiraan detik sebelum bermula.',
    start: 'Mula',
    cancel: 'Batal',
    getReady: 'Bersedia…',
    recording: 'Sedang merakam',
    retry: 'Cuba lagi',
    skip: 'Langkau',
    next: 'Seterusnya',
    save: 'Simpan',
    saved: 'Kalibrasi disimpan.',
    saveFailed: 'Kalibrasi tidak dapat disimpan.',
    lastAt: (when) => `Kalibrasi terakhir: ${when}`,
    notCalibrated: 'Belum dikalibrasi (nilai lalai digunakan)',
    detected: (n) => `Berjaya: ${n} kali dikesan.`,
    restOk: 'Berjaya: kedudukan rehat direkod.',
    stepOf: (i, n) => `Langkah ${i} daripada ${n}`,
    summary: 'Ringkasan',
    keptOld: 'dilangkau (nilai lama dikekalkan)',
    failures: Object.freeze({
      noFace: 'Wajah tidak kelihatan dengan jelas. Betulkan kedudukan kamera, kemudian cuba lagi.',
      tooSmall: 'Pergerakan terlalu kecil untuk dikesan. Cuba lagi dengan pergerakan lebih besar, atau langkau.',
      notDetected: 'Pergerakan dilihat tetapi tidak cukup lama. Tahan kira-kira 1 saat setiap kali, kemudian cuba lagi.',
    }),
    labels: Object.freeze({
      headLeft: 'Kepala ke kiri',
      headRight: 'Kepala ke kanan',
      headUp: 'Kepala ke atas',
      headDown: 'Kepala ke bawah',
      eyesLeft: 'Mata ke kiri',
      eyesRight: 'Mata ke kanan',
      eyesUp: 'Mata ke atas',
      eyesDown: 'Mata ke bawah',
      eyesClosed: 'Pejam mata',
      smile: 'Senyum',
    }),
    // One instruction per step (range key). Caregivers: please check the wording.
    steps: Object.freeze({
      rest: 'Rehat dan pandang skrin. Jangan bergerak.',
      headLeft: 'Pusing kepala ke kiri, tahan 1 saat, kemudian kembali ke tengah. Buat 3 kali.',
      headRight: 'Pusing kepala ke kanan, tahan 1 saat, kemudian kembali ke tengah. Buat 3 kali.',
      headUp: 'Dongak kepala ke atas, tahan 1 saat, kemudian kembali. Buat 3 kali.',
      headDown: 'Tunduk kepala ke bawah, tahan 1 saat, kemudian kembali. Buat 3 kali.',
      eyesLeft: 'Tanpa gerak kepala, jeling ke kiri, tahan 1 saat, kemudian pandang skrin. Buat 3 kali.',
      eyesRight: 'Tanpa gerak kepala, jeling ke kanan, tahan 1 saat, kemudian pandang skrin. Buat 3 kali.',
      eyesUp: 'Tanpa gerak kepala, pandang ke atas, tahan 1 saat, kemudian pandang skrin. Buat 3 kali.',
      eyesDown: 'Tanpa gerak kepala, pandang ke bawah, tahan 1 saat, kemudian pandang skrin. Buat 3 kali.',
      eyesClosed: 'Pejam mata kira-kira 2 saat, kemudian buka. Buat 3 kali.',
      smile: 'Senyum, tahan 1 saat, kemudian rehat. Buat 3 kali.',
    }),
  }),

  // Gesture test (key G): which gesture does the user do best? Caregivers: please check the wording.
  gestureTest: Object.freeze({
    open: 'Uji gerakan',
    title: 'Uji gerakan',
    intro: 'Pilih gerakan yang mahu dicuba. Pengguna mencuba setiap gerakan 3 kali. WOCA mengira berapa kali ia dikesan dan berapa kali ia terpicu tanpa sengaja.',
    calibrateFirst: 'Belum dikalibrasi. Tekan K dahulu supaya keputusan lebih tepat.',
    start: 'Mula',
    stop: 'Berhenti',
    skip: 'Langkau gerakan ini',
    close: 'Tutup',
    again: 'Uji lagi',
    stepOf: (g, n, trial, trials) => `Gerakan ${g} daripada ${n} · Cubaan ${trial} daripada ${trials}`,
    next: (name) => `Seterusnya: ${name}`,
    now: (name) => `SEKARANG: ${name}`,
    rest: 'Rehat. Jangan bergerak.',
    hit: '✔ Dikesan',
    miss: '✘ Tidak dikesan',
    resultsTitle: 'Keputusan',
    recommend: (name) => `Paling sesuai untuk "Pilih": ${name}`,
    noneRecommended: 'Tiada gerakan yang cukup stabil. Cuba Imbasan automatik, Imbasan bersuara dan Mod mudah (Tetapan).',
    row: (name, hits, trials, avgMs, falseFires, rating) =>
      `${name}: ${hits}/${trials} dikesan${avgMs ? ` · ${(avgMs / 1000).toFixed(1)} s` : ''} · ${falseFires} tidak sengaja · ${rating}`,
    rowSkipped: (name) => `${name}: dilangkau`,
    ratings: Object.freeze({ good: 'Sangat baik', ok: 'Boleh', poor: 'Sukar' }),
    how: Object.freeze({
      longBlink: 'Pejam mata kira-kira 1 saat, kemudian buka.',
      eyesLeft: 'Tanpa gerak kepala, jeling ke kiri dan tahan, kemudian pandang skrin.',
      eyesRight: 'Tanpa gerak kepala, jeling ke kanan dan tahan, kemudian pandang skrin.',
      eyesUp: 'Tanpa gerak kepala, pandang ke atas dan tahan, kemudian pandang skrin.',
      headLeft: 'Pusing kepala ke kiri dan tahan, kemudian kembali ke tengah.',
      headRight: 'Pusing kepala ke kanan dan tahan, kemudian kembali ke tengah.',
      headUp: 'Dongak kepala dan tahan, kemudian kembali.',
      smile: 'Senyum dan tahan, kemudian rehat.',
    }),
  }),

  // Keyed by the codes from src/vision/camera.js
  cameraErrors: Object.freeze({
    denied:
      'Kebenaran kamera ditolak. Klik ikon kamera di bar alamat, pilih "Benarkan", kemudian tekan Cuba lagi.',
    notFound: 'Tiada kamera dijumpai. Sambungkan kamera USB, kemudian tekan Cuba lagi.',
    busy: 'Kamera sedang digunakan oleh aplikasi lain (contohnya Zoom atau Teams). Tutup aplikasi itu, kemudian tekan Cuba lagi.',
    unsupported: 'Pelayar ini tidak menyokong kamera. Sila guna Chrome atau Edge.',
    unknown: 'Kamera tidak dapat dibuka. Tekan Cuba lagi.',
  }),
});
