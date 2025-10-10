/**
 * PHI Scrubber - Remove or mask Protected Health Information
 * 
 * HIPAA-compliant text sanitization before AI processing
 */

export interface ScrubberConfig {
  maskNames?: boolean;
  maskDates?: boolean;
  maskPhoneNumbers?: boolean;
  maskEmails?: boolean;
  maskSSN?: boolean;
  maskMRN?: boolean;
}

const DEFAULT_CONFIG: ScrubberConfig = {
  maskNames: false, // Keep names for clinical context
  maskDates: false, // Keep dates for clinical context
  maskPhoneNumbers: true,
  maskEmails: true,
  maskSSN: true,
  maskMRN: true,
};

/**
 * Scrub PHI from text before sending to AI
 */
export function scrubPHI(text: string, config: ScrubberConfig = DEFAULT_CONFIG): string {
  let scrubbed = text;

  // Mask phone numbers
  if (config.maskPhoneNumbers) {
    scrubbed = scrubbed.replace(
      /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      '[PHONE]'
    );
  }

  // Mask email addresses
  if (config.maskEmails) {
    scrubbed = scrubbed.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL]'
    );
  }

  // Mask SSN
  if (config.maskSSN) {
    scrubbed = scrubbed.replace(
      /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
      '[SSN]'
    );
  }

  // Mask Medical Record Numbers (MRN) - common patterns
  if (config.maskMRN) {
    scrubbed = scrubbed.replace(
      /\b(MRN|mrn|MR#|mr#)[\s:]?\d{6,10}\b/gi,
      '[MRN]'
    );
  }

  // Mask specific dates if configured
  if (config.maskDates) {
    scrubbed = scrubbed.replace(
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
      '[DATE]'
    );
  }

  return scrubbed;
}

/**
 * Validate that critical PHI has been removed
 */
export function validateScrubbing(text: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for potential SSN
  if (/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/.test(text)) {
    warnings.push('Potential SSN detected');
  }

  // Check for potential credit card numbers
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text)) {
    warnings.push('Potential credit card number detected');
  }

  // Check for email addresses (can contain sensitive info)
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    warnings.push('Email address detected');
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Generate hash for audit logging without storing actual content
 */
export async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
