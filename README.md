# Automated-video-uploader-for-multiple-social-media-platforms-

A comprehensive Python tool for automatically uploading video clips to multiple social media platforms including YouTube, TikTok, Instagram, LinkedIn, and Twitter/X with scheduled posting capabilities and timing controls.

## Features

- **Multi-Platform Support**: Upload to YouTube, TikTok, Instagram Reels, LinkedIn, and Twitter/X
- **Scheduled Uploads**: Set specific times and dates for automatic video publishing
- **Timer-Based Posting**: Configure delays and intervals between uploads across platforms
- **Batch Upload**: Process multiple videos from a folder automatically
- **Rate Limit Handling**: Built-in rate limiting for each platform to avoid API restrictions
- **Retry Logic**: Automatic retry with exponential backoff for failed uploads
- **Upload Analytics**: Track success/failure rates and maintain upload history
- **Configurable Settings**: Customize privacy, descriptions, tags, and upload behavior
- **Staggered Uploads**: Optional delays between uploads to prevent rate limiting
- **Authentication Management**: Secure token storage and automatic refresh
- **Jupyter Notebook Support**: Works in both command line and notebook environments

## Installation

### Prerequisites

- Python 3.7+
- Valid API credentials for the platforms you want to use

### Install Dependencies

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client requests python-dotenv
```

Or install from requirements.txt:

```bash
pip install -r requirements.txt
```

### Clone Repository

```bash
git clone https://github.com/yourusername/social-media-uploader.git
cd social-media-uploader
```

## Quick Start

### 1. Configure API Credentials

Edit the configuration section at the top of `AutomaticVideoUploader.ipynb` or create a `.env` file:

```python
# YOUTUBE API SETTINGS
YOUTUBE_CLIENT_ID = "your_youtube_client_id_here"
YOUTUBE_CLIENT_SECRET = "your_youtube_client_secret_here"

# INSTAGRAM API SETTINGS (Meta Business)
INSTAGRAM_ACCESS_TOKEN = "your_instagram_long_lived_access_token_here"
INSTAGRAM_BUSINESS_ACCOUNT_ID = "your_instagram_business_account_id_here"

# Add other platform credentials as needed
```

### 2. Basic Usage

#### Command Line
```bash
# Upload a single video
python AutomaticVideoUploader.py --file "my_video.mp4" --title "My Awesome Video"

# Upload all videos from a folder
python AutomaticVideoUploader.py --folder "clips"

# Schedule upload for specific time
python AutomaticVideoUploader.py --file "video.mp4" --schedule "2025-01-15 14:30"

# Upload with delay between platforms
python AutomaticVideoUploader.py --folder "clips" --delay 600  # 10 minute delays

# Upload at specific times for different platforms
python AutomaticVideoUploader.py --file "video.mp4" --youtube-time "09:00" --instagram-time "12:00"

# Check configured credentials
python AutomaticVideoUploader.py --check-credentials

# View analytics
python AutomaticVideoUploader.py --analytics
```

#### Jupyter Notebook
```python
# Initialize uploader
uploader = SocialMediaUploader()

# Upload single clip
result = uploader.upload_single_clip('video.mp4', 'My Video Title')

# Upload from folder
result = upload_from_folder('clips')
```

## Configuration

### Platform Selection

Choose which platforms to upload to:

```python
PLATFORMS_TO_UPLOAD = ["youtube", "tiktok", "instagram"]  # Add/remove as needed
```

### Upload Behavior

```python
AUTO_PUBLISH = True          # Set to False for drafts only
STAGGER_UPLOADS = True       # Wait between uploads
STAGGER_MINUTES = 30         # Minutes to wait
MAX_RETRIES = 3             # Retry failed uploads
```

### Scheduling and Timing

```python
# Schedule uploads for specific times
SCHEDULED_UPLOAD = False           # Enable scheduled posting
UPLOAD_SCHEDULE = {
    "youtube": "09:00",           # Upload to YouTube at 9 AM
    "instagram": "12:00",         # Instagram at noon
    "tiktok": "18:00"            # TikTok at 6 PM
}

# Time zone settings
TIMEZONE = "UTC"                  # Set your timezone
SCHEDULE_DAYS = ["monday", "wednesday", "friday"]  # Days to upload

# Delay settings
POST_IMMEDIATELY = False          # Set to True to ignore schedule
DELAY_BETWEEN_PLATFORMS = 300     # 5 minutes between platform uploads
RANDOM_DELAY = True              # Add random 0-60 minute delay
```

### Default Video Settings

```python
DEFAULT_PRIVACY = "public"   # public, unlisted, private
DEFAULT_TAGS = ["shorts", "viral", "video", "content"]
DEFAULT_DESCRIPTION_TEMPLATE = "Check out this amazing clip! 🎬\n\n#shorts #viral #video"
```

## API Setup Guide

### YouTube API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add your credentials to the configuration

### Instagram API (Meta Business)

1. Create a Meta Developer account
2. Set up Instagram Basic Display API
3. Generate long-lived access token
4. Get your Instagram Business Account ID
5. Add credentials to configuration

### TikTok API

1. Apply for TikTok for Developers access
2. Create an app and get client credentials
3. Implement OAuth flow for user authentication
4. Note: TikTok API has strict approval requirements

### LinkedIn API

1. Create a LinkedIn Developer account
2. Create an app with r_liteprofile and w_member_social permissions
3. Implement OAuth 2.0 flow
4. Get person ID from LinkedIn API

### Twitter API (X)

1. Apply for Twitter Developer account
2. Create an app and generate API keys
3. Get access tokens
4. Note: Twitter API access requires approval

## File Structure

```
social-media-uploader/
├── AutomaticVideoUploader.ipynb  # Main application
├── README.md                     # This file
├── requirements.txt              # Python dependencies
├── clips/                        # Default folder for video files
├── upload_analytics.json         # Upload statistics (auto-generated)
├── uploader.log                  # Log file (auto-generated)
└── youtube_token.pickle          # YouTube auth tokens (auto-generated)
```

## Usage Examples

### Single Video Upload

```python
uploader = SocialMediaUploader()
result = uploader.upload_single_clip(
    clip_path="my_video.mp4",
    title="Amazing Content",
    description="Check out this cool video!",
    tags=["cool", "amazing", "viral"]
)

