import { readFileSync } from 'node:fs';
/** Reads the PCM WAV chunks produced by the local Windows narration script. */
export function pcmWave(file) {
  const wav = readFileSync(file);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error(`Invalid WAV: ${file}`);
  let format, data;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4),
      name = wav.toString('ascii', offset, offset + 4);
    const chunk = wav.subarray(offset + 8, offset + 8 + size);
    if (name === 'fmt ') format = chunk;
    if (name === 'data') data = chunk;
    offset += 8 + size + (size % 2);
  }
  if (
    !format ||
    !data ||
    format.readUInt16LE(0) !== 1 ||
    format.readUInt16LE(2) !== 1 ||
    format.readUInt32LE(4) !== 22050 ||
    format.readUInt16LE(14) !== 16
  )
    throw new Error(`Expected 22050 Hz mono 16-bit PCM: ${file}`);
  return { data, duration: data.length / 44100 };
}
export function waveFile(data) {
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(data.length + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(22050, 24);
  header.writeUInt32LE(44100, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
