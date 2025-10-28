/**
 * Adaptive Learning System for Voice Patterns
 * Machine learning-based speaker adaptation and pattern recognition
 */

// import * as tf from '@tensorflow/tfjs';

interface LearningPattern {
  speakerId: string;
  patterns: {
    pitchVariations: number[];
    volumePatterns: number[];
    emotionTransitions: string[];
    stressPatterns: number[];
    speakingRhythms: number[];
    vocabularyComplexity: number[];
  };
  confidence: number;
  lastUpdated: number;
}

interface AdaptiveModel {
  model: any; // tf.LayersModel;
  trainingData: any[];
  accuracy: number;
  lastTrained: number;
}

export class AdaptiveVoiceLearningSystem {
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private adaptiveModels: Map<string, AdaptiveModel> = new Map();
  private globalPatterns: {
    averagePitch: number;
    averageVolume: number;
    commonEmotions: string[];
    stressBaseline: number;
  } = {
    averagePitch: 150,
    averageVolume: 50,
    commonEmotions: ['neutral'],
    stressBaseline: 0.3,
  };

  private readonly LEARNING_RATE = 0.01;
  private readonly MIN_SAMPLES_FOR_LEARNING = 10;
  private readonly PATTERN_MEMORY_SIZE = 1000;
  private readonly ADAPTATION_THRESHOLD = 0.7;

  constructor() {
    this.initializeGlobalPatterns();
  }

  /**
   * Initialize global voice patterns
   */
  private initializeGlobalPatterns(): void {
    console.log('🧠 Initializing adaptive learning system...');
    
    // Load global patterns from localStorage if available
    const savedPatterns = localStorage.getItem('voice_learning_patterns');
    if (savedPatterns) {
      try {
        this.globalPatterns = JSON.parse(savedPatterns);
        console.log('✅ Loaded existing voice patterns');
      } catch (error) {
        console.warn('⚠️ Failed to load voice patterns:', error);
      }
    }
  }

  /**
   * Learn from new voice data
   */
  async learnFromVoiceData(
    speakerId: string,
    voiceData: {
      pitch: number;
      volume: number;
      emotion: string;
      stress: number;
      speakingRate: number;
      audioFeatures: any;
    }
  ): Promise<void> {
    // Get or create learning pattern for speaker
    let pattern = this.learningPatterns.get(speakerId);
    if (!pattern) {
      pattern = this.createNewPattern(speakerId);
      this.learningPatterns.set(speakerId, pattern);
    }

    // Update pattern with new data
    this.updatePattern(pattern, voiceData);

    // Check if we have enough data for learning
    if (this.hasEnoughData(pattern)) {
      await this.performAdaptiveLearning(speakerId, pattern);
    }

    // Update global patterns
    this.updateGlobalPatterns(voiceData);

    // Save patterns to localStorage
    this.savePatterns();
  }

