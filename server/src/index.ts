import express, { Express } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import {
    isReady,
    Mina,
    PrivateKey,
    PublicKey,
    shutdown,
    MerkleMap,
    fetchAccount,
    Field,
    MerkleMapWitness,
} from 'snarkyjs';
import {
    loadAccounts,
    TokenNames,
    NumberOfTokens,
    Account, 
    AccountMap,    
    TotalAccountBalances,
    calcTotalBalances,
    buildAccountMerkleTree,
    OracleBalances,
} from './Ledger-lib.js';
import {Ledger} from './Ledger.js';
import {makeAndSendTransaction} from './utils.js'

dotenv.config();

const app: Express = express();
app.use(bodyParser.json());

const port = getEnv('PORT', 3000);
const NetworkURL:string = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const transactionFee = 100_000_000;
const accountFileName = '../test-accounts.json';

let allAccounts : AccountMap;
let accountTree: MerkleMap;
let totalBalances : TotalAccountBalances;

let oracleBalances: OracleBalances;

let deployerPrivateKey : PrivateKey;
let oraclePublicKey : PublicKey;
let zkAppPublicKey : PublicKey;
let zkApp: Ledger;

function getEnv(name:string, defaultValue:any) {
    return (typeof process.env[name] === 'undefined') ? defaultValue : process.env[name];
}

(async function InitMina() {
    console.log('Initializing...');
    await isReady;
    console.log('SnarkJS Loaded');
    
    deployerPrivateKey = PrivateKey.fromBase58(getEnv('DEPLOYER_PRIVATE_KEY', ''));
    oraclePublicKey = PublicKey.fromBase58(getEnv('ORACLE_PUBLIC_KEY', ''));
    zkAppPublicKey = PublicKey.fromBase58(getEnv('ZKAPP_PUBLIC_KEY', ''));
    zkApp = new Ledger(zkAppPublicKey);

    // compile the contract to create prover keys
    console.log('Compiling the contract...');
    await Ledger.compile();

    const Berkeley = Mina.Network(
        NetworkURL
      );
    Mina.setActiveInstance(Berkeley);

    console.log('Loading saved accounts...');
    allAccounts = await loadAccounts(accountFileName);
    totalBalances = calcTotalBalances(allAccounts);
    accountTree = buildAccountMerkleTree(allAccounts);
    oracleBalances = new OracleBalances(totalBalances.balances);
    //Set oracle balance as doule of account balance
    oracleBalances.balances.forEach((_, i) =>{
      oracleBalances.balances[i] = oracleBalances.balances[i].mul(2);  
    });
   
    await fetchAccount({ publicKey: zkAppPublicKey });
    if (!zkApp.accountTreeRoot.get().equals(accountTree.getRoot()).toBoolean()) {
        console.log('Initializing smart contract...', zkAppPublicKey.toBase58());
    
        await makeAndSendTransaction({
            feePayerPrivateKey: deployerPrivateKey,
            zkAppPublicKey: zkAppPublicKey,
            mutateZkApp: () =>  zkApp.initState( accountTree.getRoot(), 
                                                totalBalances.hash(), 
                                                oraclePublicKey, 
                                                oracleBalances.hash()),
            transactionFee: transactionFee,
            getState: () => zkApp.accountTreeRoot.get(),
            statesEqual: (num1, num2) => num1.equals(num2).toBoolean()
        });    
    }
    // await fetchAccount({publicKey:zkAppPublicKey});
    // console.log('Tree Root:', zkApp.accountTreeRoot.get().toString());

    // let transaction = await Mina.transaction(
    //         { feePayerKey: deployerPrivateKey, fee: transactionFee },
    //         () => {
    //             zkApp.initState(accountTree.getRoot(), totalBalances.hash(), oraclePublicKey, oracleBalances.hash());
    //         }
    // );
    // await transaction.prove();
    // console.log('Sending initialization transaction...');
    // const res = await transaction.send();
    // const hash = res.hash();
    // if (hash == null) {
    //     console.log('error sending transaction (see above)');
    // } else {
    //     console.log(
    //         'See deploy transaction at',
    //         'https://berkeley.minaexplorer.com/transaction/' + hash
    //     );
    // }

    console.log('Done');
})();

