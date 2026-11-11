# Supported Languages

Opened a blank test page in the built-in browser; now reading its list of speech voices.

The built-in browser in the Claude app sees only 3 TTS voices on this computer, all English (US). They come from Windows, and Windows is the provider for all of them.

| Language | Voice                     | Provider                           | Local or network |
| -------- | ------------------------- | ---------------------------------- | ---------------- |
| en-US    | Microsoft David (default) | Windows OneCore speech (Microsoft) | Local            |
| en-US    | Microsoft Mark            | Windows OneCore speech (Microsoft) | Local            |
| en-US    | Microsoft Zira            | Windows OneCore speech (Microsoft) | Local            |

A direct check of Windows agrees. It lists David and Zira as the older desktop voices, plus David, Mark and Zira as OneCore voices. No other language packs or voices are installed.

The browser reports no network voices, such as Google's or Microsoft's online voices. It only shows what the app's engine exposes.

**The Chrome and Edge lists will differ.** Both are installed here. Chrome normally adds Google's network voices, which cover roughly 40+ languages, and Edge adds Microsoft's online "Natural" voices, which cover many more. I couldn't read either list because the Claude in Chrome extension isn't connected.

You can check yourself by pasting this into the DevTools console (F12) in Chrome or Edge:

```javascript
speechSynthesis.onvoiceschanged = () =>
  console.table(
    speechSynthesis
      .getVoices()
      .map((v) => ({ lang: v.lang, name: v.name, local: v.localService }))
  );
speechSynthesis.getVoices();
```

If you install the extension and sign in, I can run the check in Chrome myself. You can also add Windows voices for other languages under Settings → Time & language → Speech → Add voices.
