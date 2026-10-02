export enum ActivityStates {
  NoMedia = 'noMedia',
  TranscribeReady = 'transcribeReady',
  Transcribing = 'transcribing',
  Transcribed = 'transcribed',
  Reviewing = 'reviewing',
  Approved = 'approved',
  NeedsNewTranscription = 'needsNewTranscription',
  Done = 'done',
  NeedsNewRecording = 'needsNewRecording',
  Synced = 'synced',
  Incomplete = 'incomplete',
}

export default ActivityStates;
