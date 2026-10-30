# Text-to-speech options for a browser app

## 1. Built-in Web Speech API (`speechSynthesis`)

- **How:** `speechSynthesis.speak(new SpeechSynthesisUtterance("Hello"))`. The browser uses the OS or browser voices.
- **Cost:** Free.
- **Tradeoffs:**
  - Voice quality and availability vary by OS and browser. Chrome on desktop may offer Google network voices, and Safari and Edge have their own.
  - You can't control the voices, so output differs across users.
  - You can't easily capture the audio as a file.
  - It's good for prototypes, accessibility add-ons and low-stakes use.

## 2. Cloud TTS APIs (neural voices)

Your server or a proxy calls the API and returns audio (MP3, Opus or PCM) for an `<audio>` element or the Web Audio API. Don't put API keys in browser code.

| Provider         | Approx. price                                                                                                                                 | Free tier                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Google Cloud TTS | Standard about $4 per 1M characters. WaveNet/Neural2 about $16 per 1M. Chirp/Studio voices about $30 per 1M.                                  | 1M to 4M characters a month, depending on voice type                |
| Amazon Polly     | Standard about $4 per 1M. Neural about $16 per 1M. Generative about $30 per 1M.                                                               | 5M standard or 1M neural characters a month for the first 12 months |
| Azure AI Speech  | Neural about $15 per 1M. HD voices cost more.                                                                                                 | About 0.5M characters a month                                       |
| OpenAI TTS       | `tts-1` about $15 per 1M. `tts-1-hd` about $30 per 1M. The newer `gpt-4o-mini-tts` is billed by tokens, roughly $0.015 per minute of audio.   | None                                                                |
| ElevenLabs       | Subscription by monthly characters: roughly $5 to $22 a month for 30k to 100k+ credits, then scaling up. API usage draws on the same credits. | About 10k characters a month                                        |

## 3. Self-hosted open-source models

- Examples include Piper, Coqui/XTTS, Kokoro, StyleTTS2 and Bark.
- **Cost:** The software is free. You pay for compute: a cheap CPU box for Piper or Kokoro, or a GPU instance (about $0.50 to $1.50 an hour) for the heavier models.
- **Tradeoffs:** You control privacy and per-use cost, but you handle scaling and ops.

## 4. In-browser (client-side) models via WASM or WebGPU

- Examples: Piper compiled to WASM, Kokoro through `transformers.js`, or `sherpa-onnx`.
- **Cost:** Free to run, since the user's device does the work.
- **Tradeoffs:** The model download is roughly 25 to 300 MB. First load is slow, and performance depends on the device. It works offline and nothing leaves the browser, which makes it a good fit for privacy-sensitive apps.

## Choosing

- **Cost-sensitive and quality isn't critical:** Web Speech API.
- **Consistent, high-quality voices across users:** Google, Polly or Azure at roughly $4 to $16 per 1M characters. A typical article of 5,000 characters costs about $0.02 to $0.08.
- **Premium or expressive voices, or voice cloning:** ElevenLabs or OpenAI, at a higher per-character cost.
- **Offline or private:** a WASM model in the browser.

**Cost-saving tips:**

- Cache generated audio by hashing the text and voice, since repeated phrases are common.
- Use streaming for low latency on long text.
- Split long text into sentences so playback starts sooner.

These prices are from memory and change often, so check each provider's pricing page before budgeting. I can look up current numbers or sketch a sample implementation for any of these if you want.
