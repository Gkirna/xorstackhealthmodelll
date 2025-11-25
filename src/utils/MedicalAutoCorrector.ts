/**
 * Production-Grade Medical Auto-Corrector
 * Extensive medical terminology dictionary with context-aware corrections
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
  private correctionCount: number = 0;

  constructor() {
    this.initializeCorrections();
    this.initializeContextRules();
  }

  /**
   * Initialize comprehensive medical term corrections
   */
  private initializeCorrections(): void {
    // === MEDICATIONS ===
    // Cardiovascular
    this.corrections.set('metforman', 'metformin');
    this.corrections.set('metformine', 'metformin');
    this.corrections.set('lisinoprel', 'lisinopril');
    this.corrections.set('lisnopril', 'lisinopril');
    this.corrections.set('atorvastaten', 'atorvastatin');
    this.corrections.set('atorvastatine', 'atorvastatin');
    this.corrections.set('simvastaten', 'simvastatin');
    this.corrections.set('amlodapine', 'amlodipine');
    this.corrections.set('warfaren', 'warfarin');
    this.corrections.set('clopidagrel', 'clopidogrel');
    
    // Diabetes
    this.corrections.set('glipazide', 'glipizide');
    this.corrections.set('glybride', 'glyburide');
    this.corrections.set('insulin glargine', 'insulin glargine');
    this.corrections.set('liraglutide', 'liraglutide');
    
    // Antibiotics
    this.corrections.set('amoxacillin', 'amoxicillin');
    this.corrections.set('amoxycillin', 'amoxicillin');
    this.corrections.set('azythromycin', 'azithromycin');
    this.corrections.set('ciprofloxacin', 'ciprofloxacin');
    this.corrections.set('doxycyclene', 'doxycycline');
    
    // Pain/Inflammation
    this.corrections.set('ibuprofen', 'ibuprofen');
    this.corrections.set('naproxon', 'naproxen');
    this.corrections.set('acetomenophen', 'acetaminophen');
    this.corrections.set('tylenol', 'acetaminophen');
    
    // === MEDICAL CONDITIONS ===
    // Cardiovascular
    this.corrections.set('hipertension', 'hypertension');
    this.corrections.set('high blood pressure', 'hypertension');
    this.corrections.set('hipotension', 'hypotension');
    this.corrections.set('atrial fibrilation', 'atrial fibrillation');
    this.corrections.set('a fib', 'atrial fibrillation');
    this.corrections.set('myocardial infarction', 'myocardial infarction');
    this.corrections.set('heart attack', 'myocardial infarction');
    this.corrections.set('congestive heart failure', 'congestive heart failure');
    this.corrections.set('CHF', 'congestive heart failure');
    
    // Respiratory
    this.corrections.set('asma', 'asthma');
    this.corrections.set('copd', 'chronic obstructive pulmonary disease');
    this.corrections.set('pneumonia', 'pneumonia');
    this.corrections.set('bronchitis', 'bronchitis');
    
    // Endocrine
    this.corrections.set('diabetis', 'diabetes');
    this.corrections.set('diabetus', 'diabetes');
    this.corrections.set('diabetes mellitus', 'diabetes mellitus');
    this.corrections.set('type 2 diabetes', 'type 2 diabetes mellitus');
    this.corrections.set('hyperthyroidism', 'hyperthyroidism');
    this.corrections.set('hypothyroidism', 'hypothyroidism');
    
    // Gastrointestinal
    this.corrections.set('gerd', 'gastroesophageal reflux disease');
    this.corrections.set('gastroenteritis', 'gastroenteritis');
    this.corrections.set('irritable bowel syndrome', 'irritable bowel syndrome');
    this.corrections.set('IBS', 'irritable bowel syndrome');
    
    // === SYMPTOMS ===
    this.corrections.set('feaver', 'fever');
    this.corrections.set('caugh', 'cough');
    this.corrections.set('coff', 'cough');
    this.corrections.set('shortness off breath', 'shortness of breath');
    this.corrections.set('short of breath', 'shortness of breath');
    this.corrections.set('SOB', 'shortness of breath');
    this.corrections.set('chest pane', 'chest pain');
    this.corrections.set('headach', 'headache');
    this.corrections.set('nausea', 'nausea');
    this.corrections.set('vomitting', 'vomiting');
    this.corrections.set('diarhea', 'diarrhea');
    this.corrections.set('dizzyness', 'dizziness');
    this.corrections.set('fatige', 'fatigue');
    
    // === PROCEDURES ===
    this.corrections.set('echocardiogram', 'echocardiogram');
    this.corrections.set('electrocardiogram', 'electrocardiogram');
    this.corrections.set('EKG', 'electrocardiogram');
    this.corrections.set('ECG', 'electrocardiogram');
    this.corrections.set('CT scan', 'computed tomography scan');
    this.corrections.set('MRI', 'magnetic resonance imaging');
    this.corrections.set('x-ray', 'radiograph');
    
    // === ANATOMY ===
    this.corrections.set('hart', 'heart');
    this.corrections.set('lungs', 'lungs');
    this.corrections.set('stomac', 'stomach');
    this.corrections.set('kidny', 'kidney');
    this.corrections.set('liver', 'liver');
    
    // === VITALS ===
    this.corrections.set('BP', 'blood pressure');
    this.corrections.set('heart rate', 'heart rate');
    this.corrections.set('pulse', 'heart rate');
    this.corrections.set('temperature', 'temperature');
    this.corrections.set('respiratory rate', 'respiratory rate');
    this.corrections.set('oxygen saturation', 'oxygen saturation');
    this.corrections.set('O2 sat', 'oxygen saturation');
  }

  /**
   * Initialize context-based correction rules
   */
  private initializeContextRules(): void {
    // Blood pressure context
    this.contextRules.set('blood pressure', [
      { incorrect: 'BP', correct: 'blood pressure', confidence: 0.9 },
      { incorrect: 'pressure', correct: 'blood pressure', confidence: 0.7 },
      { incorrect: 'systolic', correct: 'systolic blood pressure', confidence: 0.8 },
      { incorrect: 'diastolic', correct: 'diastolic blood pressure', confidence: 0.8 }
    ]);

    // Medication context
    this.contextRules.set('medication', [
      { incorrect: 'meds', correct: 'medications', confidence: 0.9 },
      { incorrect: 'pills', correct: 'medications', confidence: 0.8 },
      { incorrect: 'drug', correct: 'medication', confidence: 0.7 }
    ]);

    // Diabetes context
    this.contextRules.set('diabetes', [
      { incorrect: 'sugar', correct: 'blood glucose', confidence: 0.8 },
      { incorrect: 'glucose level', correct: 'blood glucose level', confidence: 0.9 }
    ]);
  }

  /**
   * Process and correct transcript in real-time with detailed metrics
   */
  public correctTranscript(text: string, speaker: 'provider' | 'patient'): string {
    // Add to conversation history
    this.conversationHistory.push(text);
    if (this.conversationHistory.length > 20) {
      this.conversationHistory.shift();
    }

    const original = text;
    let correctedText = text;

    // 1. Direct word replacement
    correctedText = this.applyDirectCorrections(correctedText);

    // 2. Context-based corrections
    correctedText = this.applyContextCorrections(correctedText);

    // 3. Phrase corrections
    correctedText = this.applyPhraseCorrections(correctedText);

    // 4. Capitalization fixes for medical terms
    correctedText = this.applyCapitalizationFixes(correctedText);

    // Log if corrections were made
    if (correctedText !== original) {
      this.correctionCount++;
      console.log(`[AutoCorrect #${this.correctionCount}] ${speaker}:`, {
        before: original.substring(0, 50),
        after: correctedText.substring(0, 50),
        changes: this.getChanges(original, correctedText)
      });
    }

    return correctedText;
  }

  /**
   * Get specific changes made
   */
  private getChanges(original: string, corrected: string): string[] {
    const changes: string[] = [];
    const originalWords = original.toLowerCase().split(/\s+/);
    const correctedWords = corrected.toLowerCase().split(/\s+/);

    for (let i = 0; i < Math.min(originalWords.length, correctedWords.length); i++) {
      if (originalWords[i] !== correctedWords[i]) {
        changes.push(`"${originalWords[i]}" → "${correctedWords[i]}"`);
      }
    }

    return changes.slice(0, 3); // Show max 3 changes
  }

  /**
   * Apply direct word-to-word corrections
   */
  private applyDirectCorrections(text: string): string {
    let result = text;
    
    for (const [incorrect, correct] of this.corrections) {
      const regex = new RegExp(`\\b${this.escapeRegex(incorrect)}\\b`, 'gi');
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
            const regex = new RegExp(`\\b${this.escapeRegex(rule.incorrect)}\\b`, 'gi');
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
      ['blood sugar low', 'low blood sugar'],
      ['taking medication for', 'taking medications for'],
      ['on medication', 'taking medications'],
      ['patient complains of', 'patient reports'],
      ['patient says', 'patient reports'],
    ]);

    let result = text;
    for (const [incorrect, correct] of phrases) {
      const regex = new RegExp(this.escapeRegex(incorrect), 'gi');
      result = result.replace(regex, correct);
    }

    return result;
  }

  /**
   * Apply proper capitalization for medical terms
   */
  private applyCapitalizationFixes(text: string): string {
    const properNouns = [
      'HIV', 'AIDS', 'COVID', 'COPD', 'GERD', 'IBS', 'MRI', 'CT', 'ECG', 'EKG',
      'BP', 'CHF', 'DVT', 'PE', 'MI', 'CAD', 'PVD'
    ];

    let result = text;
    for (const term of properNouns) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      result = result.replace(regex, term);
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
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add custom correction rule
   */
  public addCorrection(incorrect: string, correct: string): void {
    this.corrections.set(incorrect.toLowerCase(), correct);
    console.log(`[AutoCorrect] Added custom rule: "${incorrect}" → "${correct}"`);
  }

  /**
   * Get correction statistics
   */
  public getStats() {
    return {
      totalCorrections: this.correctionCount,
      dictionarySize: this.corrections.size,
      contextRules: this.contextRules.size
    };
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
    this.correctionCount = 0;
  }
}