
/**
 * Decodes a Base64 string into a Uint8Array.
 * @param base64 The Base64 encoded string.
 * @returns A Uint8Array containing the decoded binary data.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface WavOptions {
  numChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
}

/**
 * Creates a WAV file Blob from raw PCM audio data.
 * @param pcmData The raw audio data as a Uint8Array.
 * @param options Configuration for the WAV file header.
 * @returns A Blob representing the WAV file.
 */
export function createWavBlob(pcmData: Uint8Array, options: WavOptions = {}): Blob {
  const {
    numChannels = 1,
    sampleRate = 24000,
    bitsPerSample = 16,
  } = options;

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([view, pcmData], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
