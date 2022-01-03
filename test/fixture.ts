import { PublicKey } from "@solana/web3.js";

export class AccountMetaData {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;

  constructor(args: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }) {
    this.pubkey = args.pubkey;
    this.isSigner = !!args.isSigner;
    this.isWritable = !!args.isWritable;
  }
}

export const SCHEMA = new Map([
  [
    AccountMetaData,
    {
      kind: "struct",
      fields: [
        ["pubkey", "pubkey"],
        ["isSigner", "u8"],
        ["isWritable", "u8"],
      ],
    },
  ],
]);
