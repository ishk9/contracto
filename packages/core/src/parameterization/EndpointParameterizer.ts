import { SegmentClassifier } from './SegmentClassifier.js';

export class EndpointParameterizer {
  parameterize(paths: string[]): Map<string, string> {
    const groups = this.groupBySegmentCount(paths);
    const result = new Map<string, string>();

    for (const [, groupPaths] of groups) {
      if (groupPaths.length === 0) continue;

      const segments = groupPaths.map((p) => p.split('/').filter(Boolean));
      const template: string[] = [];

      for (let i = 0; i < segments[0].length; i++) {
        const values = new Set(segments.map((s) => s[i]));

        if (values.size === 1) {
          template.push(segments[0][i]);
        } else if (this.allMatch(values, SegmentClassifier.isNumeric) ||
                   this.allMatch(values, SegmentClassifier.isUuid)) {
          template.push(':id');
        } else if (this.allMatch(values, SegmentClassifier.isVersion)) {
          template.push(segments[0][i]);
        } else {
          template.push(`:param${i}`);
        }
      }

      const parameterized = '/' + template.join('/');
      for (const path of groupPaths) {
        result.set(path, parameterized);
      }
    }

    return result;
  }

  parameterizeSingle(routePath: string): string {
    return routePath;
  }

  private groupBySegmentCount(paths: string[]): Map<number, string[]> {
    const groups = new Map<number, string[]>();
    for (const path of paths) {
      const count = path.split('/').filter(Boolean).length;
      const group = groups.get(count) ?? [];
      group.push(path);
      groups.set(count, group);
    }
    return groups;
  }

  private allMatch(values: Set<string>, predicate: (v: string) => boolean): boolean {
    for (const v of values) {
      if (!predicate(v)) return false;
    }
    return true;
  }
}
