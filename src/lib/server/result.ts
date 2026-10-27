import 'server-only';

export type MutationResult = {
  status: number;
  data: Record<string, any>;
  cookie?: {
    name: string;
    value: string | undefined;
    expires?: string;
    domain?: string;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'Lax' | 'None' | 'Strict';
    secure?: boolean;
  };
};

export function result(data: Record<string, any>, options = { status: 200 }): MutationResult {
  return { data, status: options.status };
}

export function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Only public response data crosses the Server Action boundary, never auth tokens. */
export function actionResult(response: MutationResult) {
  return { ...response.data, ok: response.status < 400, status: response.status } as {
    ok: boolean;
    status: number;
    error?: string;
    [key: string]: any;
  };
}
