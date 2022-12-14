# zkPoR: Oracle
This oracle server is supposed to be run by 3rd party (auditor) periodically to retrieve on chain reserve balances and update smart contract.

# How to build
```sh
npm install
npm run build
```

# How to run 
- Run
```sh
cp .env.example .env
```
- Update private and public keys settings in `.env`, and server address
- Update addresses in `tokens.json` for specific CEX
- Run
```sh
npm run start
```

# Access Points
- `/`(GET): retrieve token balances per `tokens.json`.
- `/update` (PUT): retrieve token balances and update smart contract and server.

# Supported Chains and Tokens
- `ETH`: ETH, USDC
- `POLYGON`: MATIC, USDC

# Demo Server
http://oracle.zkpor.app

# License
[Apache-2.0](LICENSE)