app.get('/account/:id', (req, res) => {
    const account = allAccounts.get(Number(req.params.id));
    
    if (typeof account !== 'undefined'){
        const accountHash = account.hash();
        const witness = accountTree.getWitness(account.id);

        res.json({
                    'Account': account.display(),
                    'MerklePath': witness.toJSON(),
                    'AccountHash': account.hash().toString(),
                    'AccountMerkleRoot:': accountTree.getRoot().toString(),
                    'MerklePathRoot': witness.computeRootAndKey(accountHash)[0].toString(),
                });
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
app.put('/account', async (req, res) => {
    const accountJson = req.body;

    const accountId = Number(accountJson["UserID"]);
    const oldAccount = allAccounts.get(accountId);
    if (typeof oldAccount !== 'undefined'){
        const updatedAccount = makeAccount(accountJson);
        
        // update transaction
        try {
            console.log("Building transaction and create proof for account update");
            await makeAndSendTransaction({
                feePayerPrivateKey: deployerPrivateKey,
                zkAppPublicKey: zkAppPublicKey,
                mutateZkApp: () =>  zkApp.updateAccount( oldAccount,
                                                        accountTree.getWitness(Field(accountId)), 
                                                        updatedAccount,
                                                        totalBalances,
                                                        oracleBalances),
                transactionFee: transactionFee,
                getState: () => zkApp.accountTreeRoot.get(),
                statesEqual: (num1, num2) => num1.equals(num2).toBoolean()
            });

            allAccounts.set(accountId, updatedAccount);
            accountTree.set(Field(accountId), updatedAccount.hash());
            totalBalances = totalBalances.sub(oldAccount!).add(updatedAccount);

            res.json(updatedAccount.display());
        } catch (e){
            res.json({'Error': e});
            console.log(e)
        }
    } else {
        res.json({'Error': 'No such user'})
    };
})

// Add new account
app.post('/account', async (req, res) => {
    const accountJson = req.body;

    const accountId = Number(accountJson["UserID"]);
    const account = allAccounts.get(accountId);
    if (typeof account === 'undefined') {
        const newAccount = makeAccount(accountJson);        
        // update transaction
        try {
            console.log("Building transaction and create proof for new account");

            allAccounts.set(accountId, newAccount);            
            await makeAndSendTransaction({
                feePayerPrivateKey: deployerPrivateKey,
                zkAppPublicKey: zkAppPublicKey,
                mutateZkApp: () =>  zkApp.addAccount( newAccount, 
                                                    accountTree.getWitness(Field(accountId)), 
                                                    totalBalances,
                                                    oracleBalances ),
                transactionFee: transactionFee,
                getState: () => zkApp.accountTreeRoot.get(),
                statesEqual: (num1, num2) => num1.equals(num2).toBoolean()
            });

            accountTree.set(Field(accountId), newAccount.hash());
            totalBalances = totalBalances.add(newAccount);

            res.json(newAccount.display());
        } catch (e){
            //Todo: Rollback
            res.json({'Error': e});
            console.log(e)
        }
    } else {
        res.json({'Error': 'Account Already Exist'});
    }
})

app.get('/totalbalances', (req, res) => {    
    res.json(totalBalances.display());
})

app.get('/oraclebalances', (req, res) => {
    res.json(oracleBalances.display());
})

app.put('/oraclebalances', async (req, res) => {
    console.log(req.body);
    const newOracleBalanceJson = req.body;

    let newOracleBalance = new OracleBalances();

    TokenNames.forEach((v, i) =>{
        newOracleBalance.balances[i] = Field(newOracleBalanceJson[v]);
    });
    
    //Check to make sure oracle balances match the hash stored in smart contract
    await fetchAccount({ publicKey: zkAppPublicKey });
    if (zkApp.oracleBalancesHash.get().equals(newOracleBalance.hash()).toBoolean()){
        oracleBalances = newOracleBalance;

        res.json(oracleBalances.display());
    } else {
        res.json({'Error':'Invalid Oracle Balances'});
    }    
})

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});