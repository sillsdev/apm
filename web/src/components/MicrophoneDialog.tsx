import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';

export interface MicrophoneDialogProps {
  microphoneId: string;
  onCancel: () => void;
  onConfirm: (deviceId: string) => void;
}

/** Lets the user pick a microphone, with a live level meter. */
export function MicrophoneDialog({
  microphoneId,
  onCancel,
  onConfirm,
}: MicrophoneDialogProps) {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [pickedId, setPickedId] = useState(microphoneId);
  // The pick if present, else the OS default, else the first mic.
  const chosenId = (
    inputs.find((d) => d.deviceId === pickedId) ??
    inputs.find((d) => d.deviceId === 'default') ??
    inputs[0]
  )?.deviceId;

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(
      (devices) => setInputs(devices.filter((d) => d.kind === 'audioinput')),
      () => {}
    );
  }, []);

  const meterRef = useCallback(
    (bar: HTMLDivElement | null) => {
      if (!bar || !chosenId) return;
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const samples = new Float32Array(analyser.fftSize);
      let frame = 0;
      const draw = () => {
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, v) => sum + v * v, 0) / samples.length
        );
        // -60 dB (silence) to 0 dB (full scale)
        bar.style.transform = `scaleX(${Math.max(0, 1 + Math.log10(rms) / 3)})`;
        frame = requestAnimationFrame(draw);
      };
      draw();
      const stream = navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: chosenId }, autoGainControl: false },
      });
      stream
        .then((s) => context.createMediaStreamSource(s).connect(analyser))
        .catch(() => {}); // mic unavailable, or dialog closed before it opened
      return () => {
        cancelAnimationFrame(frame);
        void context.close();
        stream.then(
          (s) => s.getTracks().forEach((t) => t.stop()),
          () => {}
        );
      };
    },
    [chosenId]
  );

  if (!chosenId) return null;
  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Select Microphone</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          size="small"
          value={chosenId}
          onChange={(e) => setPickedId(e.target.value)}
        >
          {inputs.map((d) => (
            <MenuItem key={d.deviceId} value={d.deviceId}>
              {d.label}
            </MenuItem>
          ))}
        </TextField>
        <Box
          sx={{
            mt: 2,
            height: 8,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <Box
            ref={meterRef}
            sx={{
              height: '100%',
              bgcolor: 'success.main',
              transform: 'scaleX(0)',
              transformOrigin: 'left',
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(chosenId)}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
