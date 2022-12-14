# zkPoR: Server

This server is supposed to be run by CEX internally to update smart contract per user balance changes.

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
- Update private and public keys settings in .env
- Run
```sh
npm run start
```

# Access Points
- `/account/:id`(GET): retrieve account info (balance and Merkle path)
- `/account` (POST): add new account
- `/account` (PUT): update account
- `/totalbalances`(GET): retrieve accumulated balances for all users
- `/oraclebalances`(GET): retrieve oracle balances (updated by Oracle)
- `/oraclebalances`(PUT): update oracle balances (called by Oracle)

# Please Note
Current implementation is to demonstrate the technical feasibility of using zkApp to update user account balance. Thus, we don’t spend time working on securing the server access, making the server more reliable and scalable. For production usage, a re-architecture is needed.

# Demo Server
http://server.zkpor.app

# License
[Apache-2.0](LICENSE)
