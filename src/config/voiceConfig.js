/**
 * BIG BROTHER COMPLIANT - Voice Configuration
 * ElevenLabs configuration and voice processing settings
 * MAX LINES: 250 | CURRENT: 186
 */

const logger = require('../utils/logger');

class VoiceConfig {
  constructor() {
    this.bigBrotherCompliant = true;
    this.elevenLabsConfig = this.initElevenLabsConfig();
    this.voiceSettings = this.initVoiceSettings();
    this.processingConfig = this.initProcessingConfig();
    this.validateConfig();
  }

  initElevenLabsConfig() {
    return {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      baseUrl: process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1',
      timeout: parseInt(process.env.ELEVENLABS_TIMEOUT) || 30000,
      retryAttempts: parseInt(process.env.ELEVENLABS_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.ELEVENLABS_RETRY_DELAY) || 1000,
      maxConcurrentRequests: parseInt(process.env.ELEVENLABS_MAX_CONCURRENT) || 5,
      endpoints: {
        voices: '/voices',
        textToSpeech: '/text-to-speech',
        voiceClone: '/voices/add',
        voiceDelete: '/voices',
        history: '/history',
        user: '/user'
      }
    };
  }

  initVoiceSettings() {
    return {
      default: {
        stability: parseFloat(process.env.DEFAULT_STABILITY) || 0.5,
        similarityBoost: parseFloat(process.env.DEFAULT_SIMILARITY_BOOST) || 0.5,
        style: parseFloat(process.env.DEFAULT_STYLE) || 0.0,
        speakerBoost: process.env.DEFAULT_SPEAKER_BOOST === 'true'
      },
      ranges: {
        stability: { min: 0, max: 1 },
        similarityBoost: { min: 0, max: 1 },
        style: { min: 0, max: 1 },
        speakerBoost: [true, false]
      },
      presets: {
        natural: { stability: 0.7, similarityBoost: 0.8, style: 0.2, speakerBoost: true },
        expressive: { stability: 0.3, similarityBoost: 0.9, style: 0.8, speakerBoost: true },
        stable: { stability: 0.9, similarityBoost: 0.6, style: 0.1, speakerBoost: false },
        creative: { stability: 0.4, similarityBoost: 0.7, style: 0.9, speakerBoost: true }
      }
    };
  }

  initProcessingConfig() {
    return {
      audio: {
        supportedFormats: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
        maxFileSize: parseInt(process.env.MAX_AUDIO_SIZE) || 50 * 1024 * 1024,
        minDuration: parseInt(process.env.MIN_AUDIO_DURATION) || 5,
        maxDuration: parseInt(process.env.MAX_AUDIO_DURATION) || 300,
        sampleRates: [16000, 22050, 44100, 48000],
        bitRates: [64, 128, 192, 256, 320]
      },
      text: {
        maxLength: parseInt(process.env.MAX_TEXT_LENGTH) || 5000,
        minLength: parseInt(process.env.MIN_TEXT_LENGTH) || 1,
        allowedCharacters: /^[a-zA-Z0-9\s.,!?'"():;-_@#$%&*+=<>{}[\]\\|`~\n\r]+$/,
        forbiddenPatterns: [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
          /javascript:/gi,
          /data:text\/html/gi
        ]
      },
      voice: {
        maxVoicesPerUser: parseInt(process.env.MAX_VOICES_PER_USER) || 10,
        nameMaxLength: parseInt(process.env.VOICE_NAME_MAX_LENGTH) || 50,
        descriptionMaxLength: parseInt(process.env.VOICE_DESC_MAX_LENGTH) || 500,
        allowedNamePattern: /^[a-zA-Z0-9\s._-]+$/,
        cloneRequiredSamples: parseInt(process.env.CLONE_REQUIRED_SAMPLES) || 1,
        maxCloneAttempts: parseInt(process.env.MAX_CLONE_ATTEMPTS) || 3
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.CACHE_TTL) || 3600,
        maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100,
        audioTtl: parseInt(process.env.AUDIO_CACHE_TTL) || 1800
      },
      rate_limits: {
        requests_per_minute: parseInt(process.env.REQUESTS_PER_MINUTE) || 60,
        voice_clone_per_hour: parseInt(process.env.VOICE_CLONE_PER_HOUR) || 5,
        tts_requests_per_minute: parseInt(process.env.TTS_REQUESTS_PER_MINUTE) || 30,
        concurrent_requests: parseInt(process.env.CONCURRENT_REQUESTS) || 3
      }
    };
  }

  validateConfig() {
    const errors = [];

    if (!this.elevenLabsConfig.apiKey) {
      errors.push('ELEVENLABS_API_KEY is required');
    }

    if (!this.elevenLabsConfig.baseUrl) {
      errors.push('ELEVENLABS_BASE_URL is required');
    }

    if (this.elevenLabsConfig.timeout < 5000) {
      errors.push('ELEVENLABS_TIMEOUT must be at least 5000ms');
    }

    if (this.processingConfig.audio.maxFileSize > 100 * 1024 * 1024) {
      errors.push('MAX_AUDIO_SIZE cannot exceed 100MB');
    }

    if (this.processingConfig.text.maxLength > 10000) {
      errors.push('MAX_TEXT_LENGTH cannot exceed 10000 characters');
    }

    if (errors.length > 0) {
      logger.error('Voice configuration validation failed', { errors });
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    logger.info('Voice configuration validated successfully', {
      elevenLabsConfigured: !!this.elevenLabsConfig.apiKey,
      maxFileSize: this.processingConfig.audio.maxFileSize,
      maxTextLength: this.processingConfig.text.maxLength,
      bigBrotherCompliant: this.bigBrotherCompliant
    });
  }

  getElevenLabsHeaders() {
    return {
      'xi-api-key': this.elevenLabsConfig.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'BigBrotherVoice/2.0.0',
      'X-Big-Brother-Compliant': 'true'
    };
  }

  getVoicePreset(presetName) {
    return this.voiceSettings.presets[presetName] || this.voiceSettings.default;
  }

  validateVoiceSettings(settings) {
    const validated = { ...this.voiceSettings.default, ...settings };
    
    validated.stability = Math.max(0, Math.min(1, validated.stability));
    validated.similarityBoost = Math.max(0, Math.min(1, validated.similarityBoost));
    validated.style = Math.max(0, Math.min(1, validated.style));
    validated.speakerBoost = Boolean(validated.speakerBoost);

    return validated;
  }

  isAudioFormatSupported(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.processingConfig.audio.supportedFormats.includes(ext);
  }

  getMaxFileSize() {
    return this.processingConfig.audio.maxFileSize;
  }

  getTextLimits() {
    return {
      min: this.processingConfig.text.minLength,
      max: this.processingConfig.text.maxLength
    };
  }

  getRateLimits() {
    return this.processingConfig.rate_limits;
  }

  isCacheEnabled() {
    return this.processingConfig.cache.enabled;
  }
}

module.exports = new VoiceConfig();