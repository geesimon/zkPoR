import {generateRandomAccountsFile, loadAccounts, totalBalances} from './Ledger-lib.js'

const accountFileName = "../test-accounts.json";

await generateRandomAccountsFile(accountFileName);

const accounts = await loadAccounts(accountFileName);

console.log("balance_0:", accounts.get(1000).balances[0].toString()); 
console.log("balance_1:", accounts.get(1000).balances[1].toString());
console.log("balance_2:", accounts.get(1000).balances[2].toString());
console.log("hash:", accounts.get(1000).hash().toString());

const balances = totalBalances(accounts);
console.log("total_balance_1:", balances[0].toString());
console.log("total_balance_2:", balances[1].toString());
console.log("total_balance_3:", balances[2].toString());
console.log("total_balance_4:", balances[3].toString());

process.exit()