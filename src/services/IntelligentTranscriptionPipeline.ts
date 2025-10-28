/**
 * Intelligent Transcription Pipeline
 * Integrates Deepgram + GPT for complete medical transcription workflow
 * 
 * Workflow:
 * 1. Audio input → Deepgram diarization → detect speakers
 * 2. Deepgram transcription → transcribe each speaker's segment  
 * 3. GPT processing → clean text, label doctor/patient, infer gender
 * 4. Return structured output with all metadata
 */

import OpenAI from 'openai';

// API Keys - Use environment variables (fallback keys removed for security)
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface IntelligentAnalysis {
  cleanedText: string;
  role: 'doctor' | 'patient' | 'unknown';
  gender: 'male' | 'female' | 'unknown';
  confidence: number;
  medicalEntities: Array<{
    text: string;
    category: string;
    confidence: number;
  }>;
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
}

export interface StructuredOutput {
  sessionId: string;
  timestamp: number;
  speakers: Array<{
    speakerId: string;
    role: 'doctor' | 'patient' | 'unknown';
    gender: 'male' | 'female' | 'unknown';
    segments: Array<{
      startTime: number;
      endTime: number;
      originalText: string;
      cleanedText: string;
      confidence: number;
      analysis: IntelligentAnalysis;
    }>;
  }>;
  summary: {
    totalDuration: number;
    speakerCount: number;
    medicalEntitiesFound: number;
    overallSentiment: string;
    urgencyLevel: string;
  };
}

