# OneStory to APM Migration Workflow

## Process Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONESTORY WEBSITE                              │
│              https://www.onestory-media.org/                     │
│                                                                   │
│  • 140+ Languages                                                │
│  • Bible Story Audio Sets                                        │
│  • Oral Learning Resources                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │   STEP 1: WEB SCRAPING      │
              │  (01-scrape-onestory.js)    │
              │                              │
              │  • Extract language list     │
              │  • Discover audio URLs       │
              │  • Map website structure     │
              └──────────────┬───────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  languages.json │
                    │  audio-discovery│
                    └────────┬────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │   STEP 2: DOWNLOAD AUDIO    │
              │  (02-download-audio.js)     │
              │                              │
              │  • Download all audio files  │
              │  • Organize by language      │
              │  • Capture metadata          │
              └──────────────┬───────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   audio/ directory   │
                  │  ├─ Language1/       │
                  │  │  ├─ story1.mp3    │
                  │  │  └─ story2.mp3    │
                  │  └─ Language2/       │
                  │     └─ ...           │
                  │  audio-metadata.json │
                  └──────────┬───────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  STEP 3: TRANSFORM TO PTF   │
              │  (03-transform-to-ptf.js)   │
              │                              │
              │  • Create project structure  │
              │  • Generate JSON API data    │
              │  • Package into PTF (ZIP)    │
              └──────────────┬───────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   PTF Files (.ptf)   │
                  │                       │
                  │  Language1.ptf        │
                  │  Language2.ptf        │
                  │  ...                  │
                  └──────────┬───────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  STEP 4: AUDIO BURRITOS     │
              │ (04-generate-audio-burrito) │
              │                              │
              │  • Generate metadata.json    │
              │  • List audio ingredients    │
              │  • Include checksums/roles   │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │   IMPORT INTO APM           │
              │  (Manual via APM UI)        │
              │                              │
              │  File > Import Project       │
              │  Select .ptf file            │
              └──────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │  AUDIO PROJECT MANAGER     │
                │                             │
                │  Projects organized by:     │
                │  • Language                 │
                │  • Story Sets               │
                │  • Individual Stories       │
                │                             │
                │  Ready for:                 │
                │  • Transcription            │
                │  • Review                   │
                │  • Publishing               │
                └─────────────────────────────┘
```

## Data Transformation Details

### OneStory Structure → APM Structure

```
OneStory Website              →    APM Data Model
─────────────────────────────     ──────────────────────────
Language Name                 →    Project
  └─ Audio Files              →      └─ Plan
      ├─ Story 1                        └─ Section
      ├─ Story 2                            └─ Passages
      └─ Story 3                                ├─ Passage 1
                                                │   └─ MediaFile (audio)
                                                ├─ Passage 2
                                                │   └─ MediaFile (audio)
                                                └─ Passage 3
                                                    └─ MediaFile (audio)
```

### PTF File Structure

```
Language_Name.ptf (ZIP Archive)
│
├─ SILTranscriber              ← Export timestamp
├─ Version                     ← Schema version (4)
│
├─ data/                       ← JSON API formatted data
│  ├─ A_users.json            ← User records
│  ├─ B_organizations.json    ← OneStory organization
│  ├─ B_activitystates.json   ← Workflow states
│  ├─ C_groups.json           ← Team/group info
│  ├─ D_projects.json         ← Project definition
│  ├─ E_plans.json            ← Story set plan
│  ├─ F_sections.json         ← Section grouping
│  ├─ G_passages.json         ← Individual stories
│  └─ H_mediafiles.json       ← Audio file metadata
│
└─ media/                      ← Actual audio files
   ├─ 1_story_title.mp3
   ├─ 2_story_title.mp3
   └─ ...
```

## Timeline Estimates

| Step | Duration | Depends On |
|------|----------|------------|
| Setup | 5 min | npm install |
| Scraping | 5-10 min | Website speed |
| Downloading | 30-120 min | File count, bandwidth |
| Transformation | 2-5 min | File count |
| Burrito Metadata | 2-4 min | Downloaded audio + metadata |
| Import (per language) | 1-3 min | File size |

**Total**: ~1-2 hours for complete migration of all languages (plus a few extra minutes for metadata generation)

## Resource Requirements

### Disk Space
- **Minimum**: 1 GB
- **Recommended**: 5+ GB (depends on audio file count/quality)

### Network
- **Bandwidth**: ~50-200 MB per language (varies)
- **Connectivity**: Stable internet required during download phase

### System
- **Node.js**: v18 or higher
- **Memory**: 2 GB RAM recommended
- **OS**: Windows, macOS, or Linux

## Error Handling

The scripts include error handling for common issues:

| Error | Cause | Solution |
|-------|-------|----------|
| Network timeout | Slow/unstable connection | Restart failed step |
| Missing audio | Changed website structure | Update scraper logic |
| PTF import fails | Corrupted/incomplete file | Re-run transformation |
| Disk full | Insufficient space | Free up space, continue |

## Customization Points

### 1. Language Filtering
**File**: `02-download-audio.js`
```javascript
// Process only specific languages
const targetLanguages = ['Spanish', 'French', 'Swahili'];
const filtered = languages.filter(l =>
  targetLanguages.some(t => l.name.includes(t))
);
```

### 2. Project Metadata
**File**: `03-transform-to-ptf.js`
```javascript
// Customize project attributes
const project = createJsonApiResource('project', {
  name: `Custom: ${lang.name}`,
  description: 'Your custom description',
  // Add more fields...
});
```

### 3. Audio Quality
**File**: `02-download-audio.js`
```javascript
// Add audio conversion (requires ffmpeg)
const ffmpeg = require('fluent-ffmpeg');
await convertAudio(filepath, {
  bitrate: '128k',
  format: 'mp3'
});
```

## Post-Migration Tasks

After importing into APM:

1. **Verify Data**
   - Check all audio files imported correctly
   - Verify project/language names
   - Ensure file counts match

2. **Add Metadata**
   - Scripture references
   - Story descriptions
   - Copyright/license info
   - Contributors

3. **Organize**
   - Group related stories
   - Order sequences
   - Add section headings

4. **Transcribe**
   - Add text transcriptions
   - Time-align with audio
   - Add verse markers

5. **Review & Publish**
   - Quality check
   - Peer review
   - Export/publish

## Support & Troubleshooting

### Script Issues
- Review error messages in console
- Check migration-data/ for partial results
- Verify internet connectivity
- Ensure sufficient disk space

### Website Changes
If OneStory changes their website structure:
1. Update `01-scrape-onestory.js` selectors
2. Adjust `02-download-audio.js` URL patterns
3. Test with sample language first

### APM Import Problems
- Verify PTF file is valid ZIP
- Check APM version compatibility
- Review APM logs for specific errors
- Ensure schema version matches

## Best Practices

✅ **DO**:
- Run verification script first (`npm run verify`)
- Test with 1-2 languages before full migration
- Back up existing APM data
- Review scraped data before downloading
- Keep migration-data/ folder until import verified

❌ **DON'T**:
- Run concurrent migrations
- Delete intermediate files until complete
- Modify PTF files manually
- Skip verification steps
- Ignore error messages

## Additional Resources

- [APM Documentation](../README.md)
- [PTF Format Spec](./README.md#data-structure)
- [JSON API Specification](https://jsonapi.org/)
- [OneStory Website](https://www.onestory-media.org/)

---

**Questions?** Review the README files or examine the script code for details.

