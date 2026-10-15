import type { Points } from './types';
export const encodePoints = (value: Points): string => value.toString();
export function decodePoints(value: unknown): Points {
  if (typeof value !== 'string' || !/^(0|-?[1-9]\d*)$/.test(value)) throw Error('Invalid points');
  return BigInt(value);
}