export class IntelligentTranscriptionPipeline {
  private deepgram: any = null;
  private openai: OpenAI;
  private connection: any = null;
  private isConnected = false;
  private sessionId: string;
  private speakerSegments: SpeakerSegment[] = [];
  private processedSegments: Map<string, IntelligentAnalysis> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.initializeServices();
  }

  private async initializeServices() {
    try {
      // Initialize Deepgram
      const { createClient } = await import('@deepgram/sdk');
      this.deepgram = createClient(DEEPGRAM_API_KEY);
      
      // Initialize OpenAI
      this.openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      console.log('✅ Intelligent Transcription Pipeline initialized');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Start the intelligent transcription pipeline
   */
  public async startPipeline(): Promise<boolean> {
    try {
      console.log('🚀 Starting intelligent transcription pipeline...');

      // Configure Deepgram with diarization
      const options = {
        model: 'nova-2-medical',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: true,
        diarize_version: '2023-05-22',
        multichannel: false,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      };

      this.connection = this.deepgram.listen.live(options);

      this.connection.on('Open', () => {
        console.log('✅ Deepgram connection opened');
        this.isConnected = true;
      });

      this.connection.on('Results', (data: any) => {
        this.handleDeepgramResult(data);
      });

      this.connection.on('Error', (error: any) => {
        console.error('❌ Deepgram error:', error);
        this.isConnected = false;
      });

      this.connection.on('Close', () => {
        console.log('🛑 Deepgram connection closed');
        this.isConnected = false;
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to start pipeline:', error);
      return false;
    }
  }

  /**
   * Handle Deepgram results and trigger GPT analysis
   */
  private async handleDeepgramResult(data: any) {
    try {
      const result = data.channel?.alternatives?.[0];
      if (!result) return;

      const isFinal = data.is_final;
      const confidence = result.confidence || 0;
      const text = result.transcript || '';

      if (!text.trim() || !isFinal) return;

      // Extract speaker information
      const words = result.words || [];
      if (words.length === 0) return;

      const speakerId = words[0].speaker;
      const startTime = words[0].start;
      const endTime = words[words.length - 1].end;

      // Create speaker segment
      const segment: SpeakerSegment = {
        speakerId: `speaker_${speakerId}`,
        startTime,
        endTime,
        text: text.trim(),
        confidence,
        words: words.map((word: any) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 0
        }))
      };

      this.speakerSegments.push(segment);

      // Process with GPT for intelligent analysis
      const analysis = await this.processWithGPT(segment);
      this.processedSegments.set(segment.speakerId, analysis);

      console.log('🧠 GPT Analysis completed:', {
        speakerId: segment.speakerId,
        role: analysis.role,
        gender: analysis.gender,
        confidence: analysis.confidence
      });

    } catch (error) {
      console.error('❌ Error processing Deepgram result:', error);
    }
  }

  /**
   * Process speaker segment with GPT for intelligent analysis
   */
  private async processWithGPT(segment: SpeakerSegment): Promise<IntelligentAnalysis> {
    try {
      console.log('🤖 Processing with GPT:', segment.text.substring(0, 50) + '...');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a medical transcription AI specialist. Analyze the following medical conversation segment and provide:

1. Cleaned text (fix grammar, punctuation, capitalization)
2. Role identification (doctor/patient/unknown)
3. Gender inference (male/female/unknown)
4. Medical entities (medications, conditions, procedures, symptoms)
5. Sentiment analysis (positive/negative/neutral)
6. Urgency level (low/medium/high)

Rules:
- Preserve ALL medical terminology exactly
- Use context clues for role identification
- Infer gender from speech patterns and context
- Identify medical entities with confidence scores
- Assess sentiment and urgency appropriately
- Return structured JSON response

Example response format:
{
  "cleanedText": "Patient has hypertension. Need to prescribe medication.",
  "role": "doctor",
  "gender": "male",
  "confidence": 0.95,
  "medicalEntities": [
    {"text": "hypertension", "category": "condition", "confidence": 0.9},
    {"text": "medication", "category": "treatment", "confidence": 0.8}
  ],
  "sentiment": "neutral",
  "urgency": "medium"
}`
          },
          {
            role: 'user',
            content: `Analyze this medical conversation segment:\n\n"${segment.text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysisText = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(analysisText);

      return {
        cleanedText: analysis.cleanedText || segment.text,
        role: analysis.role || 'unknown',
        gender: analysis.gender || 'unknown',
        confidence: analysis.confidence || 0.8,
        medicalEntities: analysis.medicalEntities || [],
        sentiment: analysis.sentiment || 'neutral',
        urgency: analysis.urgency || 'low'
      };

    } catch (error) {
      console.error('❌ GPT analysis failed:', error);
      
      // Fallback analysis
      return {
        cleanedText: segment.text,
        role: 'unknown',
        gender: 'unknown',
        confidence: 0.5,
        medicalEntities: [],
        sentiment: 'neutral',
        urgency: 'low'
      };
    }
  }

  /**
   * Send audio data to Deepgram
   */
  public sendAudio(audioData: ArrayBuffer): void {
    if (this.connection && this.isConnected) {
      this.connection.send(audioData);
    }
  }

  /**
   * Stop the pipeline and return structured output
   */
  public async stopPipeline(): Promise<StructuredOutput> {
    try {
      if (this.connection) {
        this.connection.finish();
        this.isConnected = false;
      }

      // Process any remaining segments
      for (const segment of this.speakerSegments) {
        if (!this.processedSegments.has(segment.speakerId)) {
          const analysis = await this.processWithGPT(segment);
          this.processedSegments.set(segment.speakerId, analysis);
        }
      }

      // Generate structured output
      const structuredOutput = this.generateStructuredOutput();
      
      console.log('✅ Pipeline completed:', {
        speakers: structuredOutput.speakers.length,
        totalDuration: structuredOutput.summary.totalDuration,
        entities: structuredOutput.summary.medicalEntitiesFound
      });

      return structuredOutput;
    } catch (error) {
      console.error('❌ Error stopping pipeline:', error);
      throw error;
    }
  }

  /**
   * Generate structured output from processed segments
   */
  private generateStructuredOutput(): StructuredOutput {
    const speakers = new Map<string, any>();

    // Group segments by speaker
    this.speakerSegments.forEach(segment => {
      const analysis = this.processedSegments.get(segment.speakerId);
      
      if (!speakers.has(segment.speakerId)) {
        speakers.set(segment.speakerId, {
          speakerId: segment.speakerId,
          role: analysis?.role || 'unknown',
          gender: analysis?.gender || 'unknown',
          segments: []
        });
      }

      speakers.get(segment.speakerId).segments.push({
        startTime: segment.startTime,
        endTime: segment.endTime,
        originalText: segment.text,
        cleanedText: analysis?.cleanedText || segment.text,
        confidence: segment.confidence,
        analysis: analysis || {
          cleanedText: segment.text,
          role: 'unknown',
          gender: 'unknown',
          confidence: 0.5,
          medicalEntities: [],
          sentiment: 'neutral',
          urgency: 'low'
        }
      });
    });

    // Calculate summary statistics
    const allSegments = Array.from(speakers.values()).flatMap(s => s.segments);
    const totalDuration = Math.max(...allSegments.map(s => s.endTime), 0);
    const allEntities = allSegments.flatMap(s => s.analysis.medicalEntities);
    const allSentiments = allSegments.map(s => s.analysis.sentiment);
    const allUrgencies = allSegments.map(s => s.analysis.urgency);

    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      speakers: Array.from(speakers.values()),
      summary: {
        totalDuration,
        speakerCount: speakers.size,
        medicalEntitiesFound: allEntities.length,
        overallSentiment: this.calculateOverallSentiment(allSentiments),
        urgencyLevel: this.calculateOverallUrgency(allUrgencies)
      }
    };
  }

  /**
   * Calculate overall sentiment from individual sentiments
   */
  private calculateOverallSentiment(sentiments: string[]): string {
    const counts = sentiments.reduce((acc, sentiment) => {
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxSentiment = Object.keys(counts).reduce((a, b) => 
      counts[a] > counts[b] ? a : b
    );

    return maxSentiment || 'neutral';
  }

  /**
   * Calculate overall urgency from individual urgencies
   */
  private calculateOverallUrgency(urgencies: string[]): string {
    const urgencyScores = { low: 1, medium: 2, high: 3 };
    const avgScore = urgencies.reduce((sum, urgency) => 
      sum + (urgencyScores[urgency as keyof typeof urgencyScores] || 1), 0
    ) / urgencies.length;

    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Get real-time status
   */
  public getStatus() {
    return {
      isConnected: this.isConnected,
      segmentsProcessed: this.speakerSegments.length,
      speakersDetected: new Set(this.speakerSegments.map(s => s.speakerId)).size,
      lastSegment: this.speakerSegments[this.speakerSegments.length - 1]
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
    this.isConnected = false;
    this.speakerSegments = [];
    this.processedSegments.clear();
  }
}
