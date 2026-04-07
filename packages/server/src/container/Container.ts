export class Container {
  private registry = new Map<string, unknown>();

  register<T>(token: string, instance: T): void {
    this.registry.set(token, instance);
  }

  resolve<T>(token: string): T {
    const instance = this.registry.get(token);
    if (!instance) throw new Error(`No registration for token: ${token}`);
    return instance as T;
  }

  has(token: string): boolean {
    return this.registry.has(token);
  }
}
