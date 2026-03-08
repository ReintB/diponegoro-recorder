let audioContext, processor, input, stream, mp3Encoder, analyser;
let mp3Data = [];
let timerInterval;
let seconds = 0;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const statusText = document.getElementById('status');
const timerDisplay = document.getElementById('timer');
const volumeFill = document.getElementById('volumeFill');
const resultArea = document.getElementById('resultArea');
const audioPreview = document.getElementById('audioPreview');
const downloadLink = document.getElementById('downloadLink');

// --- Fungsi Timer ---
function runTimer() {
    seconds = 0;
    timerDisplay.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${m}:${s}`;
    }, 1000);
}

// --- Fungsi Monitoring Volume ---
function monitorVolume() {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const volume = Math.min(100, (average / 100) * 100);
    volumeFill.style.width = volume + "%";
    if (stream && stream.active) requestAnimationFrame(monitorVolume);
}

// --- Event Handlers ---
startBtn.onclick = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        input = audioContext.createMediaStreamSource(stream);
        input.connect(analyser);

        mp3Encoder = new lamejs.Mp3Encoder(1, 44100, 128);
        mp3Data = [];

        processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
            const left = e.inputBuffer.getChannelData(0);
            const leftInt16 = new Int16Array(left.length);
            for (let i = 0; i < left.length; i++) {
                leftInt16[i] = left[i] < 0 ? left[i] * 0x8000 : left[i] * 0x7FFF;
            }
            const mp3buffer = mp3Encoder.encodeBuffer(leftInt16);
            if (mp3buffer.length > 0) mp3Data.push(mp3buffer);
        };

        input.connect(processor);
        processor.connect(audioContext.destination);

        // UI Update
        runTimer();
        monitorVolume();
        toggleButtons('recording');
    } catch (err) {
        alert("Akses Mikrofon Ditolak!");
    }
};

stopBtn.onclick = () => {
    clearInterval(timerInterval);
    const lastBuffer = mp3Encoder.flush();
    if (lastBuffer.length > 0) mp3Data.push(lastBuffer);

    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);

    audioPreview.src = url;
    downloadLink.href = url;
    downloadLink.download = `Tugas_Speaking_${new Date().getTime()}.mp3`;

    stream.getTracks().forEach(track => track.stop());
    processor.disconnect();
    input.disconnect();

    toggleButtons('finished');
};

resetBtn.onclick = () => {
    toggleButtons('ready');
    timerDisplay.innerText = "00:00";
    volumeFill.style.width = "0%";
    audioPreview.src = "";
};

function toggleButtons(state) {
    if (state === 'recording') {
        startBtn.disabled = true; stopBtn.disabled = false; resetBtn.disabled = true;
        statusText.innerText = "🔴 Merekam...";
        resultArea.style.display = 'none';
    } else if (state === 'finished') {
        startBtn.disabled = true; stopBtn.disabled = true; resetBtn.disabled = false;
        statusText.innerText = "✅ Rekaman Tersedia";
        resultArea.style.display = 'block';
        volumeFill.style.width = "0%";
    } else {
        startBtn.disabled = false; stopBtn.disabled = true; resetBtn.disabled = true;
        statusText.innerText = "Siap Merekam";
        resultArea.style.display = 'none';
    }
}