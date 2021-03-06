import { PublicKey } from "@solana/web3.js";

export const uniq = <T extends Array<unknown>>(arr: T) =>
  Array.from(new Set(arr)) as T;

export const chunk = <T extends Array<unknown>>(array: T, chunkSize: number) =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(undefined)
    .map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize)) as Array<T>;

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const isPublicKey = (v: any) => {
  if (v instanceof PublicKey) return true;

  try {
    new PublicKey(v.toString());
    return true;
  } catch (err) {
    return false;
  }
};
