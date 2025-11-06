# Playback Transcription Mode - User Guide

## Date: 2025-11-06

## What is Playback Transcription?

Playback transcription allows you to transcribe audio from external sources (like recorded consultations, audio files playing on speakers, or other devices) by capturing the audio through your microphone.

## How It Works

### Technical Flow:
1. **Microphone Captures Audio** → Your device's microphone picks up audio from external speakers
2. **Web Speech API Processes** → Browser's speech recognition transcribes the audio in real-time
3. **Auto-Correction Applied** → Medical terminology is automatically corrected
4. **Saved to Database** → Transcripts are saved in chunks to the session

### Key Features:
- ✅ **All English Accents Supported**: US, UK, Australian, Indian, and all other English dialects
- ✅ **Real-Time Processing**: Transcription happens as audio plays
- ✅ **Medical Terminology**: Auto-corrects common medical terms
- ✅ **Speaker Detection**: Attempts to identify speakers based on voice patterns
- ✅ **Continuous Recording**: Supports long sessions (5+ minutes)

## How to Use Playback Transcription

### Step 1: Select Playback Mode
1. Go to the recording session page
2. Look for the **"Recording Input Mode"** toggle
3. Switch from **"Direct"** to **"Playback"**

### Step 2: Setup Your Audio
1. **Place your speakers near the microphone** (optimal distance: 6-12 inches)
2. **Set volume to medium-high** (60-80% volume)
3. **Minimize background noise** (close windows, turn off fans)
4. **Test audio quality**: Play a short clip and check if microphone picks it up

### Step 3: Start Transcribing
1. Click **"Start Transcribing"**
2. Wait for confirmation message: *"Playback transcription active - play audio near your microphone"*
3. **Start playing your audio file/recording**
4. Watch the transcript appear in real-time

### Step 4: Monitor & Adjust
- **Watch the audio level indicator** - should show activity when audio plays
- **Check transcript quality** - if poor, adjust volume or distance
- **Speaker detection** - will automatically attempt to identify different speakers

## Troubleshooting

### ❌ No Transcription Appearing

**Possible Causes:**
1. **Microphone not picking up audio**
   - Solution: Increase speaker volume
   - Solution: Move speakers closer to microphone
   - Solution: Check microphone permissions

2. **Audio quality too poor**
   - Solution: Reduce background noise
   - Solution: Use better speakers
   - Solution: Increase audio clarity

3. **Wrong language selected**
   - Solution: Make sure "English" is selected
   - Solution: Default is en-US (supports all English accents)

4. **Browser doesn't support Web Speech API**
   - Solution: Use Chrome, Edge, or Safari (recommended: Chrome)

### ❌ Component Keeps Reloading

**Fixed in Latest Update:**
- Stabilized component initialization
- Removed unnecessary re-renders
- Voice characteristics sync optimized

### ❌ Voice Analyzer Errors

**Now Non-Critical:**
- Voice analyzer failures won't stop transcription
- System continues with basic speaker detection
- Errors are logged but don't break functionality

## Best Practices

### For Best Results:

1. **Audio Quality**
   - Use high-quality speakers
   - Clear audio files (no heavy compression)
   - Minimize echo and reverb

2. **Environment**
   - Quiet room
   - No competing audio sources
   - Good microphone (built-in or external)

3. **Playback Settings**
   - Medium-high volume (60-80%)
   - Normal playback speed (1x)
   - Pause between speakers if possible

4. **Session Management**
   - Start with short test clips
   - Monitor first few minutes
   - Adjust setup before long sessions

## Console Log Indicators

### ✅ Success Indicators:
```
🎙️ Starting Web Speech API transcription for playback mode...
✅ Real-time transcription started successfully
🔊 PLAYBACK MODE INSTRUCTIONS:
   1. Play your audio file on external speakers
   2. Make sure microphone can hear the speakers clearly
   3. Adjust volume to medium-high level
   4. Minimize background noise
💬 Transcript chunk #1 from provider: Hello, how are you feeling today?
```

