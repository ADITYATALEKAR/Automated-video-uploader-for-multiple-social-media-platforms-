/**
 * Social Media Video Uploader - JavaScript Implementation
 * Author: AI Assistant
 * Description: Upload video clips to multiple social media platforms
 * Dependencies: axios, form-data, fs, path
 * 
 * Usage:
 * const uploader = new SocialMediaUploader();
 * await uploader.uploadSingleClip('video.mp4', 'My Video Title');
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { EventEmitter } = require('events');

// ==========================================
// CONFIGURATION SETTINGS - EDIT THESE
// ==========================================

const CONFIG = {
    // Platform selection
    PLATFORMS_TO_UPLOAD: ['youtube', 'instagram', 'tiktok'],
    
    // YouTube API settings
    YOUTUBE: {
        CLIENT_ID: 'your_youtube_client_id_here',
        CLIENT_SECRET: 'your_youtube_client_secret_here',
        REDIRECT_URI: 'http://localhost:8080/callback'
    },
    
    // Instagram API settings
    INSTAGRAM: {
        ACCESS_TOKEN: 'your_instagram_long_lived_access_token_here',
        BUSINESS_ACCOUNT_ID: 'your_instagram_business_account_id_here'
    },
    
    // TikTok API settings
    TIKTOK: {
        CLIENT_KEY: 'your_tiktok_client_key_here',
        CLIENT_SECRET: 'your_tiktok_client_secret_here',
        REDIRECT_URI: 'http://localhost:8080/tiktok-callback'
    },
    
    // LinkedIn API settings
    LINKEDIN: {
        CLIENT_ID: 'your_linkedin_client_id_here',
        CLIENT_SECRET: 'your_linkedin_client_secret_here',
        PERSON_ID: 'your_linkedin_person_id_here'
    },
    
    // Twitter API settings
    TWITTER: {
        API_KEY: 'your_twitter_api_key_here',
        API_SECRET: 'your_twitter_api_secret_here',
        ACCESS_TOKEN: 'your_twitter_access_token_here',
        ACCESS_TOKEN_SECRET: 'your_twitter_access_token_secret_here'
    },
    
    // Upload behavior
    AUTO_PUBLISH: true,
    STAGGER_UPLOADS: true,
    STAGGER_MINUTES: 30,
    MAX_RETRIES: 3,
    
    // Default settings
    DEFAULT_PRIVACY: 'public',
    DEFAULT_TAGS: ['shorts', 'viral', 'video', 'content'],
    DEFAULT_DESCRIPTION: 'Check out this amazing clip! 🎬\n\n#shorts #viral #video',
    
    // Scheduling settings
    SCHEDULED_UPLOAD: false,
    UPLOAD_SCHEDULE: {
        youtube: '09:00',
        instagram: '12:00',
        tiktok: '18:00'
    },
    TIMEZONE: 'UTC',
    DELAY_BETWEEN_PLATFORMS: 300, // 5 minutes in seconds
    RANDOM_DELAY: true
};

// ==========================================
// DATA MODELS
// ==========================================

class VideoClip {
    constructor({
        filePath,
        title,
        description = CONFIG.DEFAULT_DESCRIPTION,
        tags = [...CONFIG.DEFAULT_TAGS],
        privacy = CONFIG.DEFAULT_PRIVACY,
        thumbnailPath = null,
        scheduleTime = null,
        platforms = [...CONFIG.PLATFORMS_TO_UPLOAD]
    }) {
        this.filePath = filePath;
        this.title = title;
        this.description = description;
        this.tags = tags;
        this.privacy = privacy;
        this.thumbnailPath = thumbnailPath;
        this.scheduleTime = scheduleTime;
        this.platforms = platforms;
        this.uploadUrls = {};
        this.createdAt = new Date();
    }

    validate() {
        if (!fs.existsSync(this.filePath)) {
            throw new Error(`File not found: ${this.filePath}`);
        }
        
        if (!this.title || this.title.trim() === '') {
            throw new Error('Title is required');
        }
        
        const stats = fs.statSync(this.filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > 500) { // 500MB limit
            throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max: 500MB)`);
        }
        
        return true;
    }
}

class UploadResult {
    constructor(platform, success, url = null, error = null) {
        this.platform = platform;
        this.success = success;
        this.url = url;
        this.error = error;
        this.uploadTime = new Date();
        this.retryCount = 0;
    }
}

// ==========================================
// UTILITY CLASSES
// ==========================================

class Logger {
    static info(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, data || '');
        this.writeToFile('INFO', message, data);
    }
    
    static error(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, error || '');
        this.writeToFile('ERROR', message, error);
    }
    
    static warning(message, data = null) {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARNING: ${message}`, data || '');
        this.writeToFile('WARNING', message, data);
    }
    
    static writeToFile(level, message, data) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message} ${data ? JSON.stringify(data) : ''}\n`;
        
        try {
            fs.appendFileSync('uploader.log', logEntry);
        } catch (err) {
            // Ignore file write errors
        }
    }
}

class RateLimiter {
    constructor(maxRequests = 50, windowMs = 3600000) { // 50 requests per hour
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }
    
    async checkLimit() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.windowMs - (now - oldestRequest);
            Logger.warning(`Rate limit reached, waiting ${Math.round(waitTime / 1000)}s`);
            await this.sleep(waitTime);
        }
        
        this.requests.push(now);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class Analytics {
    constructor() {
        this.data = {
            totalUploads: 0,
            successfulUploads: {},
            failedUploads: {},
            uploadHistory: [],
            platformPerformance: {}
        };
        this.loadFromFile();
    }
    
    recordUpload(platform, success, error = null) {
        this.data.totalUploads++;
        
        if (success) {
            this.data.successfulUploads[platform] = (this.data.successfulUploads[platform] || 0) + 1;
        } else {
            this.data.failedUploads[platform] = (this.data.failedUploads[platform] || 0) + 1;
        }
        
        if (!this.data.platformPerformance[platform]) {
            this.data.platformPerformance[platform] = {
                successRate: 0,
                totalAttempts: 0,
                lastUpload: null,
                commonErrors: {}
            };
        }
        
        const perf = this.data.platformPerformance[platform];
        perf.totalAttempts++;
        perf.lastUpload = new Date().toISOString();
        
        if (success) {
            perf.successRate = (this.data.successfulUploads[platform] || 0) / perf.totalAttempts;
        } else if (error) {
            perf.commonErrors[error] = (perf.commonErrors[error] || 0) + 1;
        }
        
        this.saveToFile();
    }
    
    addUploadBatch(batchData) {
        this.data.uploadHistory.push({
            timestamp: new Date().toISOString(),
            ...batchData
        });
        this.saveToFile();
    }
    
    getStats() {
        return { ...this.data };
    }
    
    saveToFile() {
        try {
            fs.writeFileSync('upload_analytics.json', JSON.stringify(this.data, null, 2));
        } catch (err) {
            Logger.error('Failed to save analytics', err.message);
        }
    }
    
    loadFromFile() {
        try {
            if (fs.existsSync('upload_analytics.json')) {
                const data = fs.readFileSync('upload_analytics.json', 'utf8');
                this.data = { ...this.data, ...JSON.parse(data) };
            }
        } catch (err) {
            Logger.error('Failed to load analytics', err.message);
        }
    }
}

// ==========================================
// PLATFORM UPLOADERS
// ==========================================

class PlatformUploader extends EventEmitter {
    constructor(platformName) {
        super();
        this.platformName = platformName;
        this.rateLimiter = new RateLimiter();
        this.authenticated = false;
    }
    
    async authenticate() {
        throw new Error('authenticate() must be implemented by subclass');
    }
    
    async upload(clip) {
        throw new Error('upload() must be implemented by subclass');
    }
    
    async uploadWithRetry(clip, maxRetries = CONFIG.MAX_RETRIES) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.rateLimiter.checkLimit();
                Logger.info(`Uploading to ${this.platformName} (attempt ${attempt}/${maxRetries})`);
                
                const result = await this.upload(clip);
                if (result) {
                    Logger.info(`✅ Successfully uploaded to ${this.platformName}: ${result}`);
                    return new UploadResult(this.platformName, true, result);
                }
            } catch (error) {
                lastError = error;
                Logger.error(`Upload to ${this.platformName} failed (attempt ${attempt}): ${error.message}`);
                
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    Logger.info(`Retrying in ${delay/1000}s...`);
                    await this.sleep(delay);
                }
            }
        }
        
        return new UploadResult(this.platformName, false, null, lastError?.message);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateRandomDelay() {
        return CONFIG.RANDOM_DELAY ? Math.floor(Math.random() * 60 * 1000) : 0; // 0-60 seconds
    }
}

class YouTubeUploader extends PlatformUploader {
    constructor() {
        super('YouTube');
        this.accessToken = null;
        this.refreshToken = null;
    }
    
    async authenticate() {
        // This is a simplified version - real implementation needs OAuth flow
        Logger.info('YouTube authentication required - implement OAuth 2.0 flow');
        
        // Mock authentication for demonstration
        if (CONFIG.YOUTUBE.CLIENT_ID !== 'your_youtube_client_id_here') {
            this.accessToken = 'mock_youtube_token';
            this.authenticated = true;
            return true;
        }
        
        return false;
    }
    
    async upload(clip) {
        if (!this.authenticated && !await this.authenticate()) {
            throw new Error('YouTube authentication failed');
        }
        
        // YouTube upload implementation would go here
        // This is a mock implementation
        const mockVideoId = `yt_${Date.now()}`;
        const videoUrl = `https://youtube.com/watch?v=${mockVideoId}`;
        
        Logger.info(`Mock YouTube upload: ${clip.title}`);
        Logger.info(`Description: ${clip.description.substring(0, 100)}...`);
        Logger.info(`Tags: ${clip.tags.join(', ')}`);
        
        // Simulate upload time
        await this.sleep(2000);
        
        return videoUrl;
    }
}

class InstagramUploader extends PlatformUploader {
    constructor() {
        super('Instagram');
        this.accessToken = CONFIG.INSTAGRAM.ACCESS_TOKEN;
        this.accountId = CONFIG.INSTAGRAM.BUSINESS_ACCOUNT_ID;
    }
    
    async authenticate() {
        if (!this.accessToken || this.accessToken === 'your_instagram_long_lived_access_token_here') {
            return false;
        }
        
        try {
            // Verify token validity
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/me?access_token=${this.accessToken}`
            );
            
            this.authenticated = true;
            return true;
        } catch (error) {
            Logger.error('Instagram token validation failed', error.message);
            return false;
        }
    }
    
    async upload(clip) {
        if (!this.authenticated && !await this.authenticate()) {
            throw new Error('Instagram authentication failed');
        }
        
        try {
            // Step 1: Create media container
            const createUrl = `https://graph.facebook.com/v18.0/${this.accountId}/media`;
            
            // Note: In real implementation, you'd need to upload the video file first
            // and provide the video_url parameter
            const mockVideoUrl = `https://example.com/uploads/${path.basename(clip.filePath)}`;
            
            const createParams = {
                media_type: 'REELS',
                video_url: mockVideoUrl,
                caption: `${clip.title}\n\n${clip.description}`,
                access_token: this.accessToken
            };
            
            Logger.info(`Mock Instagram Reels creation: ${clip.title}`);
            
            // Mock container creation
            const containerId = `ig_container_${Date.now()}`;
            
            // Step 2: Publish if auto-publish is enabled
            if (CONFIG.AUTO_PUBLISH) {
                const publishUrl = `https://graph.facebook.com/v18.0/${this.accountId}/media_publish`;
                const mediaId = `ig_media_${Date.now()}`;
                const videoUrl = `https://instagram.com/reel/${mediaId}`;
                
                Logger.info(`Mock Instagram publish successful: ${videoUrl}`);
                return videoUrl;
            } else {
                Logger.info(`Instagram media created as draft: ${containerId}`);
                return `https://instagram.com/draft/${containerId}`;
            }
            
        } catch (error) {
            throw new Error(`Instagram upload failed: ${error.message}`);
        }
    }
}

class TikTokUploader extends PlatformUploader {
    constructor() {
        super('TikTok');
        this.accessToken = null;
    }
    
    async authenticate() {
        Logger.warning('TikTok authentication requires OAuth flow - using mock for now');
        this.accessToken = 'mock_tiktok_token';
        this.authenticated = true;
        return true;
    }
    
    async upload(clip) {
        if (!this.authenticated && !await this.authenticate()) {
            throw new Error('TikTok authentication failed');
        }
        
        // Mock TikTok upload
        const mockVideoId = `tt_${Date.now()}`;
        const videoUrl = `https://tiktok.com/@user/video/${mockVideoId}`;
        
        Logger.info(`Mock TikTok upload: ${clip.title}`);
        Logger.info(`Description: ${clip.description.substring(0, 100)}...`);
        
        // Simulate upload time
        await this.sleep(1500);
        
        return videoUrl;
    }
}

class LinkedInUploader extends PlatformUploader {
    constructor() {
        super('LinkedIn');
        this.accessToken = null;
    }
    
    async authenticate() {
        Logger.warning('LinkedIn authentication requires OAuth flow - using mock for now');
        this.accessToken = 'mock_linkedin_token';
        this.authenticated = true;
        return true;
    }
    
    async upload(clip) {
        if (!this.authenticated && !await this.authenticate()) {
            throw new Error('LinkedIn authentication failed');
        }
        
        // Mock LinkedIn upload
        const mockPostId = `li_${Date.now()}`;
        const postUrl = `https://linkedin.com/posts/${mockPostId}`;
        
        Logger.info(`Mock LinkedIn upload: ${clip.title}`);
        
        await this.sleep(1800);
        return postUrl;
    }
}

class TwitterUploader extends PlatformUploader {
    constructor() {
        super('Twitter');
        this.credentials = CONFIG.TWITTER;
    }
    
    async authenticate() {
        if (!this.credentials.API_KEY || this.credentials.API_KEY === 'your_twitter_api_key_here') {
            return false;
        }
        
        Logger.warning('Twitter authentication requires OAuth implementation');
        this.authenticated = true;
        return true;
    }
    
    async upload(clip) {
        if (!this.authenticated && !await this.authenticate()) {
            throw new Error('Twitter authentication failed');
        }
        
        // Mock Twitter upload
        const mockTweetId = `tw_${Date.now()}`;
        const tweetUrl = `https://twitter.com/user/status/${mockTweetId}`;
        
        Logger.info(`Mock Twitter upload: ${clip.title}`);
        
        await this.sleep(1200);
        return tweetUrl;
    }
}

// ==========================================
// SCHEDULING SYSTEM
// ==========================================

class UploadScheduler extends EventEmitter {
    constructor() {
        super();
        this.scheduledJobs = new Map();
        this.isRunning = false;
    }
    
    scheduleUpload(clip, scheduleTime) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.scheduledJobs.set(jobId, {
            id: jobId,
            clip,
            scheduleTime: new Date(scheduleTime),
            status: 'scheduled',
            createdAt: new Date()
        });
        
        Logger.info(`Scheduled upload: ${clip.title} for ${scheduleTime}`);
        return jobId;
    }
    
    schedulePlatformUploads(clip, platformSchedule) {
        const jobIds = [];
        
        for (const [platform, time] of Object.entries(platformSchedule)) {
            const scheduleTime = new Date();
            const [hours, minutes] = time.split(':');
            scheduleTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // If time has passed today, schedule for tomorrow
            if (scheduleTime < new Date()) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
            }
            
            const platformClip = new VideoClip({
                ...clip,
                platforms: [platform]
            });
            
            const jobId = this.scheduleUpload(platformClip, scheduleTime);
            jobIds.push(jobId);
        }
        
        return jobIds;
    }
    
    startScheduler() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        Logger.info('Upload scheduler started');
        
        // Check for scheduled jobs every minute
        this.schedulerInterval = setInterval(() => {
            this.checkScheduledJobs();
        }, 60000);
    }
    
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.isRunning = false;
            Logger.info('Upload scheduler stopped');
        }
    }
    
    async checkScheduledJobs() {
        const now = new Date();
        
        for (const [jobId, job] of this.scheduledJobs.entries()) {
            if (job.status === 'scheduled' && job.scheduleTime <= now) {
                Logger.info(`Executing scheduled job: ${jobId}`);
                job.status = 'executing';
                
                try {
                    const uploader = new SocialMediaUploader();
                    const result = await uploader.uploadClips([job.clip]);
                    
                    job.status = 'completed';
                    job.result = result;
                    this.emit('jobCompleted', job);
                    
                } catch (error) {
                    job.status = 'failed';
                    job.error = error.message;
                    this.emit('jobFailed', job);
                    Logger.error(`Scheduled job failed: ${jobId}`, error.message);
                }
                
                // Remove completed/failed jobs after 24 hours
                setTimeout(() => {
                    this.scheduledJobs.delete(jobId);
                }, 24 * 60 * 60 * 1000);
            }
        }
    }
    
    getScheduledJobs() {
        return Array.from(this.scheduledJobs.values());
    }
}

// ==========================================
// MAIN UPLOADER CLASS
// ==========================================

class SocialMediaUploader extends EventEmitter {
    constructor() {
        super();
        
        this.uploaders = {
            youtube: new YouTubeUploader(),
            instagram: new InstagramUploader(),
            tiktok: new TikTokUploader(),
            linkedin: new LinkedInUploader(),
            twitter: new TwitterUploader()
        };
        
        this.analytics = new Analytics();
        this.scheduler = new UploadScheduler();
        
        Logger.info('Social Media Uploader initialized');
    }
    
    async uploadSingleClip(filePath, title, options = {}) {
        try {
            const clip = new VideoClip({
                filePath,
                title,
                description: options.description || CONFIG.DEFAULT_DESCRIPTION,
                tags: options.tags || [...CONFIG.DEFAULT_TAGS],
                privacy: options.privacy || CONFIG.DEFAULT_PRIVACY,
                platforms: options.platforms || [...CONFIG.PLATFORMS_TO_UPLOAD]
            });
            
            clip.validate();
            
            if (options.scheduleTime) {
                return this.scheduleUpload(clip, options.scheduleTime);
            }
            
            return await this.uploadClips([clip]);
            
        } catch (error) {
            Logger.error('Single clip upload failed', error.message);
            return {
                status: 'error',
                error: error.message,
                results: {},
                failed: [error.message]
            };
        }
    }
    
    async uploadFromFolder(folderPath, filePattern = '*.mp4') {
        try {
            if (!fs.existsSync(folderPath)) {
                throw new Error(`Folder not found: ${folderPath}`);
            }
            
            const files = fs.readdirSync(folderPath)
                .filter(file => file.endsWith('.mp4'))
                .map(file => path.join(folderPath, file));
            
            if (files.length === 0) {
                throw new Error(`No video files found in ${folderPath}`);
            }
            
            const clips = files.map(filePath => {
                const filename = path.basename(filePath, '.mp4');
                const title = filename.replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                return new VideoClip({
                    filePath,
                    title,
                    description: CONFIG.DEFAULT_DESCRIPTION,
                    tags: [...CONFIG.DEFAULT_TAGS]
                });
            });
            
            return await this.uploadClips(clips);
            
        } catch (error) {
            Logger.error('Folder upload failed', error.message);
            return {
                status: 'error',
                error: error.message,
                results: {},
                failed: [error.message]
            };
        }
    }
    
    async uploadClips(clips) {
        Logger.info(`Starting upload of ${clips.length} clips to platforms: ${CONFIG.PLATFORMS_TO_UPLOAD.join(', ')}`);
        
        const results = {};
        const failed = [];
        
        // Initialize results object
        CONFIG.PLATFORMS_TO_UPLOAD.forEach(platform => {
            results[platform] = [];
        });
        
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            Logger.info(`Processing clip ${i + 1}/${clips.length}: ${clip.title}`);
            
            // Validate clip
            try {
                clip.validate();
            } catch (error) {
                failed.push(`${clip.title}: ${error.message}`);
                continue;
            }
            
            // Upload to each platform
            for (const platform of CONFIG.PLATFORMS_TO_UPLOAD) {
                if (!this.uploaders[platform]) {
                    Logger.error(`Unknown platform: ${platform}`);
                    continue;
                }
                
                const uploader = this.uploaders[platform];
                
                try {
                    // Add random delay if enabled
                    if (CONFIG.RANDOM_DELAY) {
                        const delay = Math.floor(Math.random() * 60000); // 0-60 seconds
                        await this.sleep(delay);
                    }
                    
                    const result = await uploader.uploadWithRetry(clip);
                    
                    if (result.success) {
                        clip.uploadUrls[platform] = result.url;
                        results[platform].push(result.url);
                        this.analytics.recordUpload(platform, true);
                        
                        this.emit('uploadSuccess', {
                            platform,
                            clip: clip.title,
                            url: result.url
                        });
                        
                    } else {
                        failed.push(`${clip.title} -> ${platform}: ${result.error}`);
                        this.analytics.recordUpload(platform, false, result.error);
                        
                        this.emit('uploadFailed', {
                            platform,
                            clip: clip.title,
                            error: result.error
                        });
                    }
                    
                } catch (error) {
                    const errorMsg = `${clip.title} -> ${platform}: ${error.message}`;
                    failed.push(errorMsg);
                    this.analytics.recordUpload(platform, false, error.message);
                    Logger.error(`Upload exception: ${errorMsg}`);
                }
            }
            
            // Stagger uploads if enabled and not the last clip
            if (CONFIG.STAGGER_UPLOADS && i < clips.length - 1) {
                const staggerMs = CONFIG.STAGGER_MINUTES * 60 * 1000;
                Logger.info(`Waiting ${CONFIG.STAGGER_MINUTES} minutes before next clip...`);
                await this.sleep(staggerMs);
            }
        }
        
        // Record batch analytics
        this.analytics.addUploadBatch({
            clipsCount: clips.length,
            platforms: [...CONFIG.PLATFORMS_TO_UPLOAD],
            results,
            failed
        });
        
        const successCount = Object.values(results).flat().length;
        Logger.info(`Upload batch completed! Successful: ${successCount}, Failed: ${failed.length}`);
        
        this.emit('batchComplete', { results, failed });
        
        return {
            status: 'completed',
            results,
            failed,
            analytics: this.analytics.getStats()
        };
    }
    
    scheduleUpload(clip, scheduleTime, platformSchedule = null) {
        if (platformSchedule) {
            return this.scheduler.schedulePlatformUploads(clip, platformSchedule);
        } else {
            return this.scheduler.scheduleUpload(clip, scheduleTime);
        }
    }
    
    startScheduler() {
        this.scheduler.startScheduler();
    }
    
    stopScheduler() {
        this.scheduler.stopScheduler();
    }
    
    getAnalytics() {
        return this.analytics.getStats();
    }
    
    getScheduledJobs() {
        return this.scheduler.getScheduledJobs();
    }
    
    validateCredentials() {
        const missing = [];
        
        CONFIG.PLATFORMS_TO_UPLOAD.forEach(platform => {
            const platformConfig = CONFIG[platform.toUpperCase()];
            if (!platformConfig) return;
            
            Object.entries(platformConfig).forEach(([key, value]) => {
                if (!value || value.includes('your_') || value.includes('_here')) {
                    missing.push(`${platform.toUpperCase()} ${key}`);
                }
            });
        });
        
        return missing;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

async function uploadSingleFile(filePath, title, options = {}) {
    const uploader = new SocialMediaUploader();
    return await uploader.uploadSingleClip(filePath, title, options);
}

async function uploadFromFolder(folderPath, options = {}) {
    const uploader = new SocialMediaUploader();
    return await uploader.uploadFromFolder(folderPath);
}

function validateConfiguration() {
    const uploader = new SocialMediaUploader();
    const missing = uploader.validateCredentials();
    
    if (missing.length > 0) {
        console.log('Missing credentials:');
        missing.forEach(cred => console.log(`  - ${cred}`));
        return false;
    }
    
    console.log('All configured platform credentials are set');
    return true;
}

// ==========================================
// MODULE EXPORTS
// ==========================================

module.exports = {
    SocialMediaUploader,
    VideoClip,
    UploadResult,
    UploadScheduler,
    Logger,
    Analytics,
    uploadSingleFile,
    uploadFromFolder,
    validateConfiguration,
    CONFIG
};

// ==========================================
// CLI INTERFACE (if run directly)
// ==========================================

if (require.main === module) {
    const args = process.argv.slice(2);
    
    async function main() {
        if (args.includes('--help')) {
            console.log(`
Social Media Video Uploader - JavaScript

Usage:
  node uploader.js --file video.mp4 --title "My Video"
  node uploader.js --folder clips
  node uploader.js --schedule --file video.mp4 --time "2025-01-15 14:30"
  node uploader.js --check-credentials
  node uploader.js --analytics
  node uploader.js --start-scheduler

Options:
  --file <path>           Upload single video file
  --folder <path>         Upload all videos from folder (default: clips)
  --title <title>         Video title for single file upload
  --description <desc>    Video description
  --tags <tag1,tag2>      Comma-separated tags
  --privacy <level>       public, unlisted, or private
  --platforms <list>      Comma-separated platform list
  --schedule              Enable scheduled upload
  --time <datetime>       Schedule time (YYYY-MM-DD HH:MM)
  --youtube-time <time>   Schedule YouTube upload (HH:MM)
  --instagram-time <time> Schedule Instagram upload (HH:MM)
  --tiktok-time <time>    Schedule TikTok upload (HH:MM)
  --delay <seconds>       Delay between platform uploads
  --check-credentials     Validate API credentials
  --analytics             Show upload statistics
  --start-scheduler       Start background scheduler
  --list-jobs             Show scheduled jobs
  --help                  Show this help message

Examples:
  node uploader.js --file "my_video.mp4" --title "Amazing Content"
  node uploader.js --folder "clips" --delay 300
  node uploader.js --file "video.mp4" --youtube-time "09:00" --instagram-time "12:00"
  node uploader.js --schedule --file "video.mp4" --time "2025-01-15 14:30"
            `);
            return;
        }
        
        const uploader = new SocialMediaUploader();
        
        // Event listeners for real-time feedback
        uploader.on('uploadSuccess', (data) => {
            console.log(`✅ ${data.platform}: ${data.url}`);
        });
        
        uploader.on('uploadFailed', (data) => {
            console.log(`❌ ${data.platform}: ${data.error}`);
        });
        
        uploader.on('batchComplete', (data) => {
            const totalSuccess = Object.values(data.results).flat().length;
            console.log(`\n📊 Batch completed - Success: ${totalSuccess}, Failed: ${data.failed.length}`);
        });
        
        // Parse command line arguments
        const fileIndex = args.indexOf('--file');
        const folderIndex = args.indexOf('--folder');
        const titleIndex = args.indexOf('--title');
        const scheduleIndex = args.indexOf('--schedule');
        const timeIndex = args.indexOf('--time');
        const delayIndex = args.indexOf('--delay');
        
        // Check credentials
        if (args.includes('--check-credentials')) {
            const missing = uploader.validateCredentials();
            if (missing.length > 0) {
                console.log('Missing credentials:');
                missing.forEach(cred => console.log(`  - ${cred}`));
                process.exit(1);
            } else {
                console.log('✅ All configured platform credentials are set');
                process.exit(0);
            }
        }
        
        // Show analytics
        if (args.includes('--analytics')) {
            const analytics = uploader.getAnalytics();
            console.log('\n📈 Upload Analytics:');
            console.log(`Total uploads: ${analytics.totalUploads}`);
            console.log('\nSuccessful uploads by platform:');
            Object.entries(analytics.successfulUploads).forEach(([platform, count]) => {
                console.log(`  ${platform}: ${count}`);
            });
            
            if (analytics.uploadHistory.length > 0) {
                console.log('\nRecent upload batches:');
                analytics.uploadHistory.slice(-5).forEach(batch => {
                    console.log(`  ${batch.timestamp}: ${batch.clipsCount} clips`);
                });
            }
            return;
        }
        
        // Start scheduler
        if (args.includes('--start-scheduler')) {
            console.log('🕐 Starting upload scheduler...');
            uploader.startScheduler();
            
            uploader.scheduler.on('jobCompleted', (job) => {
                console.log(`✅ Scheduled job completed: ${job.clip.title}`);
            });
            
            uploader.scheduler.on('jobFailed', (job) => {
                console.log(`❌ Scheduled job failed: ${job.clip.title} - ${job.error}`);
            });
            
            console.log('Scheduler running. Press Ctrl+C to stop.');
            
            // Keep process alive
            process.on('SIGINT', () => {
                console.log('\n🛑 Stopping scheduler...');
                uploader.stopScheduler();
                process.exit(0);
            });
            
            // Prevent process from exiting
            setInterval(() => {}, 1000);
            return;
        }
        
        // List scheduled jobs
        if (args.includes('--list-jobs')) {
            const jobs = uploader.getScheduledJobs();
            if (jobs.length === 0) {
                console.log('No scheduled jobs found');
            } else {
                console.log('\n📅 Scheduled Jobs:');
                jobs.forEach(job => {
                    console.log(`  ${job.id}: ${job.clip.title} - ${job.scheduleTime} (${job.status})`);
                });
            }
            return;
        }
        
        // Parse upload options
        const options = {};
        
        if (titleIndex !== -1 && titleIndex + 1 < args.length) {
            options.title = args[titleIndex + 1];
        }
        
        if (args.includes('--description')) {
            const descIndex = args.indexOf('--description');
            if (descIndex + 1 < args.length) {
                options.description = args[descIndex + 1];
            }
        }
        
        if (args.includes('--tags')) {
            const tagsIndex = args.indexOf('--tags');
            if (tagsIndex + 1 < args.length) {
                options.tags = args[tagsIndex + 1].split(',').map(tag => tag.trim());
            }
        }
        
        if (args.includes('--privacy')) {
            const privacyIndex = args.indexOf('--privacy');
            if (privacyIndex + 1 < args.length) {
                options.privacy = args[privacyIndex + 1];
            }
        }
        
        if (args.includes('--platforms')) {
            const platformsIndex = args.indexOf('--platforms');
            if (platformsIndex + 1 < args.length) {
                options.platforms = args[platformsIndex + 1].split(',').map(p => p.trim());
            }
        }
        
        // Handle scheduling
        if (scheduleIndex !== -1) {
            if (timeIndex !== -1 && timeIndex + 1 < args.length) {
                options.scheduleTime = new Date(args[timeIndex + 1]);
            }
            
            // Platform-specific scheduling
            const platformSchedule = {};
            
            if (args.includes('--youtube-time')) {
                const ytTimeIndex = args.indexOf('--youtube-time');
                if (ytTimeIndex + 1 < args.length) {
                    platformSchedule.youtube = args[ytTimeIndex + 1];
                }
            }
            
            if (args.includes('--instagram-time')) {
                const igTimeIndex = args.indexOf('--instagram-time');
                if (igTimeIndex + 1 < args.length) {
                    platformSchedule.instagram = args[igTimeIndex + 1];
                }
            }
            
            if (args.includes('--tiktok-time')) {
                const ttTimeIndex = args.indexOf('--tiktok-time');
                if (ttTimeIndex + 1 < args.length) {
                    platformSchedule.tiktok = args[ttTimeIndex + 1];
                }
            }
            
            if (Object.keys(platformSchedule).length > 0) {
                options.platformSchedule = platformSchedule;
            }
        }
        
        // Handle delay setting
        if (delayIndex !== -1 && delayIndex + 1 < args.length) {
            CONFIG.DELAY_BETWEEN_PLATFORMS = parseInt(args[delayIndex + 1]);
        }
        
        let result;
        
        try {
            if (fileIndex !== -1 && fileIndex + 1 < args.length) {
                // Single file upload
                const filePath = args[fileIndex + 1];
                const title = options.title || path.basename(filePath, path.extname(filePath))
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                if (options.scheduleTime) {
                    console.log(`🕐 Scheduling upload: ${title} for ${options.scheduleTime}`);
                    uploader.startScheduler();
                    result = uploader.scheduleUpload(
                        new VideoClip({ filePath, title, ...options }),
                        options.scheduleTime
                    );
                    console.log(`Scheduled job ID: ${result}`);
                } else if (options.platformSchedule) {
                    console.log(`🕐 Scheduling platform-specific uploads for: ${title}`);
                    uploader.startScheduler();
                    const clip = new VideoClip({ filePath, title, ...options });
                    result = uploader.scheduleUpload(clip, null, options.platformSchedule);
                    console.log(`Scheduled job IDs: ${result.join(', ')}`);
                } else {
                    result = await uploader.uploadSingleClip(filePath, title, options);
                }
                
            } else if (folderIndex !== -1 && folderIndex + 1 < args.length) {
                // Folder upload
                const folderPath = args[folderIndex + 1];
                result = await uploader.uploadFromFolder(folderPath, options);
                
            } else {
                // Default folder upload
                result = await uploader.uploadFromFolder('clips', options);
            }
            
            if (result && result.status) {
                console.log(`\n🎯 Upload completed with status: ${result.status}`);
                
                if (result.failed && result.failed.length > 0) {
                    console.log('\n❌ Failed uploads:');
                    result.failed.forEach(fail => console.log(`  - ${fail}`));
                }
                
                if (result.results) {
                    console.log('\n✅ Successful uploads:');
                    Object.entries(result.results).forEach(([platform, urls]) => {
                        if (urls.length > 0) {
                            console.log(`  ${platform}:`);
                            urls.forEach(url => console.log(`    - ${url}`));
                        }
                    });
                }
            }
            
        } catch (error) {
            Logger.error('CLI execution failed', error.message);
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    }
    
    main().catch(error => {
        Logger.error('Unhandled error in main', error);
        console.error('Unhandled error:', error.message);
        process.exit(1);
    });
}

// ==========================================
// EXAMPLE USAGE
// ==========================================

/*
// Basic usage examples:

// 1. Upload single video immediately
const uploader = new SocialMediaUploader();
const result = await uploader.uploadSingleClip('my_video.mp4', 'Amazing Content');

// 2. Upload with custom settings
const result2 = await uploader.uploadSingleClip('video.mp4', 'Custom Title', {
    description: 'My custom description #hashtag',
    tags: ['custom', 'amazing', 'content'],
    privacy: 'public',
    platforms: ['youtube', 'instagram']
});

// 3. Schedule upload for specific time
const result3 = await uploader.uploadSingleClip('video.mp4', 'Scheduled Content', {
    scheduleTime: new Date('2025-01-15T14:30:00')
});

// 4. Platform-specific scheduling
const clip = new VideoClip({
    filePath: 'video.mp4',
    title: 'Multi-Platform Scheduled'
});

const jobIds = uploader.scheduleUpload(clip, null, {
    youtube: '09:00',
    instagram: '12:00',
    tiktok: '18:00'
});

// 5. Upload from folder
const folderResult = await uploader.uploadFromFolder('clips');

// 6. Start scheduler service
uploader.startScheduler();

// 7. Get analytics
const analytics = uploader.getAnalytics();
console.log('Upload stats:', analytics);

// 8. Event handling
uploader.on('uploadSuccess', (data) => {
    console.log(`Success: ${data.platform} - ${data.url}`);
});

uploader.on('uploadFailed', (data) => {
    console.log(`Failed: ${data.platform} - ${data.error}`);
});

uploader.on('batchComplete', (data) => {
    console.log('Batch upload completed');
});

*/