  /**
   * Create new learning pattern for speaker
   */
  private createNewPattern(speakerId: string): LearningPattern {
    return {
      speakerId,
      patterns: {
        pitchVariations: [],
        volumePatterns: [],
        emotionTransitions: [],
        stressPatterns: [],
        speakingRhythms: [],
        vocabularyComplexity: [],
      },
      confidence: 0.5,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Update pattern with new voice data
   */
  private updatePattern(pattern: LearningPattern, voiceData: any): void {
    const now = Date.now();
    
    // Add new data points
    pattern.patterns.pitchVariations.push(voiceData.pitch);
    pattern.patterns.volumePatterns.push(voiceData.volume);
    pattern.patterns.emotionTransitions.push(voiceData.emotion);
    pattern.patterns.stressPatterns.push(voiceData.stress);
    pattern.patterns.speakingRhythms.push(voiceData.speakingRate);
    
    // Calculate vocabulary complexity (simplified)
    const complexity = this.calculateVocabularyComplexity(voiceData.audioFeatures);
    pattern.patterns.vocabularyComplexity.push(complexity);

    // Limit memory size
    this.limitPatternMemory(pattern);

    // Update confidence based on data consistency
    pattern.confidence = this.calculatePatternConfidence(pattern);
    pattern.lastUpdated = now;

    console.log(`📚 Learning from ${pattern.speakerId}: pitch=${voiceData.pitch.toFixed(0)}Hz, emotion=${voiceData.emotion}, stress=${(voiceData.stress * 100).toFixed(0)}%`);
  }

  /**
   * Calculate vocabulary complexity from audio features
   */
  private calculateVocabularyComplexity(audioFeatures: any): number {
    // Simplified complexity calculation based on spectral features
    let complexity = 0.5; // Base complexity
    
    // Higher spectral centroid = more complex sounds
    if (audioFeatures.spectralCentroid > 0.5) {
      complexity += 0.2;
    }
    
    // Higher spectral contrast = more varied sounds
    if (audioFeatures.spectralContrast > 1.5) {
      complexity += 0.2;
    }
    
    // Lower zero crossing rate = more complex speech
    if (audioFeatures.zeroCrossingRate < 0.1) {
      complexity += 0.1;
    }
    
    return Math.min(1, complexity);
  }

  /**
   * Limit pattern memory to prevent overflow
   */
  private limitPatternMemory(pattern: LearningPattern): void {
    Object.keys(pattern.patterns).forEach(key => {
      const array = pattern.patterns[key as keyof typeof pattern.patterns] as number[] | string[];
      if (array.length > this.PATTERN_MEMORY_SIZE) {
        array.splice(0, array.length - this.PATTERN_MEMORY_SIZE);
      }
    });
  }

  /**
   * Calculate pattern confidence based on consistency
   */
  private calculatePatternConfidence(pattern: LearningPattern): number {
    let confidence = 0.5;
    
    // Pitch consistency
    if (pattern.patterns.pitchVariations.length > 5) {
      const pitchVariance = this.calculateVariance(pattern.patterns.pitchVariations);
      confidence += pitchVariance < 100 ? 0.2 : 0.1;
    }
    
    // Emotion consistency
    if (pattern.patterns.emotionTransitions.length > 3) {
      const emotionConsistency = this.calculateEmotionConsistency(pattern.patterns.emotionTransitions);
      confidence += emotionConsistency * 0.2;
    }
    
    // Stress pattern consistency
    if (pattern.patterns.stressPatterns.length > 5) {
      const stressVariance = this.calculateVariance(pattern.patterns.stressPatterns);
      confidence += stressVariance < 0.1 ? 0.1 : 0.05;
    }
    
    return Math.min(1, confidence);
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(array: number[]): number {
    if (array.length === 0) return 0;
    
    const mean = array.reduce((a, b) => a + b, 0) / array.length;
    const variance = array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate emotion consistency
   */
  private calculateEmotionConsistency(emotions: string[]): number {
    if (emotions.length === 0) return 0;
    
    const emotionCounts: { [key: string]: number } = {};
    emotions.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    
    const maxCount = Math.max(...Object.values(emotionCounts));
    return maxCount / emotions.length;
  }

  /**
   * Check if we have enough data for learning
   */
  private hasEnoughData(pattern: LearningPattern): boolean {
    return pattern.patterns.pitchVariations.length >= this.MIN_SAMPLES_FOR_LEARNING;
  }

  /**
   * Perform adaptive learning for speaker
   */
  private async performAdaptiveLearning(speakerId: string, pattern: LearningPattern): Promise<void> {
    try {
      console.log(`🎯 Performing adaptive learning for ${speakerId}...`);
      
      // Get or create adaptive model
      let adaptiveModel = this.adaptiveModels.get(speakerId);
      if (!adaptiveModel) {
        adaptiveModel = await this.createAdaptiveModel(speakerId);
        this.adaptiveModels.set(speakerId, adaptiveModel);
      }
      
      // Prepare training data
      const trainingData = this.prepareTrainingData(pattern);
      
      // Train the model
      await this.trainAdaptiveModel(adaptiveModel, trainingData);
      
      // Update model accuracy
      adaptiveModel.accuracy = await this.evaluateModelAccuracy(adaptiveModel, trainingData);
      adaptiveModel.lastTrained = Date.now();
      
      console.log(`✅ Adaptive learning completed for ${speakerId}, accuracy: ${(adaptiveModel.accuracy * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error(`❌ Adaptive learning failed for ${speakerId}:`, error);
    }
  }

  /**
   * Create adaptive model for speaker
   */
  private async createAdaptiveModel(speakerId: string): Promise<AdaptiveModel> {
    // Simplified model without TensorFlow.js
    const model = {
      predict: (input: any) => {
        // Mock prediction
        return {
          data: () => Promise.resolve(new Float32Array([0.8])) // 80% confidence
        };
      },
      fit: async (inputTensor: any, outputTensor: any, options: any) => {
        // Mock training
        console.log('Mock model training completed');
      },
      dispose: () => {}
    };
    
    return {
      model,
      trainingData: [],
      accuracy: 0.5,
      lastTrained: Date.now(),
    };
  }

  /**
   * Prepare training data from pattern
   */
  private prepareTrainingData(pattern: LearningPattern): any[] {
    const trainingData: any[] = [];
    const length = Math.min(
      pattern.patterns.pitchVariations.length,
      pattern.patterns.volumePatterns.length,
      pattern.patterns.emotionTransitions.length,
      pattern.patterns.stressPatterns.length,
      pattern.patterns.speakingRhythms.length,
      pattern.patterns.vocabularyComplexity.length
    );
    
    for (let i = 0; i < length; i++) {
      trainingData.push({
        input: [
          pattern.patterns.pitchVariations[i] / 300, // Normalize pitch
          pattern.patterns.volumePatterns[i] / 100, // Normalize volume
          this.emotionToNumber(pattern.patterns.emotionTransitions[i]), // Convert emotion to number
          pattern.patterns.stressPatterns[i], // Already 0-1
          pattern.patterns.speakingRhythms[i] / 200, // Normalize speaking rate
          pattern.patterns.vocabularyComplexity[i], // Already 0-1
        ],
        output: pattern.confidence, // Target confidence
      });
    }
    
    return trainingData;
  }

  /**
   * Convert emotion to number
   */
  private emotionToNumber(emotion: string): number {
    const emotionMap: { [key: string]: number } = {
      neutral: 0.5,
      happy: 0.8,
      sad: 0.2,
      angry: 0.9,
      fearful: 0.3,
      surprised: 0.7,
      disgusted: 0.1,
    };
    return emotionMap[emotion] || 0.5;
  }

  /**
   * Train adaptive model
   */
  private async trainAdaptiveModel(adaptiveModel: AdaptiveModel, trainingData: any[]): Promise<void> {
    if (trainingData.length === 0) return;
    
    // Prepare tensors
    const inputs = trainingData.map(d => d.input);
    const outputs = trainingData.map(d => d.output);
    
    // Train the model (simplified)
    await adaptiveModel.model.fit(inputs, outputs, {
      epochs: 10,
      batchSize: Math.min(32, trainingData.length),
      validationSplit: 0.2,
      verbose: 0,
    });
  }

  /**
   * Evaluate model accuracy
   */
  private async evaluateModelAccuracy(adaptiveModel: AdaptiveModel, trainingData: any[]): Promise<number> {
    if (trainingData.length === 0) return 0.5;
    
    const inputs = trainingData.map(d => d.input);
    const outputs = trainingData.map(d => d.output);
    
    const predictions = adaptiveModel.model.predict(inputs);
    const predictedValues = await predictions.data();
    
    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < outputs.length; i++) {
      const error = Math.abs(predictedValues[i] - outputs[i]);
      if (error < 0.2) { // Within 20% tolerance
        correct++;
      }
    }
    
    const accuracy = correct / outputs.length;
    
    // Clean up tensors
    predictions.dispose();
    
    return accuracy;
  }

  /**
   * Update global patterns
   */
  private updateGlobalPatterns(voiceData: any): void {
    const alpha = 0.01; // Learning rate for global patterns
    
    // Update average pitch
    this.globalPatterns.averagePitch = 
      this.globalPatterns.averagePitch * (1 - alpha) + voiceData.pitch * alpha;
    
    // Update average volume
    this.globalPatterns.averageVolume = 
      this.globalPatterns.averageVolume * (1 - alpha) + voiceData.volume * alpha;
    
    // Update stress baseline
    this.globalPatterns.stressBaseline = 
      this.globalPatterns.stressBaseline * (1 - alpha) + voiceData.stress * alpha;
    
    // Update common emotions (simplified)
    if (!this.globalPatterns.commonEmotions.includes(voiceData.emotion)) {
      this.globalPatterns.commonEmotions.push(voiceData.emotion);
      if (this.globalPatterns.commonEmotions.length > 5) {
        this.globalPatterns.commonEmotions.shift();
      }
    }
  }

  /**
   * Predict speaker behavior based on learned patterns
   */
  async predictSpeakerBehavior(
    speakerId: string,
    currentContext: {
      pitch: number;
      volume: number;
      emotion: string;
      stress: number;
      speakingRate: number;
    }
  ): Promise<{
    predictedEmotion: string;
    predictedStress: number;
    confidence: number;
    adaptationScore: number;
  }> {
    const pattern = this.learningPatterns.get(speakerId);
    const adaptiveModel = this.adaptiveModels.get(speakerId);
    
    if (!pattern || !adaptiveModel) {
      return {
        predictedEmotion: 'neutral',
        predictedStress: 0.3,
        confidence: 0.5,
        adaptationScore: 0,
      };
    }
    
    try {
      // Prepare input for prediction
      const input = [
        currentContext.pitch / 300,
        currentContext.volume / 100,
        this.emotionToNumber(currentContext.emotion),
        currentContext.stress,
        currentContext.speakingRate / 200,
        this.calculateVocabularyComplexity({}), // Simplified
      ];
      
      const prediction = adaptiveModel.model.predict([input]);
      const confidence = await prediction.data();
      
      // Predict next emotion based on patterns
      const predictedEmotion = this.predictNextEmotion(pattern, currentContext.emotion);
      
      // Predict stress level
      const predictedStress = this.predictStressLevel(pattern, currentContext);
      
      // Calculate adaptation score
      const adaptationScore = this.calculateAdaptationScore(pattern, adaptiveModel);
      
      // Clean up tensors
      prediction.dispose();
      
      return {
        predictedEmotion,
        predictedStress,
        confidence: confidence[0],
        adaptationScore,
      };
      
    } catch (error) {
      console.warn('Prediction failed:', error);
      return {
        predictedEmotion: 'neutral',
        predictedStress: 0.3,
        confidence: 0.5,
        adaptationScore: 0,
      };
    }
  }

  /**
   * Predict next emotion based on patterns
   */
  private predictNextEmotion(pattern: LearningPattern, currentEmotion: string): string {
    const emotions = pattern.patterns.emotionTransitions;
    if (emotions.length < 2) return currentEmotion;
    
    // Find emotion transitions
    const transitions: { [key: string]: number } = {};
    for (let i = 0; i < emotions.length - 1; i++) {
      if (emotions[i] === currentEmotion) {
        const nextEmotion = emotions[i + 1];
        transitions[nextEmotion] = (transitions[nextEmotion] || 0) + 1;
      }
    }
    
    // Return most likely next emotion
    const mostLikely = Object.keys(transitions).reduce((a, b) => 
      transitions[a] > transitions[b] ? a : b
    );
    
    return mostLikely || currentEmotion;
  }

  /**
   * Predict stress level based on patterns
   */
  private predictStressLevel(pattern: LearningPattern, currentContext: any): number {
    const stressPatterns = pattern.patterns.stressPatterns;
    if (stressPatterns.length === 0) return 0.3;
    
    // Calculate average stress for similar contexts
    const similarContexts = stressPatterns.filter((stress, index) => {
      const emotion = pattern.patterns.emotionTransitions[index];
      return emotion === currentContext.emotion;
    });
    
    if (similarContexts.length > 0) {
      return similarContexts.reduce((a, b) => a + b, 0) / similarContexts.length;
    }
    
    return stressPatterns.reduce((a, b) => a + b, 0) / stressPatterns.length;
  }

  /**
   * Calculate adaptation score
   */
  private calculateAdaptationScore(pattern: LearningPattern, adaptiveModel: AdaptiveModel): number {
    const dataAge = Date.now() - pattern.lastUpdated;
    const modelAge = Date.now() - adaptiveModel.lastTrained;
    
    // Score based on recency and accuracy
    const recencyScore = Math.max(0, 1 - (dataAge / (24 * 60 * 60 * 1000))); // 24 hours
    const accuracyScore = adaptiveModel.accuracy;
    const confidenceScore = pattern.confidence;
    
    return (recencyScore + accuracyScore + confidenceScore) / 3;
  }

  /**
   * Get learning insights
   */
  getLearningInsights(): {
    totalSpeakers: number;
    averageConfidence: number;
    mostLearnedSpeaker: string;
    globalPatterns: any;
    adaptationScores: { [speakerId: string]: number };
  } {
    const speakers = Array.from(this.learningPatterns.keys());
    const totalSpeakers = speakers.length;
    
    const averageConfidence = speakers.length > 0 
      ? speakers.reduce((sum, speakerId) => {
          const pattern = this.learningPatterns.get(speakerId);
          return sum + (pattern?.confidence || 0);
        }, 0) / speakers.length
      : 0;
    
    const mostLearnedSpeaker = speakers.length > 0
      ? speakers.reduce((best, speakerId) => {
          const pattern = this.learningPatterns.get(speakerId);
          const bestPattern = this.learningPatterns.get(best);
          return (pattern?.confidence || 0) > (bestPattern?.confidence || 0) ? speakerId : best;
        })
      : '';
    
    const adaptationScores: { [speakerId: string]: number } = {};
    speakers.forEach(speakerId => {
      const pattern = this.learningPatterns.get(speakerId);
      const adaptiveModel = this.adaptiveModels.get(speakerId);
      if (pattern && adaptiveModel) {
        adaptationScores[speakerId] = this.calculateAdaptationScore(pattern, adaptiveModel);
      }
    });
    
    return {
      totalSpeakers,
      averageConfidence,
      mostLearnedSpeaker,
      globalPatterns: this.globalPatterns,
      adaptationScores,
    };
  }

  /**
   * Save patterns to localStorage
   */
  private savePatterns(): void {
    try {
      const patternsData = {
        globalPatterns: this.globalPatterns,
        learningPatterns: Array.from(this.learningPatterns.entries()),
        timestamp: Date.now(),
      };
      
      localStorage.setItem('voice_learning_patterns', JSON.stringify(patternsData));
    } catch (error) {
      console.warn('Failed to save voice patterns:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Dispose of all models
    this.adaptiveModels.forEach(model => {
      model.model.dispose();
    });
    
    this.adaptiveModels.clear();
    this.learningPatterns.clear();
    
    console.log('🧹 Adaptive learning system cleaned up');
  }
}

