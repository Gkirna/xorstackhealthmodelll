import { useState, useEffect } from 'react';

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export function useMicrophoneSelection() {
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('default');
  const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Get available microphones
  useEffect(() => {
    const getMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.substring(0, 5)}`,
            groupId: device.groupId,
          }));
        
        setMicrophones(audioInputs);
        
        // Set default microphone if available
        if (audioInputs.length > 0 && !selectedMicId) {
          setSelectedMicId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting microphones:', error);
      }
    };

    getMicrophones();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getMicrophones);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getMicrophones);
    };
  }, []);

  // Monitor audio levels
  useEffect(() => {
    if (!isMonitoring || !selectedMicId) return;

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let microphone: MediaStreamAudioSourceNode;
    let animationId: number;
    let stream: MediaStream;

    const startMonitoring = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMicId }
        });

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevels = () => {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalized = Math.min(100, (average / 255) * 100);
          
          // Generate 5 bars with some randomness for visual effect
          const newLevels = Array.from({ length: 5 }, (_, i) => {
            const baseHeight = normalized;
            const variance = Math.random() * 20 - 10;
            return Math.max(20, Math.min(100, baseHeight + variance + (i * 5)));
          });
          
          setAudioLevels(newLevels);
          animationId = requestAnimationFrame(updateLevels);
        };

        updateLevels();
      } catch (error) {
        console.error('Error monitoring audio:', error);
        setIsMonitoring(false);
      }
    };

    startMonitoring();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContext) audioContext.close();
    };
  }, [isMonitoring, selectedMicId]);

  const startMonitoring = () => setIsMonitoring(true);
  const stopMonitoring = () => {
    setIsMonitoring(false);
    setAudioLevels([0, 0, 0, 0, 0]);
  };

  return {
    microphones,
    selectedMicId,
    setSelectedMicId,
    audioLevels,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
}
