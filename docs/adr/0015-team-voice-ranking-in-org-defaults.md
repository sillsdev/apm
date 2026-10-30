# Team Voice Ranking lives in org defaults

A team admin may rank, per language, the text-to-speech **Voices** that speak **Reference Texts** on the Internalize step. The ranking is kept in the organization's `defaultParams.ttsVoices` as `{ [primarySubtag]: RankedVoice[] }`, best first, where each `RankedVoice` is a snapshot `{ name, voiceURI, lang, localService }`. Playback walks the language's list and uses the first voice this device has, matched by `voiceURI` and then by `name`. If none is present it falls back to ADR 0014's choice (default voice, then local, then first), and it does not tell the user. "No voice" is reported only when the device has no voice for the language at all. This supersedes ADR 0014's "nothing is chosen by the user or saved".

The ranking is edited in a **Reference Text Voices** dialog, opened from Team Settings. The button shows only for admins of that team, and never on the Personal Team. It is disabled while an online session is offline, using the same rule as `canSetOrgDefault`. The dialog lists this device's voices grouped by language, using the same primary subtag that playback matches on. Ranked voices come first in each language and can be moved up, moved down or removed; unranked voices have Add. A shared sample text box and a Read/Stop button on each row let the admin hear a voice. Changes are written only on Save, through `setOrgDefault`.

A second org default, `ttsFilterRefText`, limits the Reference Texts offered in Project Settings to languages that have at least one ranked voice. It applies to everyone on the team.

## Considered Options

- **Ranking in org defaults, a preference per language** (chosen): one setting for the team, which plays the same everywhere it can and degrades to the device's own best match elsewhere
- **Per-user or per-device choice**: rejected. A team wants members to hear the same voice where possible, and members cannot change it
- **One list across all languages**: rejected. Playback only ever asks which voice is best for one language
- **Saving only the voice name**: rejected. Chrome's voiceURI equals the name, but other platforms differ. Keeping both, plus `lang`, lets a ranked voice be listed under its language on a device that lacks it
- **Reusing the `voices` org default**: rejected. It already holds voice-conversion sponsor and permission data
- **Drag-and-drop ranking**: rejected in favour of Add, Move up, Move down and Remove buttons. They are keyboard and screen-reader friendly and need no drag library

## Consequences

- Speaking goes through one `speakText` seam (`speakReferenceText.ts`). The dialog's sample and a passage share it, so they never talk over each other
- A ranked voice this device lacks still shows in its place, marked "Not on this device" with Read disabled. Saving never drops it
- Language groups are ordered by the ranking **as saved when the dialog opened**, then by languages of Reference Texts the team uses, then A–Z. A language does not jump to the top while it is being ranked. Collapsed groups do not render their rows, because Edge can list hundreds of voices
- Unranked online voices (Chrome's Google voices, Edge's Microsoft "Natural" voices) are hidden until "Show online voices" is checked. That choice is kept per browser in `localStorage`, because online voices depend on the browser. Ranked online voices always show. The provider is guessed from the voice name, because voices don't report it. Amazon Polly, Azure and other cloud services cannot be reached through `speechSynthesis` and would need a server-side backend behind `deviceVoices`
- The footer note on adding voices follows the platform (Windows, Mac or Linux; nothing on Android, ChromeOS or unknown). **Open:** Electron on Linux may list no voices at all unless speech-dispatcher is installed. This has not been checked on a Linux machine
- With the filter on, Project Settings shows a caption explaining it. A project's current Reference Texts stay chosen and shown even outside the filter. The "Used in this team" group is filtered like the rest. The filter can only be saved on while something is ranked
- Team Dialog's Save starts from the organization record in memory, not the copy it opened with, so it does not overwrite defaults that dialogs opened from Team Settings saved in the meantime
