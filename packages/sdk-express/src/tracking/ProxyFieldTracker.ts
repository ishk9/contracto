export interface IFieldTracker {
  wrap<T extends object>(obj: T): T;
  getAccessedFields(): string[];
  reset(): void;
}

export class ProxyFieldTracker implements IFieldTracker {
  private accessed = new Set<string>();

  wrap<T extends object>(obj: T): T {
    return this.trackAccess(obj, '') as T;
  }

  getAccessedFields(): string[] {
    return [...this.accessed];
  }

  reset(): void {
    this.accessed.clear();
  }

  private trackAccess(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
      return new Proxy(obj, {
        get: (target, prop, receiver) => {
          const val = Reflect.get(target, prop, receiver);
          if (typeof prop === 'string' && !isNaN(Number(prop))) {
            this.accessed.add(`${path}[]`);
            return this.trackAccess(val, `${path}[]`);
          }
          return val;
        },
      });
    }

    return new Proxy(obj as Record<string, unknown>, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);

        const fieldPath = path ? `${path}.${String(prop)}` : String(prop);
        this.accessed.add(fieldPath);

        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'object' && val !== null) {
          return this.trackAccess(val, fieldPath);
        }
        return val;
      },

      ownKeys: (target) => {
        const keys = Reflect.ownKeys(target);
        for (const key of keys) {
          if (typeof key === 'string') {
            this.accessed.add(path ? `${path}.${key}` : key);
          }
        }
        return keys;
      },

      has: (target, prop) => {
        if (typeof prop === 'string') {
          this.accessed.add(path ? `${path}.${prop}` : prop);
        }
        return Reflect.has(target, prop);
      },

      getOwnPropertyDescriptor: (target, prop) => {
        if (typeof prop === 'string') {
          this.accessed.add(path ? `${path}.${prop}` : prop);
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }
}
