import { ProxyFieldTracker } from './ProxyFieldTracker.js';
import type { ConsumerReporter } from './ConsumerReporter.js';

export function createTrackedFetch(
  consumerReporter: ConsumerReporter,
  serviceName: string,
): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, init);

    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return response;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    const cloned = response.clone();
    let body: unknown;
    try {
      body = await cloned.json();
    } catch {
      return response;
    }

    if (typeof body !== 'object' || body === null) {
      return response;
    }

    const tracker = new ProxyFieldTracker();
    const proxied = tracker.wrap(body as Record<string, unknown>);

    setImmediate(() => {
      const fields = tracker.getAccessedFields();
      if (fields.length === 0) return;

      const providerHost = parsedUrl.hostname;
      const endpoint = `GET ${parsedUrl.pathname}`;

      consumerReporter.add({
        provider: providerHost,
        endpoint,
        fieldsAccessed: fields,
      });
    });

    const modifiedResponse = new Proxy(response, {
      get(target, prop, receiver) {
        if (prop === 'json') {
          return async () => proxied;
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    return modifiedResponse;
  };
}
