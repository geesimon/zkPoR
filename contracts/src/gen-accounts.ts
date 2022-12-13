import {
        calcTotalBalances,
        buildAccountMerkleTree,
        Account
        } from './Ledger-lib.js'
import { Field } from 'snarkyjs';        
import {generateRandomAccountsFile, loadAccounts} from './account-utils';

const accountFileName = "../test-accounts.json";

// await generateRandomAccountsFile(accountFileName, 10);

console.log("==========================Test Load");
const accounts = await loadAccounts(accountFileName);
const accoundId = accounts.keys().next().value;
console.log("id", accoundId);
console.log("balance_0:", accounts.get(accoundId)!.balances[0].toString());
console.log("balance_1:", accounts.get(accoundId)!.balances[1].toString());
console.log("balance_2:", accounts.get(accoundId)!.balances[2].toString());
console.log("hash:", accounts.get(accoundId)!.hash().toString());

console.log("==========================Test Balance Calculation");
let totalBalances = calcTotalBalances(accounts);
console.log("total_balance_1:", totalBalances.balances[0].toString());
console.log("total_balance_2:", totalBalances.balances[1].toString());
console.log("total_balance_3:", totalBalances.balances[2].toString());
console.log("total_balance_4:", totalBalances.balances[3].toString());
console.log("hash:", totalBalances.hash().toString());


console.log("==========================Test Add");
let account = Account.from(accoundId, [100, 100, 100, 10]);
totalBalances = totalBalances.add(account);
console.log("total_balance_1:", totalBalances.balances[0].toString());
console.log("total_balance_2:", totalBalances.balances[1].toString());
console.log("total_balance_3:", totalBalances.balances[2].toString());
console.log("total_balance_4:", totalBalances.balances[3].toString());
console.log("hash:", totalBalances.hash().toString());
console.log("==========================Test Sub");
totalBalances = totalBalances.sub(account, false);
console.log("total_balance_1:", totalBalances.balances[0].toString());
console.log("total_balance_2:", totalBalances.balances[1].toString());
console.log("total_balance_3:", totalBalances.balances[2].toString());
console.log("total_balance_4:", totalBalances.balances[3].toString());
console.log("hash:", totalBalances.hash().toString());


console.log("==========================Test Merkel Tree Building");
const tree = buildAccountMerkleTree(accounts);
console.log("Merkel root:", tree.getRoot().toString());

// Add
console.log("Old tree root:", tree.getRoot().toString());

const newAccountId = accoundId * 100;
const newAccount = Account.from(newAccountId, [100, 100, 100, 10]);
accounts.set(newAccountId, newAccount);
tree.set(Field(newAccountId), newAccount.hash());
console.log("New tree root:", tree.getRoot().toString());
console.log("Witness new root:", tree.getWitness(Field(newAccountId)).computeRootAndKey(newAccount!.hash())[0].toString());

// Update
console.log("==========================Test Update");
let oldAccount = accounts.get(accoundId);
let updatedAccount = Account.from(accoundId, [100, 100, 100, 10]);
let oldPath = tree.getWitness(Field(accoundId));

accounts.set(accoundId, updatedAccount);
tree.set(Field(accoundId), updatedAccount.hash());

console.log("Witness old root:", oldPath.computeRootAndKey(oldAccount!.hash())[0].toString());
console.log("Witness new root:", oldPath.computeRootAndKey(newAccount!.hash())[0].toString());
console.log("New tree root:", tree.getRoot().toString());



process.exit()