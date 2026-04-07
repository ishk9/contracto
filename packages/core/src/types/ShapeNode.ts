export type ShapePrimitive =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'unknown';

export type ShapeNode =
  | ShapePrimitive
  | ShapeObject
  | ShapeArray
  | ShapeUnion;

export interface ShapeObject {
  readonly _type: 'object';
  readonly fields: Readonly<Record<string, ShapeNode>>;
}

export interface ShapeArray {
  readonly _type: 'array';
  readonly items: ShapeNode;
}

export interface ShapeUnion {
  readonly _type: 'union';
  readonly variants: readonly ShapeNode[];
}

export function isShapeObject(node: ShapeNode): node is ShapeObject {
  return typeof node === 'object' && node !== null && node._type === 'object';
}

export function isShapeArray(node: ShapeNode): node is ShapeArray {
  return typeof node === 'object' && node !== null && node._type === 'array';
}

export function isShapeUnion(node: ShapeNode): node is ShapeUnion {
  return typeof node === 'object' && node !== null && node._type === 'union';
}

export function isPrimitive(node: ShapeNode): node is ShapePrimitive {
  return typeof node === 'string';
}
