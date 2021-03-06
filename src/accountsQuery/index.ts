import {
  clusterApiUrl,
  Commitment,
  Connection,
  PublicKey,
} from "@solana/web3.js";
import { deserializeUnchecked, Schema } from "borsh";
import bs58 from "bs58";
import { fetch } from "cross-fetch";
import { chunk, isPublicKey, sleep } from "../lib/utils.js";
import { Account, Args, Constructable, Filter, KeyOfMap } from "./types.js";

const numBytesForType = {
  u8: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  pubkey: 32,
};

const defaults = ["confirmed", {}];
export const setDefaults = (
  ...fetchParams: Parameters<AccountsQuery<any, any>["fetch"]>
) => {
  defaults[0] = (fetchParams[0] as any) || defaults[0];
  defaults[1] = (fetchParams[1] as any) || defaults[1];
};

/**
 * AccountsQuery is a class with a chainable
 * query-builder interface for fetching parsed Borsh accounts
 */
export class AccountsQuery<S extends Schema, K> {
  protected parent?: AccountsQuery<S, K>;
  protected children: Array<AccountsQuery<S, K>> = [];
  protected programAddress?: string | PublicKey;

  private args: Args<K> = {};

  constructor(
    private schema: S,
    private klass: KeyOfMap<S> & Constructable<K>
  ) {}

  /**
   * the public key or address of the program
   * either a 32-44 base58 string or a web3.PublicKey
   */
  for(programAddress: string | PublicKey) {
    const item = new AccountsQuery<S, K>(this.schema, this.klass);
    item.programAddress = programAddress;
    item.parent = this;
    this.children.push(item);
    return item;
  }

  /**
   * an array of fields you want to return
   * don't use a select() if you want to return everything,
   * or use `false` if you don't want to select anything
   */
  select(fields: Args<K>["select"]) {
    this.args.select = fields;
    return this;
  }

  /**
   * a `{ [fieldName]: value }` object for equality searches,
   * can be `[fieldName]: nil` to filter for NULL values, or
   * `[fieldName]: (field) => boolean` for advanced filtering
   */
  where(filters: Args<K>["where"]) {
    this.args.where = filters;
    return this;
  }

  /**
   * the maximum number of records to return
   */
  // limit(limit: Args<K>["limit"]) {
  //   this.args.limit = limit;
  //   return this;
  // }

  /**
   * return records sorted by fields in ascending or descending
   * order. Ordering of keys is significant i.e.
   * `{ fA: 'asc', fB: 'desc' }` == ORDER BY fA ASC, fB DESC
   */
  // order(orders: Args<K>['order']) {
  //   this.args.order = orders
  //   return this
  // }

  /**
   * accepts an object of extra custom data to include inside the
   * $metadata object attached of each record that's returned
   */
  injectMetadata(metadata: Args<K>["metadata"]) {
    this.args.metadata = metadata;
    return this;
  }

