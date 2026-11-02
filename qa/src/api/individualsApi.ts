import type { APIRequestContext, APIResponse } from '@playwright/test';
import { INDIVIDUALS_PATH } from '../config';

/** Thin wrapper over the four operations the application really exposes (plus raw helpers for negative tests). */
export class IndividualsApi {
  constructor(private readonly request: APIRequestContext) {}

  list(): Promise<APIResponse> {
    return this.request.get(INDIVIDUALS_PATH);
  }

  get(id: number | string): Promise<APIResponse> {
    return this.request.get(`${INDIVIDUALS_PATH}/${encodeURIComponent(String(id))}`);
  }

  create(body: unknown): Promise<APIResponse> {
    return this.request.post(INDIVIDUALS_PATH, { data: body });
  }

  /** Send an arbitrary body / content type, e.g. malformed JSON. Omit `body` for an empty request. */
  createRaw(body: string | undefined, contentType = 'application/json'): Promise<APIResponse> {
    return this.request.post(INDIVIDUALS_PATH, { data: body, headers: { 'content-type': contentType } });
  }

  delete(id: number | string): Promise<APIResponse> {
    return this.request.delete(`${INDIVIDUALS_PATH}/${encodeURIComponent(String(id))}`);
  }

  /** Any method on any sub-path of /individuals, for "method not allowed" checks. */
  send(method: string, subPath = '', body?: unknown): Promise<APIResponse> {
    return this.request.fetch(`${INDIVIDUALS_PATH}${subPath}`, { method, data: body });
  }
}
