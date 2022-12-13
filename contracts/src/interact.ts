import { 
        Mina, 
        PrivateKey, 
        shutdown, 
        isReady,
        fetchAccount, 
        Field,
        PublicKey,
      } from 'snarkyjs';
import {Ledger} from './Ledger.js';
import {
  Account,
  calcTotalBalance,
  buildAccountMerkleTree,
  OracleBalance} from './Ledger-lib'
import {loadAccounts} from './account-utils';

import dotenv from 'dotenv';

const accountFileName = "../test-accounts.json";

function getEnv(name:string, defaultValue:any) {
    return (typeof process.env[name] === 'undefined') ? defaultValue : process.env[name];
}

dotenv.config();

console.log('Loading SnarkyJS...');
await isReady;

let allAccounts = await loadAccounts(accountFileName);
let totalBalances = calcTotalBalance(allAccounts);
let accountTree = buildAccountMerkleTree(allAccounts);    
let oracleBalances = new OracleBalance(totalBalances.balances);
//Set oracle balance as doule of account balance
oracleBalances.balances.forEach((_, i) =>{
  oracleBalances.balances[i] = oracleBalances.balances[i].mul(2);  
});


const NetworkUrl = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const Berkeley = Mina.Network(NetworkUrl);
Mina.setActiveInstance(Berkeley);

let transactionFee = 100_000_000;

const deployerPrivateKey = PrivateKey.fromBase58(getEnv('DEPLOYER_PRIVATE_KEY', ''));
const zkAppPrivateKey = PrivateKey.fromBase58(getEnv('ZKAPP_PRIVATE_KEY', ''));
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
const oraclePublicKey = PublicKey.fromBase58(getEnv('ORACLE_PUBLIC_KEY', ''));

let zkApp = new Ledger(zkAppPublicKey);

// compile the contract to create prover keys
console.log('Compiling the contract...');
await Ledger.compile();

await fetchAccount({publicKey:zkAppPublicKey});
console.log('Tree Root:', zkApp.accountTreeRoot.get().toString());

console.log('build transaction and create proof...');
let tx = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: transactionFee }, () => {
  zkApp.initState(accountTree.getRoot(), totalBalances.hash(), oraclePublicKey, oracleBalances.hash());

  const newAccountId = 2000;
  const newAccount = Account.from(newAccountId, [100, 100, 100, 10]);
  accountTree.set(Field(newAccountId), newAccount.hash());
  allAccounts.set(newAccountId, newAccount);

  zkApp.addAccount( newAccount, 
    accountTree.getWitness(Field(newAccountId)), 
    totalBalances, 
    oracleBalances );
});
await tx.prove();
console.log('Send transaction...');
let sentTx = await tx.send();

if (sentTx.hash() !== undefined) {
  console.log('Your smart contract state will be updated.',
              'As soon as the transaction is included in a block:',
              `https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}`);
}

shutdown();
