let audioContext;
let processor;
let inputNode;
let analyserNode;
let microphoneStream;
let mp3Encoder;
let mp3DataChunks = [];

let timerInterval;
let recordingSeconds = 0; 

const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');
const resetButton = document.getElementById('resetBtn');
const statusText = document.getElementById('status');
const timerDisplay = document.getElementById('timer');
const volumeFillBar = document.getElementById('volumeFill');
const resultArea = document.getElementById('resultArea');
const audioPlayer = document.getElementById('audioPreview');
const downloadLink = document.getElementById('downloadLink');

function startTimer() {
    recordingSeconds = 0;
    timerDisplay.innerText = "00:00";
    
    timerInterval = setInterval(() => {
        recordingSeconds++;
        
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');
        
        timerDisplay.innerText = `${formattedMinutes}:${formattedSeconds}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateVolumeDisplay() {
    if (!analyserNode) return;
    
    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(frequencyData);
    
    const sum = frequencyData.reduce((total, value) => total + value, 0);
    const averageVolume = sum / frequencyData.length;
    
    const volumePercentage = Math.min(100, (averageVolume / 100) * 100);
    
    volumeFillBar.style.width = volumePercentage + "%";
    
    if (microphoneStream && microphoneStream.active) {
        requestAnimationFrame(updateVolumeDisplay);
    }
}

function processAudioData(audioEvent) {
    const audioData = audioEvent.inputBuffer.getChannelData(0);
    
    const audioDataInt16 = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        audioDataInt16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    const mp3Buffer = mp3Encoder.encodeBuffer(audioDataInt16);
    
    if (mp3Buffer.length > 0) {
        mp3DataChunks.push(mp3Buffer);
    }
}

async function handleStartRecording() {
    try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
        });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ 
            sampleRate: 44100 
        });

        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        
        inputNode = audioContext.createMediaStreamSource(microphoneStream);
        inputNode.connect(analyserNode);

        mp3Encoder = new lamejs.Mp3Encoder(1, 44100, 128);
        mp3DataChunks = [];

        processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = processAudioData;

        inputNode.connect(processor);
        processor.connect(audioContext.destination);

        startTimer();
        updateVolumeDisplay();
        
        updateUIState('recording');
        
    } catch (error) {
        alert("Akses Mikrofon Ditolak! Pastikan Anda mengizinkan akses mikrofon.");
        console.error('Error:', error);
    }
}

function handleStopRecording() {
    stopTimer();
    
    const finalBuffer = mp3Encoder.flush();
    if (finalBuffer.length > 0) {
        mp3DataChunks.push(finalBuffer);
    }

    const mp3Blob = new Blob(mp3DataChunks, { type: 'audio/mp3' });
    
    const audioURL = URL.createObjectURL(mp3Blob);

    audioPlayer.src = audioURL;
    
    const timestamp = new Date().getTime();
    downloadLink.href = audioURL;
    downloadLink.download = `Tugas_Speaking_${timestamp}.mp3`;

    microphoneStream.getTracks().forEach(track => track.stop());
    
    processor.disconnect();
    inputNode.disconnect();

    updateUIState('finished');
}

function handleResetRecording() {
    updateUIState('ready');
    
    timerDisplay.innerText = "00:00";
    
    volumeFillBar.style.width = "0%";
    
    audioPlayer.src = "";
}

function updateUIState(state) {
    if (state === 'recording') {
        startButton.disabled = true;
        stopButton.disabled = false;
        resetButton.disabled = true;
        statusText.innerText = "🔴 Merekam...";
        resultArea.style.display = 'none';
        
    } else if (state === 'finished') {
        startButton.disabled = true;
        stopButton.disabled = true;
        resetButton.disabled = false;
        statusText.innerText = "✅ Rekaman Tersedia";
        resultArea.style.display = 'block';
        volumeFillBar.style.width = "0%";
        
    } else {
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = true;
        statusText.innerText = "Siap Merekam";
        resultArea.style.display = 'none';
    }
}

startButton.onclick = handleStartRecording;
stopButton.onclick = handleStopRecording;
resetButton.onclick = handleResetRecording;