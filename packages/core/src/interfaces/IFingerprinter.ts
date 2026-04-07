import type { ShapeNode } from '../types/index.js';

export interface IFingerprinter {
  fingerprint(shape: ShapeNode): Promise<string>;
}
