# Album Data Storage Documentation

## 📀 Album Data Structure

### Core Album Information
Each album record contains the following data fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | String (UUID) | Unique identifier for the album | `"550e8400-e29b-41d4-a716-446655440000"` |
| `title` | String | Album title | `"Dark Side of the Moon"` |
| `artist` | String | Artist or band name | `"Pink Floyd"` |
| `year` | Number | Release year | `1973` |
| `genre` | Array[String] | List of genres | `["Rock", "Progressive Rock"]` |
| `label` | String | Record label | `"Harvest Records"` |
| `catalogNumber` | String | Catalog/matrix number | `"SHVL 804"` |
| `format` | String | Physical format | `"LP"` (LP, EP, Single, etc.) |
| `speed` | String | Playback speed | `"33 RPM"` (33 RPM, 45 RPM, 78 RPM) |
| `size` | String | Record size | `"12\""` (12", 10", 7") |
| `condition` | String | Physical condition | `"Near Mint"` (Mint, Near Mint, Very Good+, etc.) |
| `coverImage` | String | Album cover image URL or data URL | `"https://i.discogs.com/..."` or `"data:image/jpeg;base64,..."` |

### Purchase Information
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `purchasePrice` | Number | Price paid for the album | `25.99` |
| `purchaseDate` | String (ISO Date) | Date of purchase | `"2024-01-15T00:00:00Z"` |
| `purchaseLocation` | String | Where the album was purchased | `"Amoeba Records"` |

### Technical Metadata
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `dateAdded` | String (ISO Date) | When added to collection | `"2024-01-15T10:30:00Z"` |
| `identificationMethod` | String | How album was identified | `"camera-serpapi"`, `"manual"`, `"discogs-search"` |
| `identificationConfidence` | Number | Confidence score (0.00-1.00) | `0.95` |

### AI Analysis Data
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `moods` | Array[String] | AI-generated mood tags | `["nostalgic", "dreamy", "melancholic"]` |
| `aiAnalysis` | Object | AI analysis metadata | See below |

#### AI Analysis Object Structure
```javascript
{
  suggestedMoods: ["nostalgic", "dreamy"],
  reasoning: "This album evokes feelings of nostalgia...",
  confidence: 0.87,
  timestamp: "2024-01-15T10:30:00Z"
}
```

### External Service IDs
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `metadata.musicbrainzId` | String | MusicBrainz release ID | `"b84ee12a-09ef-421b-82de-0441a926375a"` |
| `metadata.discogsId` | String | Discogs release ID | `"249504"` |
| `metadata.spotifyId` | String | Spotify album ID | `"4LH4d3cOWNNsVw41Gqt2kv"` |

### Track Listing (Optional)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `tracks` | Array[Object] | Individual track information | See below |

#### Track Object Structure
```javascript
{
  id: "track-uuid",
  trackNumber: 1,
  side: "A",           // A, B, 1, 2, etc.
  title: "Speak to Me",
  duration: "1:30"     // MM:SS format
}
```

### Additional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `notes` | String | Personal notes about the album | `"Gift from mom, first pressing"` |
| `country` | String | Country of release | `"UK"` |

## 💾 Data Storage Formats

### Local Storage (IndexedDB)
- **Database Name**: `VinylCollection`
- **Version**: 1
- **Store Name**: `albums`
- **Key Path**: `id`
- **Format**: Native JavaScript objects stored directly

### Cloud Storage (Supabase PostgreSQL)
- **Table Name**: `albums`
- **Primary Key**: `id` (UUID)
- **Field Mapping**: Snake_case column names mapped to camelCase in JavaScript

#### Column Mapping (Supabase ↔ JavaScript)
| Supabase Column | JavaScript Property | Type |
|----------------|-------------------|------|
| `id` | `id` | UUID |
| `title` | `title` | TEXT |
| `artist` | `artist` | TEXT |
| `cover_image_url` | `coverImage` | TEXT |
| `catalog_number` | `catalogNumber` | TEXT |
| `purchase_price` | `purchasePrice` | DECIMAL |
| `purchase_date` | `purchaseDate` | DATE |
| `created_at` | `dateAdded` | TIMESTAMP |
| `updated_at` | `updatedAt` | TIMESTAMP |

### Image Storage
- **Local**: Base64 data URLs stored directly in album records
- **Cloud**: Image URLs pointing to external services (Discogs, MusicBrainz Cover Art Archive)
- **Format**: JPEG/PNG, typically resized to optimize loading

## 🌐 Online Services & Subscriptions

### Primary Cloud Database
- **Service**: [Supabase](https://supabase.com)
- **Plan**: Free Tier
- **Database**: PostgreSQL
- **Storage**: 500MB database + 1GB file storage
- **Features**:
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Auto-generated REST API
  - Authentication service

### External Data Sources
- **Discogs API**: Album metadata and cover art
  - Plan: Free (60 requests/minute)
  - Authentication: Consumer key/secret
- **MusicBrainz**: Open music database
  - Plan: Free (1 request/second rate limit)
  - Authentication: None (User-Agent required)
- **Cover Art Archive**: Album artwork
  - Plan: Free
  - Authentication: None

### Image Recognition Services
- **SerpAPI**: Google image search API
  - Plan: Free tier (100 searches/month)
  - Authentication: API key
- **Google Vision API**: OCR and image analysis
  - Plan: Free tier (1000 requests/month)
  - Authentication: Service account key

### Deployment & Hosting
- **Primary**: [Netlify](https://netlify.com)
  - Plan: Free tier
  - Features: Auto-deploy from Git, serverless functions
- **Alternative**: [Vercel](https://vercel.com)
  - Plan: Free tier
  - Features: Auto-deploy, edge functions

## 🔄 Data Synchronization

### Local ↔ Cloud Sync
- **Method**: Manual sync when user signs in/out
- **Conflict Resolution**: Last-write-wins
- **Offline Support**: Full CRUD operations available offline
- **Sync Trigger**: Authentication state changes

### Data Migration
- **Export Format**: JSON file with full album data
- **Import Support**: JSON file upload and processing
- **Backup Strategy**: Manual export recommended before major changes

## 🔒 Data Security & Privacy

### Authentication
- **Provider**: Supabase Auth
- **Methods**: Email/password, OAuth providers
- **Session Management**: JWT tokens with auto-refresh

### Data Access
- **Row Level Security**: Users can only access their own albums
- **API Security**: Authenticated requests only for cloud data
- **Local Security**: No encryption (browser storage limitations)

### Privacy
- **Data Collection**: Only user-provided album information
- **External Sharing**: None (personal collection only)
- **Data Retention**: User-controlled (can delete account/data anytime)