import { PublicKey } from "@solana/web3.js";
import { AccountsQuery } from "../src";
import { AccountMetaData, SCHEMA } from "./fixture";

let customFetch: any;
beforeEach(() => {
  customFetch = jest.fn().mockResolvedValueOnce({
    json: () => Promise.resolve([]),
  });
});

test("no filters", async () => {
  const s = new AccountsQuery(SCHEMA, AccountMetaData);
  s.at("123");

  await s.fetch("confirmed", {
    customFetch,
  });

  check(customFetch, {
    body: [
      {
        jsonrpc: "2.0",
        method: "getProgramAccounts",
        id: 1,
        params: [
          "123",
          {
            commitment: "confirmed",
            encoding: "base64",
            filters: [{ dataSize: 34 }],
          },
        ],
      },
    ],
  });
});

test("where", async () => {
  const s = new AccountsQuery(SCHEMA, AccountMetaData);

  s.at("123").where({
    pubkey: new PublicKey("dammHkt7jmytvbS3nHTxQNEcP59aE57nxwV21YdqEDN"),
  });

  await s.fetch("confirmed", {
    customFetch,
  });

  checkFilters(customFetch, [
    {
      memcmp: {
        offset: 0,
        bytes: "dammHkt7jmytvbS3nHTxQNEcP59aE57nxwV21YdqEDN",
      },
    },
    { dataSize: 34 },
  ]);
});

const check = (
  mock: any,
  { url = "https://api.mainnet-beta.solana.com", body }: any
) =>
  expect(mock).toHaveBeenCalledWith(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

const checkFilters = (mock: any, filters: any) =>
  expect(mock).toHaveBeenCalledWith("https://api.mainnet-beta.solana.com", {
    body: JSON.stringify([
      {
        jsonrpc: "2.0",
        method: "getProgramAccounts",
        id: 1,
        params: [
          "123",
          {
            commitment: "confirmed",
            encoding: "base64",
            filters,
          },
        ],
      },
    ]),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
