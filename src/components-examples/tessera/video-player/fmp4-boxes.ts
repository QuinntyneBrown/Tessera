/** A fragmented MP4 split into its initialisation segment and its `moof`+`mdat` fragments. */
export interface FragmentedMp4 {
  init: Uint8Array;
  fragments: Uint8Array[];
  /** Per-track duration of one pass through every fragment, in each track's timescale. */
  periods: Map<number, bigint>;
}

interface Box {
  type: string;
  start: number;
  end: number;
  body: number;
}

function* boxes(bytes: Uint8Array, start: number, end: number): Generator<Box> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    let body = offset + 8;
    if (size === 1) {
      size = Number(view.getBigUint64(offset + 8));
      body += 8;
    } else if (size === 0) size = end - offset;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    yield { type, start: offset, end: offset + size, body };
    offset += size;
  }
}

function child(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  for (const box of boxes(bytes, parent.body, parent.end)) if (box.type === type) return box;
  return undefined;
}

function children(bytes: Uint8Array, parent: Box, type: string): Box[] {
  return [...boxes(bytes, parent.body, parent.end)].filter((box) => box.type === type);
}

/** Splits a fragmented MP4 file: `ftyp`+`moov` form the init segment; each `moof`+`mdat` pair forms a fragment. */
export function splitFragmentedMp4(bytes: Uint8Array): FragmentedMp4 {
  const top = [...boxes(bytes, 0, bytes.length)];
  const moov = top.find((box) => box.type === 'moov');
  if (!moov) throw new Error('No moov box');
  const init = bytes.slice(0, moov.end);
  const fragments: Uint8Array[] = [];
  top.forEach((box, index) => {
    const next = top[index + 1];
    if (box.type === 'moof' && next?.type === 'mdat')
      fragments.push(bytes.slice(box.start, next.end));
  });
  const defaults = trackDefaults(bytes, moov);
  const periods = new Map<number, bigint>();
  for (const fragment of fragments)
    for (const [track, duration] of fragmentDurations(fragment, defaults))
      periods.set(track, (periods.get(track) ?? 0n) + duration);
  return { init, fragments, periods };
}

function trackDefaults(bytes: Uint8Array, moov: Box): Map<number, number> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const defaults = new Map<number, number>();
  const mvex = child(bytes, moov, 'mvex');
  for (const trex of mvex ? children(bytes, mvex, 'trex') : [])
    defaults.set(view.getUint32(trex.body + 4), view.getUint32(trex.body + 12));
  return defaults;
}

function fragmentDurations(
  fragment: Uint8Array,
  defaults: Map<number, number>,
): Map<number, bigint> {
  const view = new DataView(fragment.buffer, fragment.byteOffset, fragment.byteLength);
  const moof = [...boxes(fragment, 0, fragment.length)][0];
  const durations = new Map<number, bigint>();
  for (const traf of children(fragment, moof, 'traf')) {
    const tfhd = child(fragment, traf, 'tfhd')!;
    const tfhdFlags = view.getUint32(tfhd.body) & 0xffffff;
    const track = view.getUint32(tfhd.body + 4);
    let field = tfhd.body + 8;
    if (tfhdFlags & 0x01) field += 8;
    if (tfhdFlags & 0x02) field += 4;
    const fallback = tfhdFlags & 0x08 ? view.getUint32(field) : (defaults.get(track) ?? 0);
    let total = 0n;
    for (const trun of children(fragment, traf, 'trun')) {
      const flags = view.getUint32(trun.body) & 0xffffff;
      const count = view.getUint32(trun.body + 4);
      let sample = trun.body + 8 + (flags & 0x01 ? 4 : 0) + (flags & 0x04 ? 4 : 0);
      const stride = [0x100, 0x200, 0x400, 0x800].filter((bit) => flags & bit).length * 4;
      for (let index = 0; index < count; index++, sample += stride)
        total += BigInt(flags & 0x100 ? view.getUint32(sample) : fallback);
    }
    durations.set(track, (durations.get(track) ?? 0n) + total);
  }
  return durations;
}

/**
 * Copies a fragment for a later pass through the file: every `tfdt` moves forward by `loop`
 * periods and the `mfhd` sequence number is replaced, so the live timeline keeps growing.
 */
export function shiftFragment(
  fragment: Uint8Array,
  loop: number,
  periods: Map<number, bigint>,
  sequence: number,
): Uint8Array {
  const copy = fragment.slice();
  const view = new DataView(copy.buffer);
  const moof = [...boxes(copy, 0, copy.length)][0];
  const mfhd = child(copy, moof, 'mfhd');
  if (mfhd) view.setUint32(mfhd.body + 4, sequence);
  for (const traf of children(copy, moof, 'traf')) {
    const track = view.getUint32(child(copy, traf, 'tfhd')!.body + 4);
    const tfdt = child(copy, traf, 'tfdt');
    if (!tfdt) continue;
    const offset = BigInt(loop) * (periods.get(track) ?? 0n);
    if (view.getUint8(tfdt.body) === 1)
      view.setBigUint64(tfdt.body + 4, view.getBigUint64(tfdt.body + 4) + offset);
    else view.setUint32(tfdt.body + 4, Number(BigInt(view.getUint32(tfdt.body + 4)) + offset));
  }
  return copy;
}
