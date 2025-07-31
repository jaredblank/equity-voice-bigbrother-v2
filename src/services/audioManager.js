// BIG BROTHER COMPLIANT - Audio Manager Service
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const voiceConfig = require('../config/voiceConfig');

class AudioManager {
  constructor() {
    this.bigBrotherCompliant = true;
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(__dirname, '../../temp');
    this.initializeDirectories();
    this.multerConfig = this.setupMulter();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info('Audio directories initialized', { uploadsDir: this.uploadsDir, tempDir: this.tempDir, bigBrotherCompliant: this.bigBrotherCompliant });
    } catch (error) {
      logger.error('Failed to initialize audio directories', { error: error.message });
      throw error;
    }
  }

  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, this.tempDir),
      filename: (req, file, cb) => cb(null, this.generateUniqueFilename(file.originalname))
    });
    return multer({
      storage,
      limits: { fileSize: voiceConfig.getMaxFileSize(), files: 5 },
      fileFilter: (req, file, cb) => {
        const validation = validators.validateAudioFile(file);
        cb(validation.isValid ? null : new Error(validation.errors.join(', ')), validation.isValid);
      }
    });
  }

  generateUniqueFilename(originalName) {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    const sanitized = validators.sanitizeFilename(path.basename(originalName, ext));
    return `${Date.now()}-${hash}-${sanitized}${ext}`;
  }

  getUploadMiddleware() { return this.multerConfig.single('audio'); }
  getMultipleUploadMiddleware() { return this.multerConfig.array('audio', 5); }

  async processUpload(file, options = {}) {
    const startTime = Date.now();
    try {
      logger.audioProcessing('Processing audio upload', { filename: file.originalname, size: file.size, mimetype: file.mimetype });
      const validation = validators.validateAudioFile(file);
      if (!validation.isValid) {
        await this.cleanupTempFile(file.path);
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      const audioInfo = await this.getAudioInfo(file.path);
      const permanentPath = await this.moveToUploads(file.path, file.filename);
      const duration = Date.now() - startTime;
      logger.performance('Audio upload processed', duration, { filename: file.originalname, size: file.size, permanentPath });
      return { success: true, filename: file.filename, originalName: file.originalname, size: file.size, path: permanentPath, audioInfo, duration, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      await this.cleanupTempFile(file.path);
      logger.error('Audio upload processing failed', { error: error.message, filename: file.originalname, size: file.size });
      throw error;
    }
  }

  async moveToUploads(tempPath, filename) {
    const permanentPath = path.join(this.uploadsDir, filename);
    try {
      await fs.rename(tempPath, permanentPath);
      logger.audioProcessing('File moved to uploads', { from: tempPath, to: permanentPath });
      return permanentPath;
    } catch (error) {
      logger.error('Failed to move file to uploads', { error: error.message, tempPath });
      throw error;
    }
  }

  async getAudioInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return { size: stats.size, created: stats.birthtime, modified: stats.mtime, extension: path.extname(filePath).toLowerCase(), bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.warn('Could not get audio info', { error: error.message, filePath });
      return { size: 0, created: new Date(), modified: new Date(), extension: '', bigBrotherCompliant: this.bigBrotherCompliant };
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.audioProcessing('File deleted', { filePath });
      return true;
    } catch (error) {
      logger.error('Failed to delete file', { error: error.message, filePath });
      return false;
    }
  }

  async cleanupTempFile(filePath) {
    if (filePath && filePath.includes(this.tempDir)) await this.deleteFile(filePath);
  }

  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let cleaned = 0;
      const tempFiles = await fs.readdir(this.tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await this.deleteFile(filePath);
          cleaned++;
        }
      }
      logger.info('Temp files cleanup completed', { cleaned, maxAgeHours, bigBrotherCompliant: this.bigBrotherCompliant });
      return cleaned;
    } catch (error) {
      logger.error('Temp files cleanup failed', { error: error.message });
      return 0;
    }
  }

  async getFileStats() {
    try {
      const uploadFiles = await fs.readdir(this.uploadsDir);
      const tempFiles = await fs.readdir(this.tempDir);
      let totalUploadSize = 0, totalTempSize = 0;
      for (const file of uploadFiles) totalUploadSize += (await fs.stat(path.join(this.uploadsDir, file))).size;
      for (const file of tempFiles) totalTempSize += (await fs.stat(path.join(this.tempDir, file))).size;
      return { uploads: { count: uploadFiles.length, totalSize: totalUploadSize }, temp: { count: tempFiles.length, totalSize: totalTempSize }, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Failed to get file stats', { error: error.message });
      return { uploads: { count: 0, totalSize: 0 }, temp: { count: 0, totalSize: 0 }, bigBrotherCompliant: this.bigBrotherCompliant };
    }
  }

  async saveGeneratedAudio(audioStream, filename) {
    const startTime = Date.now();
    const filePath = path.join(this.uploadsDir, filename);
    try {
      const writeStream = require('fs').createWriteStream(filePath);
      audioStream.pipe(writeStream);
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      const stats = await fs.stat(filePath);
      const duration = Date.now() - startTime;
      logger.audioProcessing('Generated audio saved', { filename, size: stats.size, duration });
      return { success: true, filename, path: filePath, size: stats.size, duration, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Failed to save generated audio', { error: error.message, filename });
      throw error;
    }
  }

  isValidAudioFile(filename) { return voiceConfig.isAudioFormatSupported(filename); }
  getMaxFileSize() { return voiceConfig.getMaxFileSize(); }
}

module.exports = new AudioManager();