const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_REGEX = /^v\d+$/;

export class SegmentClassifier {
  static isNumeric(value: string): boolean {
    return /^\d+$/.test(value);
  }

  static isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  static isVersion(value: string): boolean {
    return VERSION_REGEX.test(value);
  }

  static isSlug(value: string): boolean {
    return value.length > 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }
}
