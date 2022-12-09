import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import {
    isReady,
    Mina,
    shutdown,
} from 'snarkyjs';

import {
    loadAccounts,
    TokenNames,
    NumberOfTokens,
    Account, 
    AccountMap, 
    TotalAccountBalances,
    calcTotalBalances,
    OracleBalances} from '../contracts/src/Ledger-lib';


dotenv.config();

const app: Express = express();
app.use(bodyParser.json());

const port = getEnv('PORT', 3000);
const NetworkURL:string = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const transactionFee = 100_000_000;
const accountFileName = '../test-accounts.json';

let allAccounts : AccountMap;
let totalBalances : TotalAccountBalances;

function getEnv(name:string, defaultValue:any) {
    return (typeof process.env[name] === 'undefined') ? defaultValue : process.env[name];
}

(async function InitMina() {
    console.log('Initializing...');
    await isReady;
    console.log('SnarkJS Loaded');
    
    // console.log('Shutting down');
    // await shutdown();
    const Berkeley = Mina.Network(
        NetworkURL
      );
    Mina.setActiveInstance(Berkeley);

    allAccounts = await loadAccounts(accountFileName);
    totalBalances = calcTotalBalances(allAccounts);
    console.log('Account Data Loaded');
    console.log('Done');
})();

app.get('/account/:id', (req, res) => {
    const account = allAccounts.get(Number(req.params.id));

    if (typeof account !== 'undefined'){
        res.json(account.display());
    } else {
        res.json({'Error': 'No such user'});
    }
})

function makeAccount(accountJson : {[index: string]: number; UserID: number;}) {
    const accountId = Number(accountJson.UserID);
    const balances = Array<number>(NumberOfTokens);

    TokenNames.forEach((v, i) =>{
        balances[i] = accountJson[v];
    });

    return Account.from(accountId, balances);
}

// Update account
app.put('/account', (req, res) => {
    const accountJson = req.body;

    const accountId = Number(accountJson["UserID"]);
    const account = allAccounts.get(accountId);
    if (typeof account !== 'undefined'){
        const updatedAccount = makeAccount(accountJson);
        allAccounts.set(accountId, updatedAccount);
        totalBalances = totalBalances.sub(account).add(updatedAccount);

        res.json(updatedAccount);
    } else {
        res.json({'Error': 'No such user'});
    }
})

// Add new account
app.post('/account/', (req, res) => {
    const accountJson = req.body;

    const accountId = Number(accountJson["UserID"]);
    const account = allAccounts.get(accountId);
    if (typeof account === 'undefined') {
        const newAccount = makeAccount(accountJson);
        allAccounts.set(accountId, newAccount);
        totalBalances = totalBalances.add(newAccount);
        res.json(newAccount);
    } else {
        res.json({'Error': 'Account Already Exist'});
    }
})

app.get('/totalbalances', (req, res) => {    
    res.json(totalBalances.display());
})

app.get('/oraclebalances', (req, res) => {
})

app.put('/oraclebalances', (req, res) => {
})

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});