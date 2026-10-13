import { secureStorage } from '../lib/secureStore';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;

  constructor(status: number, errorData: ApiErrorResponse['error']) {
    super(errorData.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = errorData.code;
    this.requestId = errorData.requestId;
  }
}

export class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string> | null = null;
  private onAuthFailureCallbacks: Array<() => void> = [];

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  public onAuthFailure(cb: () => void) {
    this.onAuthFailureCallbacks.push(cb);
  }

  private triggerAuthFailure() {
    this.onAuthFailureCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }

  /**
   * Refreshes access token with in-flight coalescing.
   * Concurrent 401s await the same shared promise, preventing duplicate token reuse (Proof Test T4).
   */
  public async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const currentRefreshToken = await secureStorage.getRefreshToken();
        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }

        const res = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });

        if (!res.ok) {
          await secureStorage.clearTokens();
          this.triggerAuthFailure();
          throw new Error('Refresh token rejected or expired');
        }

        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        await secureStorage.setAccessToken(data.accessToken);
        await secureStorage.setRefreshToken(data.refreshToken);
        return data.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    // Attach Bearer token if not already present
    if (!headers.has('Authorization')) {
      const accessToken = await secureStorage.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized with token refresh and single retry
    if (response.status === 401 && !endpoint.includes('/v1/auth/')) {
      try {
        const newAccessToken = await this.refreshAccessToken();
        headers.set('Authorization', `Bearer ${newAccessToken}`);

        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          const errBody = (await retryResponse.json().catch(() => ({
            error: { code: 'HTTP_ERROR', message: `Request failed with status ${retryResponse.status}` },
          }))) as ApiErrorResponse;
          throw new ApiError(retryResponse.status, errBody.error);
        }

        return (await retryResponse.json()) as T;
      } catch (refreshErr) {
        throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' });
      }
    }

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({
        error: { code: 'HTTP_ERROR', message: `Request failed with status ${response.status}` },
      }))) as ApiErrorResponse;
      throw new ApiError(response.status, errBody.error);
    }

    // For 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  public get<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  public post<T>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public patch<T>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public delete<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
export const apiClient = api;
