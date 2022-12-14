# zkPoR: Contracts

The smart contract `Ledger` has logic to update account Merkle tree and make sure the accumulated balances don't exceed the amount provided by Oracle.

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## How to make contract deployment
```sh
node build/src/deploy.js
```

## License

[Apache-2.0](LICENSE)
