# TTS Support for HelloAo languages

I built the table for all 1,168 codes in your file. Only 56 of them have any support in these four services, and the other 1,112 are unsupported everywhere. Most of those are minority languages. The full table is in [tts_support_by_language.csv](tts_support_by_language.csv), and it opens in Excel. The language names come from the official SIL ISO 639-3 table, which I downloaded as you approved. Two retired codes, `cug` and `plj`, aren't in it, so I labelled those two by hand.

## Supported languages (✓ = supported)

| Code | Language          | Google | Polly | Azure | OpenAI |
| ---- | ----------------- | ------ | ----- | ----- | ------ |
| amh  | Amharic           |        |       | ✓     |        |
| arb  | Standard Arabic   | ✓      | ✓     | ✓     | ✓      |
| asm  | Assamese          |        |       | ✓     |        |
| bel  | Belarusian        |        |       |       | ✓      |
| ben  | Bengali           | ✓      |       | ✓     |        |
| ces  | Czech             | ✓      | ✓     | ✓     | ✓      |
| cmn  | Mandarin Chinese  | ✓      | ✓     | ✓     | ✓      |
| dan  | Danish            | ✓      | ✓     | ✓     | ✓      |
| deu  | German            | ✓      | ✓     | ✓     | ✓      |
| ekk  | Standard Estonian | ✓      |       | ✓     | ✓      |
| eng  | English           | ✓      | ✓     | ✓     | ✓      |
| fin  | Finnish           | ✓      | ✓     | ✓     | ✓      |
| fra  | French            | ✓      | ✓     | ✓     | ✓      |
| guj  | Gujarati          | ✓      |       | ✓     |        |
| heb  | Hebrew            | ✓      |       | ✓     | ✓      |
| hin  | Hindi             | ✓      | ✓     | ✓     | ✓      |
| hrv  | Croatian          | ✓      |       | ✓     | ✓      |
| hun  | Hungarian         | ✓      |       | ✓     | ✓      |
| ind  | Indonesian        | ✓      |       | ✓     | ✓      |
| isl  | Icelandic         | ✓      | ✓     | ✓     | ✓      |
| ita  | Italian           | ✓      | ✓     | ✓     | ✓      |
| jpn  | Japanese          | ✓      | ✓     | ✓     | ✓      |
| kan  | Kannada           | ✓      |       | ✓     | ✓      |
| kor  | Korean            | ✓      | ✓     | ✓     | ✓      |
| lao  | Lao               |        |       | ✓     |        |
| lit  | Lithuanian        | ✓      |       | ✓     | ✓      |
| mal  | Malayalam         | ✓      |       | ✓     |        |
| mar  | Marathi           | ✓      |       | ✓     | ✓      |
| mri  | Maori             |        |       |       | ✓      |
| mya  | Burmese           |        |       | ✓     |        |
| nld  | Dutch             | ✓      | ✓     | ✓     | ✓      |
| nob  | Norwegian Bokmål  | ✓      | ✓     | ✓     | ✓      |
| npi  | Nepali            |        |       | ✓     | ✓      |
| ory  | Odia              |        |       | ✓     |        |
| pan  | Panjabi           | ✓      |       |       |        |
| pes  | Iranian Persian   |        |       | ✓     | ✓      |
| pol  | Polish            | ✓      | ✓     | ✓     | ✓      |
| por  | Portuguese        | ✓      | ✓     | ✓     | ✓      |
| ron  | Romanian          | ✓      | ✓     | ✓     | ✓      |
| rus  | Russian           | ✓      | ✓     | ✓     | ✓      |
| slk  | Slovak            | ✓      |       | ✓     | ✓      |
| som  | Somali            |        |       | ✓     |        |
| spa  | Spanish           | ✓      | ✓     | ✓     | ✓      |
| srp  | Serbian           | ✓      |       | ✓     | ✓      |
| swe  | Swedish           | ✓      | ✓     | ✓     | ✓      |
| swh  | Swahili           | ✓      |       | ✓     | ✓      |
| tam  | Tamil             | ✓      |       | ✓     | ✓      |
| tel  | Telugu            | ✓      |       | ✓     |        |
| tgl  | Tagalog           | ✓      |       | ✓     | ✓      |
| tha  | Thai              | ✓      |       | ✓     | ✓      |
| tur  | Turkish           | ✓      | ✓     | ✓     | ✓      |
| uig  | Uighur            |        |       | ✓     |        |
| ukr  | Ukrainian         | ✓      |       | ✓     | ✓      |
| urd  | Urdu              | ✓      |       | ✓     | ✓      |
| vie  | Vietnamese        | ✓      |       | ✓     | ✓      |
| zlm  | Malay             | ✓      |       | ✓     | ✓      |

## Totals

Azure supports 53 of the codes, Google 45, OpenAI 44 and Polly 22.

## Caveats

- **Verify before relying on it.** I filled in support from memory, not from the providers' current docs, and these lists change often. Check Google's and Azure's "supported voices and languages" pages, Polly's voice list and OpenAI's TTS guide for any language you depend on.
- **OpenAI** doesn't publish a TTS language list. I used the 57 languages of its Whisper speech-recognition model, which OpenAI says TTS follows. Quality outside English is uneven, and some other languages may work in practice.
- **Dialects.** I mapped the cloud services' country-specific variants to your codes, for example Filipino to `tgl`, Modern Standard Arabic to `arb`, and Mandarin to `cmn`. Your file uses the specific ISO 639-3 codes, so a regional variant of a language may not count as the same language.
- **Gaps in Azure and Google.** I didn't mark Amharic, Nepali, Sinhala or Lao for Google, or Panjabi for Azure. Newer voices may cover them.
