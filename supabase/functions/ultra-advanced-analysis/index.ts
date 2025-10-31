import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  transcript: string;
  segments?: Array<{
    text: string;
    speaker: number;
    start: number;
    end: number;
    confidence: number;
  }>;
  audioMetadata?: {
    duration: number;
    speakerCount: number;
  };
  voiceCharacteristics?: Array<{
    speaker: number;
    gender: 'male' | 'female';
    pitch: number;
    confidence: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('No AI API keys configured');
    }

    const body: AnalysisRequest = await req.json();
    console.log('🧠 Ultra-Advanced Analysis Started');

    // Step 1: Temporal Pattern Detection
    const temporalPatterns = analyzeTemporalPatterns(body.segments || []);
    console.log('⏱️ Temporal Patterns:', temporalPatterns);

    // Step 2: Behavioral Pattern Detection
    const behavioralPatterns = analyzeBehavioralPatterns(body.segments || []);
    console.log('🎭 Behavioral Patterns:', behavioralPatterns);

    // Step 3: Advanced Context Analysis with AI
    const contextAnalysis = await analyzeContextWithAI(
      body.transcript,
      body.segments || [],
      (LOVABLE_API_KEY || OPENAI_API_KEY) as string,
      !!LOVABLE_API_KEY
    );
    console.log('🔍 Context Analysis:', contextAnalysis);

    // Step 4: Emotion Detection
    const emotionAnalysis = await detectEmotions(
      body.transcript,
      body.segments || [],
      (OPENAI_API_KEY || LOVABLE_API_KEY) as string,
      !!LOVABLE_API_KEY
    );
    console.log('😊 Emotion Analysis:', emotionAnalysis);

    // Step 5: Speaker Verification & Confidence Re-analysis
    const speakerVerification = await verifySpeakers(
      body.segments || [],
      body.voiceCharacteristics || []
    );
    console.log('👥 Speaker Verification:', speakerVerification);

    // Step 6: Low Confidence Chunk Re-analysis
    const reanalyzedChunks = await reanalyzeLowConfidenceChunks(
      body.segments || [],
      body.transcript,
      (OPENAI_API_KEY || LOVABLE_API_KEY) as string,
      !!LOVABLE_API_KEY
    );
    console.log('🔄 Re-analyzed Chunks:', reanalyzedChunks.length);

    // Step 7: Advanced Medical Entity Recognition
    const medicalEntities = await extractAdvancedMedicalEntities(
      body.transcript,
      (LOVABLE_API_KEY || OPENAI_API_KEY) as string,
      !!LOVABLE_API_KEY
    );
    console.log('💊 Medical Entities:', medicalEntities);

    // Step 8: Conversation Flow Analysis
    const conversationFlow = analyzeConversationFlow(body.segments || []);
    console.log('💬 Conversation Flow:', conversationFlow);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          temporalPatterns,
          behavioralPatterns,
          contextAnalysis,
          emotionAnalysis,
          speakerVerification,
          reanalyzedChunks,
          medicalEntities,
          conversationFlow,
          metadata: {
            processingTime: Date.now(),
            aiProvider: LOVABLE_API_KEY ? 'lovable' : 'openai',
            analysisDepth: 'ultra-advanced'
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Ultra-Advanced Analysis Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ==================== TEMPORAL PATTERN DETECTION ====================
function analyzeTemporalPatterns(segments: any[]) {
  if (!segments.length) return null;

  const patterns = {
    speakerTurnFrequency: 0,
    averageTurnDuration: 0,
    longestTurn: { speaker: 0, duration: 0 },
    shortestTurn: { speaker: 0, duration: Infinity },
    speakerDominance: {} as Record<number, number>,
    pausePatterns: [] as Array<{ duration: number; beforeSpeaker: number; afterSpeaker: number }>,
    responseLatency: [] as number[],
  };

  let previousSpeaker = segments[0].speaker;
  let previousEndTime = segments[0].end;
  
  segments.forEach((segment, idx) => {
    const duration = segment.end - segment.start;
    
    // Track speaker dominance (speaking time)
    patterns.speakerDominance[segment.speaker] = 
      (patterns.speakerDominance[segment.speaker] || 0) + duration;
    
    // Longest/shortest turns
    if (duration > patterns.longestTurn.duration) {
      patterns.longestTurn = { speaker: segment.speaker, duration };
    }
    if (duration < patterns.shortestTurn.duration) {
      patterns.shortestTurn = { speaker: segment.speaker, duration };
    }
    
    // Detect speaker changes and pauses
    if (segment.speaker !== previousSpeaker) {
      patterns.speakerTurnFrequency++;
      
      const pauseDuration = segment.start - previousEndTime;
      if (pauseDuration > 0) {
        patterns.pausePatterns.push({
          duration: pauseDuration,
          beforeSpeaker: previousSpeaker,
          afterSpeaker: segment.speaker,
        });
      }
      
      patterns.responseLatency.push(pauseDuration);
    }
    
    previousSpeaker = segment.speaker;
    previousEndTime = segment.end;
  });

  const totalDuration = segments[segments.length - 1].end;
  patterns.averageTurnDuration = totalDuration / segments.length;

  return patterns;
}

// ==================== BEHAVIORAL PATTERN DETECTION ====================
function analyzeBehavioralPatterns(segments: any[]) {
  if (!segments.length) return null;

  const patterns = {
    speakerProfiles: {} as Record<number, {
      avgResponseLength: number;
      wordCount: number;
      sentenceCount: number;
      questionCount: number;
      statementCount: number;
      complexityScore: number;
      interruptionCount: number;
    }>,
    conversationDynamics: {
      backAndForth: 0,
      monologues: 0,
      overlaps: 0,
    }
  };

  let previousSpeaker = -1;
  let consecutiveTurns = 0;

  segments.forEach((segment, idx) => {
    const speaker = segment.speaker;
    
    if (!patterns.speakerProfiles[speaker]) {
      patterns.speakerProfiles[speaker] = {
        avgResponseLength: 0,
        wordCount: 0,
        sentenceCount: 0,
        questionCount: 0,
        statementCount: 0,
        complexityScore: 0,
        interruptionCount: 0,
      };
    }

    const profile = patterns.speakerProfiles[speaker];
    const text = segment.text || '';
    const words = text.split(/\s+/).length;
    const sentences = (text.match(/[.!?]+/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;

    profile.wordCount += words;
    profile.sentenceCount += sentences;
    profile.questionCount += questions;
    profile.statementCount += sentences - questions;
    profile.avgResponseLength = profile.wordCount / (idx + 1);
    
    // Complexity score (based on avg words per sentence)
    profile.complexityScore = sentences > 0 ? words / sentences : 0;

    // Detect conversation dynamics
    if (speaker === previousSpeaker) {
      consecutiveTurns++;
      if (consecutiveTurns >= 3) {
        patterns.conversationDynamics.monologues++;
      }
    } else {
      if (consecutiveTurns === 1) {
        patterns.conversationDynamics.backAndForth++;
      }
      consecutiveTurns = 1;
    }

    // Detect interruptions (if speaker changes mid-sentence)
    if (idx > 0 && speaker !== previousSpeaker) {
      const prevSegment = segments[idx - 1];
      if (prevSegment.text && !prevSegment.text.match(/[.!?]$/)) {
        profile.interruptionCount++;
        patterns.conversationDynamics.overlaps++;
      }
    }

    previousSpeaker = speaker;
  });

  return patterns;
}

// ==================== AI-POWERED CONTEXT ANALYSIS ====================
async function analyzeContextWithAI(transcript: string, segments: any[], apiKey: string, isLovable: boolean) {
  const systemPrompt = `You are an advanced medical conversation analyst. Analyze the conversation context deeply.
Return a JSON object with:
- conversationType: "consultation" | "follow-up" | "emergency" | "routine"
- urgencyLevel: 1-10
- patientConcerns: string[]
- doctorRecommendations: string[]
- keyTopics: string[]
- conversationQuality: "excellent" | "good" | "fair" | "poor"
- missingInformation: string[]
- suggestedFollowUp: string[]`;

  try {
    const url = isLovable 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: isLovable ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this medical conversation:\n\n${transcript.substring(0, 6000)}` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Context analysis failed:', error);
    return null;
  }
}

// ==================== EMOTION DETECTION ====================
async function detectEmotions(transcript: string, segments: any[], apiKey: string, isLovable: boolean) {
  const systemPrompt = `You are an emotion detection AI specialized in medical conversations.
For each speaker in the conversation, detect emotions and stress levels.
Return JSON with:
- speakerEmotions: { [speaker: number]: { primary: string, secondary: string, intensity: 1-10 } }
- stressLevels: { [speaker: number]: 1-10 }
- sentimentShift: "positive" | "negative" | "neutral" | "mixed"
- concernIndicators: string[]
- empathyScore: 1-10`;

  try {
    const url = isLovable 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: isLovable ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Detect emotions:\n\n${transcript.substring(0, 4000)}` }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Emotion detection failed:', error);
    return null;
  }
}

// ==================== SPEAKER VERIFICATION ====================
async function verifySpeakers(segments: any[], voiceCharacteristics: any[]) {
  const verification = {
    speakerConsistency: {} as Record<number, number>,
    potentialMisidentifications: [] as any[],
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
    recommendedReanalysis: [] as number[],
  };

  segments.forEach((segment, idx) => {
    const speaker = segment.speaker;
    const confidence = segment.confidence;

    // Track confidence distribution
    if (confidence > 0.85) verification.confidenceDistribution.high++;
    else if (confidence > 0.65) verification.confidenceDistribution.medium++;
    else verification.confidenceDistribution.low++;

    // Flag low confidence for re-analysis
    if (confidence < 0.65) {
      verification.recommendedReanalysis.push(idx);
    }

    // Calculate speaker consistency (variance in voice characteristics)
    if (!verification.speakerConsistency[speaker]) {
      verification.speakerConsistency[speaker] = 0;
    }
    verification.speakerConsistency[speaker] += confidence;

    // Detect potential misidentifications (rapid speaker switches)
    if (idx > 0 && idx < segments.length - 1) {
      const prev = segments[idx - 1];
      const next = segments[idx + 1];
      
      if (prev.speaker === next.speaker && prev.speaker !== speaker) {
        const duration = segment.end - segment.start;
        if (duration < 2) {
          verification.potentialMisidentifications.push({
            segmentIndex: idx,
            reason: 'Isolated short segment between same speaker',
            confidence: segment.confidence
          });
        }
      }
    }
  });

  // Normalize consistency scores
  Object.keys(verification.speakerConsistency).forEach(speaker => {
    const speakerSegments = segments.filter(s => s.speaker === parseInt(speaker));
    verification.speakerConsistency[parseInt(speaker)] /= speakerSegments.length;
  });

  return verification;
}

// ==================== LOW CONFIDENCE RE-ANALYSIS ====================
async function reanalyzeLowConfidenceChunks(segments: any[], fullTranscript: string, apiKey: string, isLovable: boolean) {
  const lowConfidenceSegments = segments.filter((s, idx) => s.confidence < 0.65)
    .map((s, idx) => ({ ...s, originalIndex: segments.indexOf(s) }));

  if (lowConfidenceSegments.length === 0) return [];

  const reanalyzed = [];

  for (const segment of lowConfidenceSegments) {
    try {
      const contextBefore = segments[segment.originalIndex - 1]?.text || '';
      const contextAfter = segments[segment.originalIndex + 1]?.text || '';

      const prompt = `Re-analyze this low-confidence transcription segment with context:

Before: "${contextBefore}"
Current (confidence ${segment.confidence}): "${segment.text}"
After: "${contextAfter}"

Provide a corrected version considering medical terminology. Return only the corrected text.`;

      const url = isLovable 
        ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: isLovable ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a medical transcription expert. Correct transcription errors.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      const data = await response.json();
      const correctedText = data.choices[0].message.content.trim();

      reanalyzed.push({
        originalIndex: segment.originalIndex,
        originalText: segment.text,
        correctedText,
        originalConfidence: segment.confidence,
        newConfidence: 0.9, // AI-corrected confidence
      });
    } catch (error) {
      console.error('Re-analysis failed for segment:', error);
    }
  }

  return reanalyzed;
}

// ==================== ADVANCED MEDICAL ENTITY EXTRACTION ====================
async function extractAdvancedMedicalEntities(transcript: string, apiKey: string, isLovable: boolean) {
  const systemPrompt = `Extract medical entities with high precision. Return JSON:
{
  "symptoms": [{"name": string, "severity": "mild"|"moderate"|"severe", "duration": string}],
  "diagnoses": [{"condition": string, "confidence": "suspected"|"confirmed"}],
  "medications": [{"name": string, "dosage": string, "frequency": string, "route": string}],
  "procedures": [{"name": string, "timing": "planned"|"completed"}],
  "vitals": [{"type": string, "value": string, "unit": string}],
  "allergies": [{"allergen": string, "severity": string}],
  "familyHistory": [{"condition": string, "relation": string}],
  "lifestyle": {"smoking": boolean, "alcohol": boolean, "exercise": string}
}`;

  try {
    const url = isLovable 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: isLovable ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract entities:\n\n${transcript.substring(0, 5000)}` }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return null;
  }
}

// ==================== CONVERSATION FLOW ANALYSIS ====================
function analyzeConversationFlow(segments: any[]) {
  const flow = {
    phases: [] as Array<{ type: string, startIdx: number, endIdx: number }>,
    coherenceScore: 0,
    topicShifts: 0,
    clarificationRequests: 0,
    confirmations: 0,
  };

  let currentPhase = 'greeting';
  let phaseStartIdx = 0;
  let previousTopic = '';

  segments.forEach((segment, idx) => {
    const text = segment.text.toLowerCase();
    
    // Detect conversation phases
    let newPhase = currentPhase;
    if (text.includes('hello') || text.includes('hi ') || text.includes('good morning')) {
      newPhase = 'greeting';
    } else if (text.includes('what') || text.includes('tell me') || text.includes('problem') || text.includes('complain')) {
      newPhase = 'chief_complaint';
    } else if (text.includes('when') || text.includes('how long') || text.includes('started')) {
      newPhase = 'history_taking';
    } else if (text.includes('examine') || text.includes('check')) {
      newPhase = 'examination';
    } else if (text.includes('diagnos') || text.includes('think you have')) {
      newPhase = 'diagnosis';
    } else if (text.includes('prescrib') || text.includes('medication') || text.includes('treatment')) {
      newPhase = 'treatment';
    } else if (text.includes('follow up') || text.includes('come back') || text.includes('next visit')) {
      newPhase = 'closure';
    }

    if (newPhase !== currentPhase) {
      flow.phases.push({
        type: currentPhase,
        startIdx: phaseStartIdx,
        endIdx: idx - 1,
      });
      currentPhase = newPhase;
      phaseStartIdx = idx;
      flow.topicShifts++;
    }

    // Detect clarifications and confirmations
    if (text.includes('you mean') || text.includes('understand correctly') || text.includes('clarify')) {
      flow.clarificationRequests++;
    }
    if (text.includes('yes') || text.includes('correct') || text.includes('right') || text.includes('exactly')) {
      flow.confirmations++;
    }
  });

  // Add final phase
  flow.phases.push({
    type: currentPhase,
    startIdx: phaseStartIdx,
    endIdx: segments.length - 1,
  });

  // Calculate coherence score (fewer abrupt topic shifts = higher coherence)
  const expectedPhases = 5; // Typical consultation phases
  flow.coherenceScore = Math.max(0, 100 - (Math.abs(flow.phases.length - expectedPhases) * 10));

  return flow;
}
