import { describe, it, expect } from 'vitest';
import { ProxyFieldTracker } from '../../src/tracking/ProxyFieldTracker.js';

describe('ProxyFieldTracker', () => {
  it('records top-level field access', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ id: 1, name: 'test' });
    void proxied.id;
    expect(tracker.getAccessedFields()).toContain('id');
  });

  it('records nested field access', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ user: { name: 'Alice' } });
    void proxied.user.name;
    const fields = tracker.getAccessedFields();
    expect(fields).toContain('user');
    expect(fields).toContain('user.name');
  });

  it('records array index access', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ tags: ['a', 'b'] });
    void proxied.tags[0];
    const fields = tracker.getAccessedFields();
    expect(fields).toContain('tags');
    expect(fields).toContain('tags[]');
  });

  it('records Object.keys enumeration', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ a: 1, b: 2 });
    Object.keys(proxied);
    const fields = tracker.getAccessedFields();
    expect(fields).toContain('a');
    expect(fields).toContain('b');
  });

  it("records 'in' operator", () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ name: 'x' });
    void ('name' in proxied);
    expect(tracker.getAccessedFields()).toContain('name');
  });

  it('records destructuring', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ id: 1, name: 'test' });
    const { id, name } = proxied;
    void id;
    void name;
    const fields = tracker.getAccessedFields();
    expect(fields).toContain('id');
    expect(fields).toContain('name');
  });

  it('reset clears tracked fields', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ x: 1 });
    void proxied.x;
    expect(tracker.getAccessedFields().length).toBeGreaterThan(0);
    tracker.reset();
    expect(tracker.getAccessedFields()).toEqual([]);
  });

  it('records deeply nested access', () => {
    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap({ a: { b: { c: 1 } } });
    void proxied.a.b.c;
    const fields = tracker.getAccessedFields();
    expect(fields).toContain('a');
    expect(fields).toContain('a.b');
    expect(fields).toContain('a.b.c');
  });
});
