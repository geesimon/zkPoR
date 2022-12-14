# zkPoR: Contracts

The smart contract `Ledger` has logic to update account Merkle tree and make sure the accumulated balances don't exceed the amount provided by [Oracle](https://github.com/geesimon/zkPoR/tree/main/oracle).

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to make deployment (Berkeley)

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

## License

[Apache-2.0](LICENSE)
