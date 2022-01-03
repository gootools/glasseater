export type KeyOfMap<M extends Map<unknown, unknown>> = M extends Map<
  infer K,
  unknown
>
  ? K
  : never;

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export interface Constructable<T> {
  new (...args: any): T;
}

export interface Filter {
  offset: number;
  bytes: string;
}

export type RequestID = string | number | Array<string | number>;

export interface Args<K> {
  select?: Array<keyof Pick<K, NonFunctionPropertyNames<K>>> | false;
  where?: {
    [P in keyof Pick<K, NonFunctionPropertyNames<K>>]?:
      | Pick<K, NonFunctionPropertyNames<K>>[P]
      | ((field: Pick<K, NonFunctionPropertyNames<K>>[P]) => boolean)
      | null;
  };
  metadata?: Record<string, any>;
  requestId?: any;
  limit?: number;
  order?: Partial<
    Record<keyof Pick<K, NonFunctionPropertyNames<K>>, "desc" | "asc">
  >;
}
