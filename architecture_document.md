# Social Media Video Uploader - Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [Authentication Architecture](#authentication-architecture)
6. [Platform Integration](#platform-integration)
7. [Scheduling System](#scheduling-system)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Security Architecture](#security-architecture)
11. [Extensibility Design](#extensibility-design)
12. [Deployment Architecture](#deployment-architecture)

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Interface Layer                    │
├─────────────────────┬───────────────────┬───────────────────┤
│   Command Line      │  Jupyter Notebook │   Future Web UI   │
│     Interface       │     Interface     │                   │
└─────────────────────┴───────────────────┴───────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Core Application Layer                      │
├─────────────────────────────────────────────────────────────┤
│              SocialMediaUploader (Main Orchestrator)       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                     │
├──────────────┬──────────────┬──────────────┬──────────────┤
│   Upload     │  Scheduling  │  Analytics   │    Rate      │
│  Management  │   System     │   Tracking   │  Limiting    │
└──────────────┴──────────────┴──────────────┴──────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Platform Abstraction Layer                  │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ PlatformUploader (Abstract Base Class)                    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ YouTube      │   TikTok     │  Instagram   │   LinkedIn   │
│ Uploader     │  Uploader    │   Uploader   │   Uploader   │
└──────────────┴──────────────┴──────────────┴──────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 External Services Layer                    │
├──────────────┬──────────────┬──────────────┬──────────────┤
│  YouTube     │   TikTok     │ Instagram    │   LinkedIn   │
│  Data API    │Content API   │  Graph API   │    API       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### System Characteristics

- **Pattern**: Layered Architecture with Strategy Pattern for platform-specific implementations
- **Paradigm**: Object-Oriented with functional programming elements
- **Concurrency**: Asynchronous operations with rate limiting
- **Data Flow**: Unidirectional with event-driven scheduling
- **Scalability**: Horizontal scaling through platform abstraction

## Architecture Patterns

### 1. Strategy Pattern
Each platform uploader implements the same interface but with platform-specific behavior:

```python
class PlatformUploader(ABC):
    @abstractmethod
    def upload(self, clip: VideoClip) -> Optional[str]:
        pass
    
    @abstractmethod
    def authenticate(self) -> bool:
        pass
```

### 2. Factory Pattern
Platform uploaders are created dynamically based on configuration:

```python
class UploaderFactory:
    @staticmethod
    def create_uploader(platform: str) -> PlatformUploader:
        uploaders = {
            'youtube': YouTubeUploader,
            'tiktok': TikTokUploader,
            'instagram': InstagramUploader
        }
        return uploaders[platform]()
```

### 3. Observer Pattern
Analytics system observes upload events for tracking:

```python
class AnalyticsObserver:
    def on_upload_start(self, platform: str, clip: VideoClip):
        pass
    
    def on_upload_complete(self, platform: str, result: UploadResult):
        pass
```

### 4. Template Method Pattern
Common upload workflow with platform-specific implementations:

```python
def upload_workflow(self, clip: VideoClip):
    self.pre_upload_validation(clip)
    self.check_rate_limit()
    result = self.platform_specific_upload(clip)  # Implemented by subclasses
    self.post_upload_processing(result)
```

## Core Components

### 1. SocialMediaUploader (Main Orchestrator)

**Responsibilities:**
- Coordinate uploads across multiple platforms
- Manage upload queues and scheduling
- Handle retry logic and error recovery
- Maintain upload analytics and history

**Key Methods:**
- `upload_clips(clips: List[VideoClip])` - Batch upload orchestration
- `upload_single_clip(path: str, **kwargs)` - Single file upload
- `schedule_upload(clip: VideoClip, schedule_time: datetime)` - Scheduled upload
- `get_analytics()` - Retrieve upload statistics

### 2. VideoClip (Data Model)

**Purpose:** Encapsulate video metadata and upload configuration

```python
@dataclass
class VideoClip:
    file_path: str
    title: str
    description: str
    tags: List[str]
    privacy: str = "public"
    thumbnail_path: Optional[str] = None
    upload_urls: Dict[str, str] = field(default_factory=dict)
    schedule_time: Optional[datetime] = None
    platforms: List[str] = field(default_factory=list)
```

### 3. PlatformUploader (Abstract Base)

**Purpose:** Define common interface and shared functionality for all platforms

**Shared Features:**
- Rate limiting enforcement
- Authentication token management
- Retry logic with exponential backoff
- Upload progress tracking
- Error handling and logging

### 4. Platform-Specific Uploaders

Each platform uploader handles:
- Platform-specific authentication flows
- API request formatting and validation
- File upload protocols (chunked, resumable, etc.)
- Platform-specific error handling
- Metadata mapping and transformation

## Data Models

### Core Data Structures

```python
# Video clip representation
class VideoClip:
    file_path: str              # Local file path
    title: str                  # Video title
    description: str            # Video description
    tags: List[str]            # Hashtags/keywords
    privacy: str               # public/unlisted/private
    thumbnail_path: str        # Optional thumbnail
    upload_urls: Dict[str, str] # Platform -> URL mapping
    schedule_time: datetime    # When to upload
    platforms: List[str]       # Target platforms

# Upload result tracking
@dataclass
class UploadResult:
    platform: str
    success: bool
    url: Optional[str]
    error_message: Optional[str]
    upload_time: datetime
    file_size: int
    duration: float

# Analytics data model
class UploadAnalytics:
    total_uploads: int
    successful_uploads: Dict[str, int]  # Platform -> count
    failed_uploads: Dict[str, int]
    upload_history: List[UploadBatch]
    platform_performance: Dict[str, PlatformStats]

# Platform statistics
@dataclass
class PlatformStats:
    success_rate: float
    avg_upload_time: float
    last_successful_upload: datetime
    rate_limit_hits: int
    common_errors: Dict[str, int]
```

### Configuration Models

```python
@dataclass
class PlatformConfig:
    enabled: bool
    credentials: Dict[str, str]
    rate_limits: RateLimitConfig
    upload_settings: UploadSettings

@dataclass  
class RateLimitConfig:
    requests_per_hour: int
    requests_per_day: int
    cooldown_seconds: int

@dataclass
class UploadSettings:
    default_privacy: str
    auto_publish: bool
    retry_attempts: int
    chunk_size: int
```

## Authentication Architecture

### Multi-Platform Authentication Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                 Authentication Manager                      │
├─────────────────────────────────────────────────────────────┤
│  • Token Storage & Retrieval                               │
│  • Automatic Token Refresh                                 │
│  • Multi-Platform Credential Management                    │
│  • Secure Storage (Keyring/Environment Variables)          │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────┬─────────────┬─────────────┬─────────────┐
    │             │             │             │             │
┌───▼───┐    ┌───▼───┐    ┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│YouTube│    │TikTok │    │Insta  │    │LinkedIn│   │Twitter│
│OAuth2 │    │OAuth2 │    │Graph  │    │OAuth2 │    │OAuth1 │
│       │    │       │    │Token  │    │       │    │&OAuth2│
└───────┘    └───────┘    └───────┘    └───────┘    └───────┘
```

### Authentication Flow

1. **Initial Authentication**
   - Platform-specific OAuth flows
   - Credential validation and storage
   - Token encryption and persistence

2. **Token Management**
   - Automatic token refresh before expiration
   - Fallback to re-authentication if refresh fails
   - Secure token storage using system keyring

3. **Error Handling**
   - Invalid credential detection
   - Expired token recovery
   - Rate limit authentication delays

## Platform Integration

### YouTube Integration

**API:** YouTube Data API v3
**Authentication:** OAuth 2.0 with refresh tokens
**Upload Method:** Resumable uploads with chunking

```python
class YouTubeUploader:
    def authenticate(self):
        # OAuth 2.0 flow with Google APIs
        # Store credentials in pickle file
        
    def upload(self, clip: VideoClip):
        # Create upload request with metadata
        # Use MediaFileUpload for large files
        # Handle resumable upload protocol
```

**Key Features:**
- Resumable uploads for large files
- Automatic retry on network failures
- Metadata optimization for YouTube algorithm
- Thumbnail upload support

### Instagram Integration

**API:** Instagram Graph API (Meta Business)
**Authentication:** Long-lived access tokens
**Upload Method:** Two-step process (create container + publish)

```python
class InstagramUploader:
    def upload(self, clip: VideoClip):
        # Step 1: Create media container
        container = self.create_media_container(clip)
        
        # Step 2: Publish media (if auto-publish enabled)
        if AUTO_PUBLISH:
            return self.publish_media(container['id'])
```

**Key Features:**
- Reels-specific formatting
- Caption and hashtag optimization
- Container-based publishing workflow

### TikTok Integration (Future Implementation)

**API:** TikTok Content Posting API
**Authentication:** OAuth 2.0 with app approval
**Upload Method:** Direct video upload with metadata

**Considerations:**
- Strict approval process for API access
- Content moderation requirements
- Limited upload frequency

## Scheduling System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Engine                         │
├─────────────────────────────────────────────────────────────┤
│  • Job Queue Management                                     │
│  • Time-based Trigger System                               │
│  • Platform-specific Scheduling                            │
│  • Retry and Failure Recovery                              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Execution Engine                          │
├─────────────────────────────────────────────────────────────┤
│  • Background Task Processing                               │
│  • Upload Queue Management                                  │
│  • Rate Limit Coordination                                 │
│  • Progress Monitoring                                      │
└─────────────────────────────────────────────────────────────┘
```

### Scheduling Components

1. **Job Scheduler**
   ```python
   class UploadScheduler:
       def schedule_upload(self, clip: VideoClip, schedule_time: datetime):
           job = ScheduledJob(
               clip=clip,
               execute_time=schedule_time,
               platforms=clip.platforms,
               retry_count=0
           )
           self.job_queue.add(job)
   ```

2. **Time-based Triggers**
   ```python
   class TimeTrigger:
       def check_pending_jobs(self):
           current_time = datetime.now()
           ready_jobs = [job for job in self.job_queue 
                        if job.execute_time <= current_time]
           return ready_jobs
   ```

3. **Platform Coordination**
   ```python
   class PlatformScheduler:
       def coordinate_uploads(self, job: ScheduledJob):
           # Stagger uploads across platforms
           for i, platform in enumerate(job.platforms):
               delay = i * PLATFORM_DELAY_MINUTES * 60
               self.schedule_platform_upload(platform, job.clip, delay)
   ```

## Error Handling Strategy

### Error Classification

1. **Transient Errors** (Retry-able)
   - Network timeouts
   - Rate limit exceeded
   - Temporary API unavailability
   - Authentication token expired

2. **Permanent Errors** (Non-retry-able)
   - Invalid file format
   - Content policy violations
   - Insufficient permissions
   - File not found

3. **Platform-Specific Errors**
   - YouTube: Quota exceeded, copyright issues
   - Instagram: Media processing failed
   - TikTok: Content moderation rejection

### Error Handling Architecture

```python
class ErrorHandler:
    def handle_upload_error(self, error: Exception, context: UploadContext):
        if self.is_transient_error(error):
            return self.schedule_retry(context)
        elif self.is_recoverable_error(error):
            return self.attempt_recovery(error, context)
        else:
            return self.log_permanent_failure(error, context)
            
    def schedule_retry(self, context: UploadContext):
        delay = self.calculate_exponential_backoff(context.retry_count)
        context.retry_count += 1
        self.scheduler.schedule_retry(context, delay)
```

### Retry Strategy

- **Exponential Backoff:** 2^retry_count * base_delay
- **Maximum Retries:** Configurable per platform (default: 3)
- **Jitter:** Random delay component to avoid thundering herd
- **Circuit Breaker:** Temporary platform disable after consecutive failures

## Performance Considerations

### Upload Optimization

1. **Chunked Uploads**
   - Large files split into manageable chunks
   - Resumable upload support
   - Parallel chunk processing where supported

2. **Connection Pooling**
   - Reuse HTTP connections for multiple uploads
   - Platform-specific connection limits
   - Keep-alive optimization

3. **Compression and Encoding**
   - Pre-upload video optimization
   - Format validation and conversion
   - Thumbnail generation

### Memory Management

```python
class MemoryOptimizedUploader:
    def upload_large_file(self, file_path: str):
        # Stream file in chunks rather than loading entirely
        with open(file_path, 'rb') as file:
            while chunk := file.read(CHUNK_SIZE):
                yield chunk
                
    def cleanup_temp_files(self):
        # Automatic cleanup of temporary processing files
        for temp_file in self.temp_files:
            os.unlink(temp_file)
```

### Concurrency Model

- **Async I/O:** Non-blocking network operations
- **Thread Pool:** Background processing for CPU-intensive tasks
- **Queue Management:** FIFO upload queue with priority support
- **Resource Limiting:** Maximum concurrent uploads per platform

## Security Architecture

### Data Protection

1. **Credential Security**
   ```python
   class SecureCredentialManager:
       def store_credentials(self, platform: str, credentials: Dict):
           encrypted_creds = self.encrypt(credentials)
           keyring.set_password("uploader", platform, encrypted_creds)
           
       def retrieve_credentials(self, platform: str):
           encrypted_creds = keyring.get_password("uploader", platform)
           return self.decrypt(encrypted_creds)
   ```

2. **Token Management**
   - Encrypted storage of OAuth tokens
   - Automatic token rotation
   - Secure transmission over HTTPS only

3. **File Security**
   - Temporary file cleanup
   - No persistent storage of uploaded content
   - Secure file permissions

### Privacy Considerations

- **Local Processing:** All operations performed locally
- **No Data Collection:** No user analytics or tracking
- **Configurable Logging:** Option to disable detailed logs
- **Memory Cleanup:** Secure deletion of sensitive data

## Extensibility Design

### Plugin Architecture

```python
class PluginManager:
    def load_platform_plugin(self, platform_name: str):
        plugin_module = importlib.import_module(f"plugins.{platform_name}")
        uploader_class = getattr(plugin_module, f"{platform_name.title()}Uploader")
        return uploader_class()

# Example plugin structure
class CustomPlatformUploader(PlatformUploader):
    def authenticate(self) -> bool:
        # Platform-specific auth logic
        pass
        
    def upload(self, clip: VideoClip) -> Optional[str]:
        # Platform-specific upload logic
        pass
```

### Configuration Extensions

```python
class ConfigurationManager:
    def load_platform_config(self, platform: str):
        config_path = f"configs/{platform}.yaml"
        with open(config_path) as f:
            return yaml.safe_load(f)
            
    def validate_config(self, config: Dict):
        # JSON Schema validation
        jsonschema.validate(config, self.config_schema)
```

### Event System

```python
class EventManager:
    def __init__(self):
        self.listeners = defaultdict(list)
    
    def subscribe(self, event_type: str, callback: Callable):
        self.listeners[event_type].append(callback)
    
    def emit(self, event_type: str, data: Any):
        for callback in self.listeners[event_type]:
            callback(data)

# Usage
event_manager.subscribe("upload_complete", analytics_tracker.record_upload)
event_manager.subscribe("upload_failed", error_reporter.log_failure)
```

## Deployment Architecture

### Deployment Options

1. **Local Development**
   ```
   ├── Python Environment (3.7+)
   ├── Dependencies (pip install -r requirements.txt)
   ├── Configuration Files
   └── Credential Storage (OS Keyring)
   ```

2. **Docker Deployment**
   ```dockerfile
   FROM python:3.11-slim
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . /app
   WORKDIR /app
   CMD ["python", "AutomaticVideoUploader.py"]
   ```

3. **Cloud Deployment** (Future)
   - AWS Lambda for scheduled uploads
   - Google Cloud Functions for event-driven processing
   - Azure Functions for hybrid cloud scenarios

### Environment Configuration

```python
class EnvironmentManager:
    def __init__(self):
        self.env = os.getenv("UPLOADER_ENV", "development")
        self.config = self.load_environment_config()
    
    def load_environment_config(self):
        config_file = f"config/{self.env}.yaml"
        return self.load_yaml_config(config_file)
```

### Monitoring and Observability

1. **Logging Architecture**
   - Structured logging (JSON format)
   - Log levels: DEBUG, INFO, WARNING, ERROR
   - Rotating log files
   - Optional external log aggregation

2. **Metrics Collection**
   - Upload success/failure rates
   - Platform-specific performance metrics
   - API response times
   - Error frequency and types

3. **Health Checks**
   - Platform connectivity verification
   - Credential validation
   - System resource monitoring

## Future Architecture Considerations

### Scalability Improvements

1. **Microservices Architecture**
   - Separate services for each platform
   - API Gateway for unified interface
   - Message queues for async processing

2. **Database Integration**
   - Persistent job storage
   - Upload history and analytics
   - User management system

3. **Web Interface**
   - React/Vue.js frontend
   - REST API backend
   - Real-time upload progress

### Advanced Features

1. **Machine Learning Integration**
   - Optimal posting time prediction
   - Content performance analysis
   - Automated tag suggestion

2. **Content Management**
   - Video preprocessing pipeline
   - Thumbnail generation
   - Format optimization

3. **Multi-tenant Support**
   - User isolation
   - Per-tenant configuration
   - Usage quotas and billing

This architecture provides a solid foundation for the current implementation while allowing for future enhancements and scaling as requirements evolve.