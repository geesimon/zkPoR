# zkPoR: UI
This Next based web UI provide end user a tool to verify account inclusion in these steps,

1. User retrieves their account balances and Merkle path from CEX.
2. Check account balances and user id is correct.
2. In this UI, user copy and paste such info (as JSON content) and then `Verify`

If user's account info is included in Merkle tree, the verification will succeed. 

Note: since we only need to verify Merkle tree inclusion, i.e., `witness.computeRootAndKey(userhash) === AccountMerkleRoot`. We don't need to compute proof and send transaction. Therefore, this verification is pretty fast. User also don't need to install Auro wallet.

# How to run 
```sh
npm run build && npm run start
```

# Demo Server
https://zkpor.app

To find the user balance and merkle path,
- Use the content in [test.json](test.json) (user id: 1000), or
- Use demo server: http://server.zkpor.app/1001

# License
[Apache-2.0](LICENSE)