  /**
   * builds and submits the query, ending the method chain
   */
  async fetch(
    commitmentOrConnection:
      | Connection
      | { commitment?: Commitment; endpoint?: string }
      | Commitment = defaults[0],
    {
      customDeserializer = deserializeUnchecked,
      customFetch = fetch,
      debug = false,
      includeEmptyResults = false,
      includeMetadata = true,
      maxNumberOfRequestsPerBatch = 100,
      msDelayBetweenBatchedRequests = 1000,
    }: {
      customDeserializer?: typeof deserializeUnchecked;
      customFetch?: typeof fetch;
      debug?: boolean;
      includeEmptyResults?: boolean;
      includeMetadata?: boolean;
      maxNumberOfRequestsPerBatch?: number;
      msDelayBetweenBatchedRequests?: number;
    } = defaults[1]
  ): Promise<ReadonlyArray<Account<K>>> {
    if (this.parent) throw new Error("call fetch on the root instance");

    const [commitment = "confirmed", endpoint = clusterApiUrl("mainnet-beta")] =
      (() => {
        // XXX: string because web3 doesn't export const array of Commitments
        if (typeof commitmentOrConnection === "string") {
          return [commitmentOrConnection];
        } else if (commitmentOrConnection instanceof Connection) {
          return [
            // XXX: confirmed bc Connection doesn't always have a commitment?
            commitmentOrConnection.commitment,
            // XXX: type: any bc web3.Connection doesn't expose .endpoint
            (commitmentOrConnection as any).endpoint,
          ];
        } else {
          return [
            commitmentOrConnection.commitment,
            commitmentOrConnection.endpoint,
          ];
        }
      })();

    const query = this.children
      .filter(Boolean)
      .map((c) => c.buildQuery(commitment));

    const batches = chunk(
      query.map((q) => q.payload),
      maxNumberOfRequestsPerBatch
    );

    const json: Array<{
      json: "2.0";
      id: number | string;
      result: Array<{ account: any; pubkey: string }>;
    }> = [];

    let count = 0;
    for (const body of batches) {
      if (debug) console.debug(JSON.stringify({ request: body }, null, 2));

      const response = await customFetch(endpoint, {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      const responses = await response.json();

      responses.forEach((response: any) => json.push(response));

      if (msDelayBetweenBatchedRequests && ++count < batches.length) {
        await sleep(msDelayBetweenBatchedRequests);
      }
    }

    if (debug) console.debug(JSON.stringify({ json }, null, 2));

    const fails = new Set();
    let counter = 0;

    const vals = json.map(({ result }, i) => {
      const q = query[i];

      const val = result.map((r) => {
        if (
          q.options.dataSize &&
          q.options.dataSlice &&
          Array.isArray(q.instance.args.select) &&
          q.instance.args.select.length > 0
        ) {
          const { dataSize, dataSlice } = q.options;

          const ob: any = customDeserializer(
            q.instance.schema,
            q.instance.klass,
            Buffer.concat([
              Buffer.alloc(dataSlice.offset, 0, "base64"),
              Buffer.from(...(r.account.data as [any, any])),
              Buffer.alloc(
                dataSize - dataSlice.offset + dataSlice.length,
                0,
                "base64"
              ),
            ])
          );

          return q.instance.args.select.reduce(
            (acc: any, curr: any) => {
              acc.data[curr] = ob[curr as any];
              return acc;
            },
            {
              pubkey: r.pubkey,
              data: {},
            } as any
          );
        } else if (!q.options.dataSize || q.instance.args.select !== false) {
          return Object.entries(
            customDeserializer(
              q.instance.schema,
              q.instance.klass,
              Buffer.from(...(r.account.data as [any, any]))
            )
          ).reduce(
            (acc, [k, v]) => {
              if (
                !Array.isArray(q.instance.args.select) ||
                q.instance.args.select.includes(k as any)
              ) {
                acc.data[k] = v;
              }
              return acc;
            },
            {
              pubkey: r.pubkey,
              data: {},
            } as any
          );
        } else {
          console.log({ c: q });
        }
      });

      const tryToMakeClass: any = (data: any) => {
        try {
          return new this.klass(data);
        } catch (err) {
          return data;
        }
      };

      return val
        .filter((v) => {
          const pass = q.functions.every(([k, fn]: any) =>
            fn(v.data[k], tryToMakeClass(v.data))
          );
          if (!pass) fails.add(counter);
          counter++;
          return v && pass;
        })
        .map((v) => {
          const ob = tryToMakeClass(v.data);
          if (includeMetadata) {
            ob.$metadata = {
              ...(q.instance.args.metadata ?? {}),
              pubkey: v.pubkey,
              requestId: q.instance.args.requestId ?? 1,
            };
          }
          return ob;
        });
    });

    const results = vals.flat().filter((_, i) => !fails.has(i));
    // .slice(0, this.args.limit ?? Infinity);

    // if (this.args.order) {
    //   const order = Object.entries(this.args.order)?.[0]
    //   if (order) {
    //     const [fieldName, direction] = order
    //     if (direction === 'asc') {
    //       results = results.sort((a, b) => a[fieldName] - b[fieldName])
    //     } else {
    //       results = results.sort((a, b) => b[fieldName] - a[fieldName])
    //     }
    //   }
    // }

    return includeEmptyResults ? results.filter(Boolean) : results;
  }

  protected buildQuery(commitment: Commitment) {
    const { fields: f } = this.schema.get(this.klass) as any;

    if (!this.programAddress)
      throw new Error("missing program address - use `.for()`");

    const getLength = (type: any) => {
      const dictionary = numBytesForType as any;
      let length = dictionary[type] ?? dictionary[type.type];
      if (!length) {
        if (
          Array.isArray(type) &&
          type.length === 1 &&
          Number.isFinite(type[0])
        ) {
          length = type[0];
        } else if (this.schema.get(type)) {
          const { fields } = this.schema.get(type) as any;
          length = fields.reduce(
            (acc: any, curr: any) => acc + getLength(curr[1]),
            0
          );
        } else if (type.type) {
          length = getLength(type.type);
        } else {
          if (type !== "string") {
            console.error("unknown type", type);
          } else {
            // TODO: handle strings
          }
        }
      }
      return length;
    };

    const { maxLength, fields } = f.reduce(
      (acc: any, [name, type]: any) => {
        const length = getLength(type);
        acc.fields[name] = { type, offset: acc.offset, length };
        acc.offset += length;
        acc.maxLength = acc.offset;
        return acc;
      },
      { offset: 0, maxLength: 0, fields: {} }
    );

    const functions = Object.entries(this.args.where ?? {}).filter(
      ([_, v]) => typeof v === "function"
    );

    const selects = (this.args.select || [])
      .map((s) => fields[s])
      .filter(Boolean)
      .sort((a, b) => a.offset - b.offset);

    const options = {
      memcmps: Object.entries(this.args.where ?? {})
        .filter(([_, v]) => typeof v !== "function")
        .reduce((acc, [k, v]) => {
          if (fields[k]) {
            let data: string;

            if (v === null) {
              // zero-fill null values
              data = bs58.encode(Buffer.alloc(fields[k].length));
            } else if (isPublicKey(v)) {
              // instanceof PublicKey not working, so use custom method
              data = (v as PublicKey).toBase58();
            } else {
              data = bs58.encode([v].flat() as any[]);
            }

            if (bs58.decode(data).length !== fields[k].length) {
              console.error({
                wrongLength: {
                  k,
                  data,
                  dataLength: bs58.decode(data).length,
                  fieldLength: fields[k].length,
                },
              });

              throw new Error("wrong length");
            }

            acc.push({
              offset: fields[k].offset,
              bytes: data,
            });
          }

          return acc;
        }, [] as Array<Filter>)
        .sort((a, b) => a.offset - b.offset),

      dataSlice:
        this.args.select === false
          ? { offset: 0, length: 0 }
          : selects.length > 0
          ? {
              offset: selects[0].offset,
              length:
                selects[selects.length - 1].offset +
                selects[selects.length - 1].length -
                selects[0].offset,
            }
          : undefined,

      dataSize: maxLength || undefined,
    };

    const filters: any = options.memcmps.map((memcmp) => ({ memcmp }));
    if (options.dataSize) filters.push({ dataSize: options.dataSize });
    const params: any = {
      commitment,
      encoding: "base64",
    };
    if (filters.length > 0) params.filters = filters;
    if (options.dataSlice && maxLength) params.dataSlice = options.dataSlice;

    return {
      instance: this as any,
      functions,
      fields,
      selects,
      options,
      payload: {
        jsonrpc: "2.0",
        method: "getProgramAccounts",
        // todo: replace with better ID, saving request size space atm
        id: 1, // this.args.requestId ? String(this.args.requestId) : 1,
        params: [this.programAddress.toString(), params],
      },
    };
  }
}