### ⚠️ Non-Critical Warnings:
```
⚠️ Voice analyzer not available, skipping interval analysis
```

### ❌ Critical Errors:
```
❌ Microphone permission denied
❌ No microphone found
❌ Transcription not supported in this browser
```

## Technical Specifications

### Audio Processing:
- **Sample Rate**: 48kHz (default) or 24kHz (configurable)
- **Format**: PCM16, Mono channel
- **Echo Cancellation**: Enabled (aggressive in playback mode)
- **Noise Suppression**: Enabled (strong in playback mode)
- **Auto Gain Control**: Enabled (adaptive in playback mode)

### Transcription Engine:
- **Engine**: Web Speech API (browser-native)
- **Language**: en-US (supports all English accents)
- **Continuous Mode**: Yes
- **Interim Results**: Yes (real-time updates)
- **Max Alternatives**: 5 (chooses best medical match)

### Speaker Detection:
- **Method**: Pitch-based analysis + pause detection
- **Confidence Threshold**: 60% (playback mode) vs 75% (direct mode)
- **Update Interval**: 300ms
- **Fallback**: Time-gap based switching

## Performance Metrics

- **Transcription Latency**: < 1 second
- **Speaker Detection Delay**: 1-5 seconds (adaptive)
- **Memory Usage**: Optimized for 5+ minute sessions
- **Chunk Processing**: Every 100ms
- **Auto-Save**: Every 5 chunks or 3 seconds

## Comparison: Direct vs Playback Mode

| Feature | Direct Mode | Playback Mode |
|---------|-------------|---------------|
| Audio Source | Your voice → Microphone | Speakers → Microphone |
| Voice Quality | Optimal | Depends on setup |
| Echo Cancel | Standard | Aggressive |
| Noise Suppress | Standard | Strong |
| Confidence Threshold | 75% | 60% (more lenient) |
| Use Case | Live consultations | Recorded audio |

## Known Limitations

1. **Audio Quality Dependency**
   - Playback transcription quality heavily depends on:
     * Speaker quality
     * Microphone quality
     * Room acoustics
     * Background noise

2. **Speaker Separation**
   - Speaker detection is less accurate than direct mode
   - May require manual correction

3. **Accent Recognition**
   - While all English accents are supported, clarity matters
   - Heavy accents + poor audio = lower accuracy

4. **Real-Time Only**
   - Cannot process pre-recorded files directly
   - Must play audio and capture through microphone
   - Consider using Upload Audio feature for direct file transcription

## Alternative: Upload Audio Feature

For better quality transcription of pre-recorded files:

1. **Go to "Upload Audio" tab**
2. **Upload your audio file directly** (.mp3, .wav, .m4a)
3. **System processes with advanced API** (AssemblyAI or OpenAI Whisper)
4. **Get speaker-separated transcription** with medical entity detection

**Advantages:**
- Higher accuracy
- Direct file processing (no microphone needed)
- Advanced speaker diarization
- Medical entity detection
- Better with multiple speakers

## Status

- ✅ **Playback Mode**: Fully functional
- ✅ **Real-Time Transcription**: Working
- ✅ **Multi-Accent Support**: en-US default
- ✅ **Component Stability**: Fixed
- ✅ **Error Handling**: Graceful fallbacks
- ✅ **Voice Analysis**: Non-critical (optional)

## Recent Fixes (2025-11-06)

1. ✅ Fixed component remounting issues
2. ✅ Stabilized voice characteristics sync
3. ✅ Removed voice analyzer null warnings
4. ✅ Enhanced playback mode instructions
5. ✅ Added detailed console logging
6. ✅ Multi-accent support (en-US)

---

**Last Updated**: 2025-11-06  
**Version**: 2.0 (Playback Mode Enhanced)
