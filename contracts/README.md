# zkPoR: Contracts

The smart contract `Ledger` has logic to update account Merkle tree and make sure the accumulated balances don't exceed the amount provided by [Oracle](https://github.com/geesimon/zkPoR/tree/main/oracle).

# How to build

```sh
npm install
npm run build
```

# How to run tests

```sh
npm run test
npm run testw # watch mode
```

# Berkeley Deployment
Address: [`B62qkxEUpZptriUW45cdxurMy8VTs1U9LoiZiZe3WRsHLSCho6AhLbv`](https://berkeley.minaexplorer.com/wallet/B62qkxEUpZptriUW45cdxurMy8VTs1U9LoiZiZe3WRsHLSCho6AhLbv)

# How to make new deployment (Berkeley)

- Create an Mina account for zkPoR (this account will be used to store this zkApp)
- Run
```sh
cp .env.example .env
```
- Update private and public keys settings in .env
- Run
```sh
node  --experimental-specifier-resolution=node build/src/deploy.js
```

# License

[Apache-2.0](LICENSE)