print(f"Upload status: {result['status']}")
for platform, urls in result['results'].items():
    for url in urls:
        print(f"{platform}: {url}")
```

### Scheduled Upload with Timing Control

```python
from datetime import datetime, timedelta

uploader = SocialMediaUploader()

# Schedule a video for specific time
scheduled_time = datetime.now() + timedelta(hours=2)  # 2 hours from now

result = uploader.upload_single_clip(
    clip_path="my_video.mp4",
    title="Scheduled Content",
    description="This video was uploaded automatically!",
    schedule_time=scheduled_time,
    platforms=["youtube", "instagram"]
)

# Set different upload times for different platforms
platform_schedule = {
    "youtube": datetime.now().replace(hour=9, minute=0),    # 9 AM today
    "instagram": datetime.now().replace(hour=12, minute=0), # 12 PM today  
    "tiktok": datetime.now().replace(hour=18, minute=0)     # 6 PM today
}

result = uploader.upload_with_schedule(
    clip_path="my_video.mp4",
    title="Multi-Platform Scheduled Post",
    platform_schedule=platform_schedule
)
```

```python
from pathlib import Path

# Create custom clips
clips = []
video_folder = Path("my_videos")

for video_file in video_folder.glob("*.mp4"):
    clip = VideoClip(
        file_path=str(video_file),
        title=video_file.stem.replace("_", " ").title(),
        description="My custom description with hashtags #content #video",
        tags=["custom", "batch", "upload"],
        privacy="public"
    )
    clips.append(clip)

# Upload all clips
uploader = SocialMediaUploader()
result = uploader.upload_clips(clips)
```

### Analytics and Monitoring

```python
# Get detailed analytics
analytics = uploader.get_analytics()

print(f"Total uploads: {analytics['total_uploads']}")
print("Success by platform:")
for platform, count in analytics['successful_uploads'].items():
    print(f"  {platform}: {count}")

# Check recent upload history
for batch in analytics['upload_history'][-5:]:  # Last 5 batches
    print(f"Date: {batch['timestamp']}")
    print(f"Clips: {batch['clips_count']}")
    print(f"Results: {batch['results']}")
```

## Platform-Specific Notes

### YouTube
- Supports OAuth 2.0 authentication with automatic token refresh
- Videos are uploaded as public/unlisted/private based on settings
- Automatic categorization as Entertainment
- Handles YouTube's 100 requests/hour rate limit

### Instagram
- Requires Instagram Business Account
- Uploads videos as Reels
- Uses Meta Graph API v18.0
- Requires external video hosting for API uploads

### TikTok
- Currently uses mock implementation
- Requires TikTok for Developers approval
- Content Posting API has strict requirements
- Rate limits are conservatively set

### LinkedIn
- Currently uses mock implementation
- Requires company page or personal profile permissions
- Video uploads require multi-step process

### Twitter/X
- Currently uses mock implementation
- Requires Twitter API v2 access
- Video uploads have size and duration limits

## Error Handling

The uploader includes comprehensive error handling:

- **Rate Limit Management**: Automatic detection and waiting
- **Retry Logic**: Configurable retry attempts with delays
- **Authentication Errors**: Clear error messages for credential issues
- **File Validation**: Checks for file existence and format
- **Platform Errors**: Detailed logging of API responses

## Logging

All activities are logged to both console and `uploader.log`:

```python
# Log levels: INFO, WARNING, ERROR
# Example log entries:
# 2025-01-01 12:00:00 - INFO - Successfully uploaded to YouTube: https://youtube.com/watch?v=...
# 2025-01-01 12:01:00 - WARNING - Rate limit reached for TikTok, sleeping for 1800 seconds
# 2025-01-01 12:02:00 - ERROR - Instagram upload failed: Invalid access token
```

## Security Considerations

- **Token Storage**: OAuth tokens are stored securely in pickle files
- **Credential Validation**: Built-in validation for required credentials
- **Rate Limiting**: Prevents API abuse and account suspension
- **Error Logging**: Sensitive information is not logged

## Limitations

- **TikTok/LinkedIn/Twitter**: Currently use mock implementations pending full API integration
- **Video Size**: Large video files may require chunked uploads (implemented for YouTube)
- **Platform Rules**: Each platform has specific content and technical requirements
- **API Quotas**: Subject to each platform's daily/hourly limits
- **Authentication**: Some platforms require manual OAuth flows

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and automation purposes. Users are responsible for:

- Complying with each platform's terms of service
- Obtaining necessary API approvals and credentials
- Respecting content policies and community guidelines
- Managing upload quotas and rate limits

## Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: Check platform API documentation for specific requirements
- **Community**: Join discussions in GitHub Discussions

## Changelog

### v1.0.0
- Initial release with multi-platform support
- YouTube API integration with OAuth 2.0
- Instagram Reels support via Graph API
- Mock implementations for TikTok, LinkedIn, and Twitter
- Comprehensive analytics and logging
- Batch upload functionality
- Rate limiting and retry logic
