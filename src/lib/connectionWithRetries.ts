import { Commitment, Connection } from "@solana/web3.js";
import { FunctionPropertyNames } from "accountsQuery/types";

// this is very likely to change so don't rely on it just yet
export const connectionWithRetries =
  (
    endpoints: Array<string>,
    commitment: Commitment = "confirmed",
    debug = false
  ) =>
  async <T extends FunctionPropertyNames<Connection>>(
    method: T,
    ...params: Parameters<Connection[T]>
  ): Promise<ReturnType<Connection[T]>> => {
    let data;
    while (!data && endpoints.length > 0) {
      const url = endpoints.splice(
        Math.floor(Math.random() * endpoints.length),
        1
      )[0];
      const connection = new Connection(url, commitment);
      data = await (connection[method] as any)(...params);
      if (debug) {
        console.log(data ? `success: ${url}` : `failure: ${url}`);
      }
    }
    return data;
  };
