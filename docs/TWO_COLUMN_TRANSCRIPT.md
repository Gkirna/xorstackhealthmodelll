# Two-Column Transcript Display

## Overview
The transcript display has been updated to show Doctor and Patient speech in separate columns for better readability during live transcription.

## What Changed

### 1. **Updated HeidiTranscriptPanel Component**
- **Location:** `src/components/session/HeidiTranscriptPanel.tsx`
- **Changes:**
  - Added support for `transcriptChunks` prop
  - Separates chunks by speaker (provider/patient)
  - Displays Doctor and Patient in side-by-side columns
  - Maintains backward compatibility with old `transcript` prop

### 2. **Updated SessionRecord Integration**
- **Location:** `src/pages/SessionRecord.tsx`
- **Changes:**
  - Passes `transcriptChunks` prop to HeidiTranscriptPanel
  - Preserves existing functionality while enabling two-column view

## UI Design

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Word Count · Char Count              [Undo] [Redo] [Copy] │
├─────────────────────┬─────────────────────────────────────┤
│  🩺 Doctor (5 chunks) │  👤 Patient (3 chunks)             │
├─────────────────────┼─────────────────────────────────────┤
│                     │                                       │
│  Doctor's speech    │  Patient's responses                 │
│  transcribed here   │  transcribed here                     │
│                     │                                       │
│  + More content     │  + More content                       │
│                     │                                       │
└─────────────────────┴─────────────────────────────────────┘
```

### Visual Features
- **Doctor Column:**
  - Blue color scheme (`bg-blue-50`, `border-blue-200`)
  - Stethoscope icon
  - Displays speech from `provider` speaker

- **Patient Column:**
  - Green color scheme (`bg-green-50`, `border-green-200`)
  - User icon
  - Displays speech from `patient` speaker

### Color Coding
- **Doctor:** Blue theme (`#eff6ff` background, `#bfdbfe` border)
- **Patient:** Green theme (`#f0fdf4` background, `#bbf7d0` border)

## Technical Implementation

### Component Props
```typescript
interface HeidiTranscriptPanelProps {
  transcriptChunks?: TranscriptChunk[];  // NEW: Array of chunks with speaker info
  transcript?: string;                    // OLD: Backward compatibility
  onTranscriptChange?: (text: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}
```

### Data Structure
```typescript
interface TranscriptChunk {
  id: string;
  session_id: string;
  text: string;
  speaker: string;          // 'provider' or 'patient'
  timestamp_offset?: number;
  created_at: string;
  temp?: boolean;          // Temporary chunks before DB save
  pending?: boolean;        // Pending save status
}
```

### Speaker Separation Logic
```typescript
// Filter chunks by speaker
const doctorChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'provider');
const patientChunks = transcriptChunks?.filter(chunk => chunk.speaker === 'patient');

// Format for display
const doctorText = doctorChunks.map(chunk => chunk.text).join('\n\n');
const patientText = patientChunks.map(chunk => chunk.text).join('\n\n');
```

## Backward Compatibility

The component maintains backward compatibility:
1. **If `transcriptChunks` is provided:** Shows two-column layout
2. **If only `transcript` string is provided:** Shows single-column layout (original behavior)

This ensures existing code continues to work while enabling the new two-column feature.

## Features

### 1. Real-Time Updates
- Doctor and Patient transcripts update in real-time as speech is transcribed
- Each column shows only the relevant speaker's content

### 2. Chunk Counting
- Each column header shows the number of chunks for that speaker
- Updates automatically as new chunks are added

### 3. Read-Only Display
- Both textareas are read-only to maintain data integrity
- Transcripts are managed through the transcription system

### 4. Word/Character Count
- Shows total word and character count across both speakers
- Located in the top toolbar

### 5. Visual Distinction
- Color-coded backgrounds for quick identification
- Icons (Stethoscope for Doctor, User for Patient)
- Distinct border colors

## Usage

### In SessionRecord Component
```typescript
const { transcriptChunks } = useTranscription(sessionId);

<HeidiTranscriptPanel
  transcriptChunks={transcriptChunks}  // Array of chunks
  transcript={transcript}              // Fallback string
  onTranscriptChange={setTranscript}
/>
```

### Speaker Assignment
Chunks are assigned to speakers based on the `speaker` property:
- `speaker: 'provider'` → Doctor column
- `speaker: 'patient'` → Patient column

### Adding Speaker Labels
When adding transcript chunks in `handleTranscriptUpdate`:
```typescript
const currentSpeaker = speakerRef.current; // 'provider' or 'patient'
addTranscriptChunk(text, currentSpeaker);
```

## Responsive Design

The two-column layout uses CSS Grid:
```css
grid-cols-2 gap-4
```

- **Desktop:** Two equal columns (50% width each)
- **Tablet:** Two columns with responsive gaps
- **Mobile:** Could be modified to stack vertically if needed

## Testing

### Test Cases
1. ✅ Start recording - verify both columns populate
2. ✅ Alternate speakers - verify chunks go to correct columns
3. ✅ Stop recording - verify all chunks displayed
4. ✅ Load existing session - verify chunks from DB display correctly
5. ✅ Copy function - verify includes both speakers' text

### Manual Testing
```bash
# 1. Start a recording session
# 2. Speak as doctor
# 3. Verify text appears in blue Doctor column
# 4. Switch to patient speaker
# 5. Speak as patient
# 6. Verify text appears in green Patient column
# 7. Check chunk counts update
```

## Future Enhancements

Potential improvements:
1. **Vertical scrolling sync** - Keep both columns in view
2. **Timeline view** - Show conversation flow with timestamps
3. **Speaker switching indicator** - Visual cue when speaker changes
4. **Export formatting** - Different formats for each speaker
5. **Search per column** - Search within specific speaker text
6. **Resizable columns** - Allow user to adjust column widths
7. **Mobile responsiveness** - Stack columns on small screens

## Benefits

1. **Better Readability:** Separate speakers for easier reading
2. **Visual Clarity:** Color coding helps identify speakers quickly
3. **Conversation Flow:** See the dialogue structure at a glance
4. **Professional Presentation:** Clean, organized layout
5. **Data Integrity:** Maintains proper speaker attribution

## Migration Notes

### For Existing Sessions
- Existing sessions will display in the new two-column format
- All chunks are properly separated by speaker attribute
- No data migration required

### For New Sessions
- Automatically uses two-column layout
- Speaker alternation works with existing logic
- Real-time updates work seamlessly

## Screenshots

### Visual Layout
- Doctor column: Blue header with stethoscope icon
- Patient column: Green header with user icon
- Both columns show chunk count in header
- Responsive grid layout

## Summary

The two-column transcript display provides a cleaner, more organized view of conversations with clear visual separation between Doctor and Patient speech. The implementation is backward-compatible and integrates seamlessly with the existing transcription system.

