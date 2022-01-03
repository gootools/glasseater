# GlassEater

Tools that [eat glass](https://www.theblockcrypto.com/post/123515/solana-labs-ceo-part-of-our-culture-is-to-eat-glass) so you don't have to.

![glass eating](https://user-images.githubusercontent.com/601961/147985138-87c41e8f-5fb8-4b0b-a0f9-e82550ab29ed.gif)

Docs coming soon...

## Features

- generates the most precise and optimal getProgramAccounts queries possible
- automatically batches queries
- autocompletes and type checks everything it possibly can
- enables advanced local filtering
- accepts custom borsh deserializers and fetch functions
- zero dependencies (for the time being)

### Installation

`(npm|pnpm|yarn) add glasseater @solana/web3.js`

### Usage

```typescript
import { AccountsQuery } from "glasseater";

const query = new AccountsQuery(SCHEMA, Proposal);

query
  .at(programId)
  .select(["config"])
  .where({
    accountType,
    realm: new PublicKey(realmId),
  });

const proposals = await query.fetch();
```

### Wishlist

- tests
- anchor IDL support
- joins
- simpler interface
- deduplication a la https://swr.vercel.app
