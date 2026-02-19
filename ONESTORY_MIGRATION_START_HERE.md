# 🎯 OneStory to APM Migration - START HERE

## What You Asked For

You asked for help migrating data from https://www.onestory-media.org/ into your Audio Project Manager application.

## What I've Created For You

I've built a complete migration toolkit with:

### ✅ Automated Scripts
- **Web scraper** - Extracts language list and audio file URLs
- **Downloader** - Downloads all audio files with metadata
- **Transformer** - Converts to APM's PTF format
- **Verifier** - Checks your environment is ready

### ✅ Complete Documentation
- Step-by-step guides
- Troubleshooting help
- Customization examples
- Visual workflow diagrams

---

## 🚀 Get Started (3 Simple Steps)

### 1. Install Dependencies

```bash
cd migration
npm install
```

### 2. Run the Migration

```bash
npm start
```

This will:
- ✅ Verify your setup
- ✅ Scrape OneStory website
- ✅ Download all audio files
- ✅ Create PTF files for APM import

**Time**: 1-2 hours (mostly download time)

### 3. Import into APM

1. Open Audio Project Manager
2. File > Import Project
3. Select `.ptf` files from `migration/migration-data/ptf-files/`

---

## 📁 Files Created

```
migration/
├── 00-verify-setup.js          ← Checks if you're ready
├── 01-scrape-onestory.js       ← Scrapes website
├── 02-download-audio.js        ← Downloads audio
├── 03-transform-to-ptf.js      ← Creates PTF files
├── package.json                 ← Dependencies
├── README.md                    ← Full documentation
├── QUICK_START.md               ← Quick reference
└── MIGRATION_WORKFLOW.md        ← Visual diagrams

MIGRATION_GUIDE.md (this folder)  ← Complete guide
```

---

## 📖 Which Guide to Read?

Choose based on your needs:

| If you want... | Read this |
|----------------|-----------|
| **Quick start** | `migration/QUICK_START.md` |
| **Full details** | `migration/README.md` |
| **Visual workflow** | `migration/MIGRATION_WORKFLOW.md` |
| **Complete guide** | `MIGRATION_GUIDE.md` |
| **Just run it** | Just run `cd migration && npm start` |

---

## ⚡ Quick Command Reference

```bash
# Go to migration folder
cd migration

# Install (first time only)
npm install

# Verify setup
npm run verify

# Run complete migration
npm start

# Or run steps individually:
npm run scrape      # Step 1: Scrape website
npm run download    # Step 2: Download audio
npm run transform   # Step 3: Create PTF files
```

---

## 🎯 What Happens

1. **Script visits OneStory website**
   - Finds all languages (140+ languages)
   - Discovers audio file locations

2. **Downloads all audio files**
   - Organized by language
   - Saves metadata

3. **Creates PTF files**
   - One `.ptf` per language
   - Ready to import into APM
   - Contains project structure + audio

4. **You import into APM**
   - File > Import Project
   - Select PTF files
   - Done!

---

## ⚠️ Important Notes

- **Copyright**: Ensure you have permission to use OneStory content
- **Time**: Full migration takes 1-2 hours (mostly download time)
- **Space**: Need ~5GB free disk space
- **Internet**: Stable connection required

---

## 🆘 Need Help?

### Setup Issues
Run: `npm run verify`

### Website Changed
Check: `migration-data/audio-discovery.json` to see what was found

### Import Fails
Verify PTF file: `unzip -l migration-data/ptf-files/Language.ptf`

### Want to Customize
See: `MIGRATION_GUIDE.md` > Customization section

---

## 🎬 Ready?

```bash
cd migration
npm install
npm start
```

Then import the generated `.ptf` files into Audio Project Manager!

---

**Questions?** All scripts are well-commented. Read the code or check the documentation files listed above.

