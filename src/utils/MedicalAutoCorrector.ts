/**
 * Medical Auto-Corrector
 * Automatically corrects medical terms and phrases based on context
 */

interface CorrectionRule {
  incorrect: string;
  correct: string;
  confidence: number;
}

export class MedicalAutoCorrector {
  private corrections: Map<string, string> = new Map();
  private contextRules: Map<string, CorrectionRule[]> = new Map();
  private conversationHistory: string[] = [];

  constructor() {
    this.initializeCorrections();
    this.initializeContextRules();
  }

  /**
   * Initialize common medical term corrections
   */
  private initializeCorrections(): void {
    // Drug names
    this.corrections.set('metforman', 'metformin');
    this.corrections.set('metformine', 'metformin');
    this.corrections.set('lisinoprel', 'lisinopril');
    this.corrections.set('atorvastaten', 'atorvastatin');
    
    // Conditions
    this.corrections.set('hipertension', 'hypertension');
    this.corrections.set('diabetis', 'diabetes');
    this.corrections.set('diabetus', 'diabetes');
    this.corrections.set('asma', 'asthma');
    
    // Symptoms
    this.corrections.set('feaver', 'fever');
    this.corrections.set('caugh', 'cough');
    this.corrections.set('shortness off breath', 'shortness of breath');
    this.corrections.set('chest pane', 'chest pain');
  }

  /**
   * Initialize context-based correction rules
   */
  private initializeContextRules(): void {
    // Blood pressure context
    this.contextRules.set('blood pressure', [
      { incorrect: 'BP', correct: 'blood pressure', confidence: 0.9 },
      { incorrect: 'pressure', correct: 'blood pressure', confidence: 0.7 }
    ]);

    // Medication context
    this.contextRules.set('medication', [
      { incorrect: 'meds', correct: 'medications', confidence: 0.9 },
      { incorrect: 'pills', correct: 'medications', confidence: 0.8 }
    ]);
  }

  /**
   * Process and correct transcript in real-time
   */
  public correctTranscript(text: string, speaker: 'provider' | 'patient'): string {
    // Add to conversation history
    this.conversationHistory.push(text);
    if (this.conversationHistory.length > 20) {
      this.conversationHistory.shift();
    }

    // Apply corrections
    let correctedText = text;

    // 1. Direct word replacement
    correctedText = this.applyDirectCorrections(correctedText);

    // 2. Context-based corrections
    correctedText = this.applyContextCorrections(correctedText);

    // 3. Phrase corrections
    correctedText = this.applyPhraseCorrections(correctedText);

    // Log if corrections were made
    if (correctedText !== text) {
      console.log(`🔧 Auto-corrected: "${text}" → "${correctedText}"`);
    }

    return correctedText;
  }

  /**
   * Apply direct word-to-word corrections
   */
  private applyDirectCorrections(text: string): string {
    let result = text;
    
    for (const [incorrect, correct] of this.corrections) {
      const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
      result = result.replace(regex, correct);
    }

    return result;
  }

  /**
   * Apply context-aware corrections
   */
  private applyContextCorrections(text: string): string {
    let result = text;
    const context = this.getConversationContext();

    for (const [contextKey, rules] of this.contextRules) {
      if (context.includes(contextKey)) {
        for (const rule of rules) {
          if (text.toLowerCase().includes(rule.incorrect.toLowerCase())) {
            const regex = new RegExp(`\\b${rule.incorrect}\\b`, 'gi');
            result = result.replace(regex, rule.correct);
          }
        }
      }
    }

    return result;
  }

  /**
   * Apply phrase-level corrections
   */
  private applyPhraseCorrections(text: string): string {
    const phrases: Map<string, string> = new Map([
      ['short of breath', 'shortness of breath'],
      ['chest pane', 'chest pain'],
      ['hart attack', 'heart attack'],
      ['hi blood pressure', 'high blood pressure'],
      ['lo blood pressure', 'low blood pressure'],
      ['sugar diabetes', 'diabetes'],
      ['blood sugar hi', 'high blood sugar'],
      ['taking medication for', 'taking medications for'],
    ]);

    let result = text;
    for (const [incorrect, correct] of phrases) {
      const regex = new RegExp(incorrect, 'gi');
      result = result.replace(regex, correct);
    }

    return result;
  }

  /**
   * Get conversation context as string
   */
  private getConversationContext(): string {
    return this.conversationHistory.join(' ').toLowerCase();
  }

  /**
   * Add custom correction rule
   */
  public addCorrection(incorrect: string, correct: string): void {
    this.corrections.set(incorrect.toLowerCase(), correct);
  }

  /**
   * Get correction suggestions for a word
   */
  public getSuggestions(word: string): string[] {
    const suggestions: string[] = [];
    const lowerWord = word.toLowerCase();

    for (const [incorrect, correct] of this.corrections) {
      if (this.calculateSimilarity(lowerWord, incorrect) > 0.7) {
        suggestions.push(correct);
      }
    }

    return suggestions;
  }

  /**
   * Calculate similarity between two words (Levenshtein distance)
   */
  private calculateSimilarity(word1: string, word2: string): number {
    const longer = word1.length > word2.length ? word1 : word2;
    const shorter = word1.length > word2.length ? word2 : word1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
  }
}

