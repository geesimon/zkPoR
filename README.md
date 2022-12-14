# zkPoR - Zero Knowledge proof application for Proof of Reserves

zkPoR is a Mina zkApp that enables CEX proves they have enough fund to cover users’ assets by using public reviewable logic without leaking privacy.
 
# Problem Statement

Within the blockchain space, proof of reserves is commonly known as an independent audit that enables centralized exchanges to publicly attest to the value of their reserves. Because centralized third parties typically conduct these audits, they can be lengthy, opaque, and time-consuming manual processes.

# zkApp Solution

zkPoR is based on Mina zkApp infrastructure. It has logic (smart contract method) to update Merkle tree and make sure the CEX’s liability (accumulated fund of all user accounts) won’t exceed the fund they hold onchain (through Oracle). 
Thanks to ZK technology, the smart contract logic is published publicly and CEX won’t be able to cheat on the update logic. In addition, this update is done without revealing user’s private information.
End user can verify their account inclusion and correctness through a web UI.

# Component
- [`Contracts`]( https://github.com/geesimon/zkPoR/tree/main/contracts): zkApp smart contract that has logic to update account Merkle tree and make sure the accumulated fund won’t exceed the reserves (on chain asset amount published by Oracle).
- [`Server`](https://github.com/geesimon/zkPoR/tree/main/server): a node server that is responsible for calling smart contracts to update account Merkle tree and return Merkle path to end user.
- [`Oracle`](https://github.com/geesimon/zkPoR/tree/main/oracle): a node server that retrieve token balances from CEX’s published addresses and update smart contract.
- [`UI`](https://github.com/geesimon/zkPoR/tree/main/ui): UI for end user to verify account inclusion.

# Discussions
## Fake Account Data
Smart contract guarantees the update logic is done correctly, but it won’t prevent CEX from submitting faked data. The smart contract has logic from prevent updating balance using negative value (overflow check). And CEX won’t benefit from adding more fake accounts to the Merkle tree. However, CEX has incentive to not include some user’s account in the Merkle tree to reduce their liabilities. We will need to depend on end user to report failure of inclusion through the web UI.

## Proof of Asset 
The Oracle currently blindly trust the published addresses are owned by CEX. It is possible to build another smart contract that ask CEX proves the ownership of these addresses (has private keys to the address’s public key)
