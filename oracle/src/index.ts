import express, { Express } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import {
    isReady,
    Mina,
    PrivateKey,
    PublicKey,
    shutdown,
    fetchAccount,
    Field,
    Signature,
} from 'snarkyjs';
import {
    OracleBalances,
} from './Ledger-lib.js';
import {Ledger} from './Ledger.js';
import {makeAndSendTransaction} from './utils.js';
import {getETHBalance, getUSDCBalance} from './token-balances.js';
import fs from 'fs/promises';
import axios from 'axios';

dotenv.config();

const app: Express = express();
app.use(bodyParser.json());

const port = getEnv('PORT', 3000);
const NetworkURL:string = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const ETHNetworkURL:string = getEnv('ETH_NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const PolygonNetworkURL:string = getEnv('POLYGON_NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
const USDCETHAddress:string = getEnv('USDC_ETH_ADDRESS', '');
const USDCPolygonAddress:string = getEnv('USDC_POLYGON_ADDRESS', '');

const ServerURL:string = getEnv('SERVER_URL', 'http://localhost:8000');
const transactionFee = 100_000_000;
const TokenReservesFileName = './tokens.json';

let oraclePrivateKey : PrivateKey;
let zkAppPublicKey : PublicKey;
let zkApp: Ledger;

function getEnv(name:string, defaultValue:any) {
    return (typeof process.env[name] === 'undefined') ? defaultValue : process.env[name];
}

async function retreiveBalances(tokenReservesFileName: string){
    let tokenBalances = new OracleBalances();

    const tokenAddresses = JSON.parse(
        await fs.readFile(tokenReservesFileName, 'utf8')
    );
    //Retreive ETH Blockchain Balances
    const ethETHAddresses = tokenAddresses['ETH']['ETH'] as string[];
    if ( ethETHAddresses !== undefined) {
        for (const address of ethETHAddresses){
            tokenBalances.balances[0] = tokenBalances.balances[0].add(await getETHBalance(ETHNetworkURL, address));
        }
    }

    const ethUSDCAddresses = tokenAddresses['ETH']['USDC'] as string[];
    if ( ethUSDCAddresses !== undefined){
        for (const address of ethUSDCAddresses){
            tokenBalances.balances[2] = tokenBalances.balances[2].add(await getUSDCBalance(ETHNetworkURL, USDCETHAddress, address));
        }
    }
    //Retrieve POLYGON Balances
    const polygonETHAddresses = tokenAddresses['POLYGON']['MATIC'] as string[];
    if ( polygonETHAddresses !== undefined){
        for (const address of polygonETHAddresses){
            tokenBalances.balances[1] = tokenBalances.balances[1].add(await getETHBalance(PolygonNetworkURL, address));
        }
    }

    const polygonUSDCAddresses = tokenAddresses['POLYGON']['USDC'] as string[];
    if ( polygonUSDCAddresses !== undefined){
        for (const address of polygonUSDCAddresses){
            tokenBalances.balances[2] = tokenBalances.balances[2].add(await getUSDCBalance(PolygonNetworkURL, USDCPolygonAddress, address));
        }
    }

    //Set BTC to 1000 (for debugging purpose)
    tokenBalances.balances[3] = Field(1000);

    return tokenBalances;
}

(async function InitMina() {
    console.log('Initializing...');
    await isReady;
    console.log('SnarkJS Loaded');
    
    oraclePrivateKey = PrivateKey.fromBase58(getEnv('ORACLE_PRIVATE_KEY', ''));
    zkAppPublicKey = PublicKey.fromBase58(getEnv('ZKAPP_PUBLIC_KEY', ''));
    zkApp = new Ledger(zkAppPublicKey);

    // compile the contract to create prover keys
    console.log('Compiling the contract...');
    await Ledger.compile();

    const Berkeley = Mina.Network(
        NetworkURL
      );
    Mina.setActiveInstance(Berkeley);

    console.log('Done');
})();

app.get('/', async (req, res) => {
    const oracleBalances = await retreiveBalances(TokenReservesFileName);
    res.json(oracleBalances.display());
})

app.put('/update', async (req, res) => {
    const oracleBalances = await retreiveBalances(TokenReservesFileName);

    try {        
        await fetchAccount({ publicKey: zkAppPublicKey });
        if (!zkApp.oracleBalancesHash.get().equals(oracleBalances.hash()).toBoolean()){
            console.log("Building transaction and create proof for updating oracle balances");
            const signature = Signature.create(oraclePrivateKey, oracleBalances.balances);

            await makeAndSendTransaction({
                feePayerPrivateKey: oraclePrivateKey,
                zkAppPublicKey: zkAppPublicKey,
                mutateZkApp: () =>  zkApp.updateOracleBalance(oracleBalances, signature),
                transactionFee: transactionFee,
                getState: () => zkApp.oracleBalancesHash.get(),
                statesEqual: (num1, num2) => num1.equals(num2).toBoolean()
            });
        }

        await axios.put(ServerURL + '/oraclebalances', 
                        JSON.stringify(oracleBalances.display()),  
                        { headers: {
                                    'Content-Type': 'application/json'
                                    },
                        });

        res.json(oracleBalances.display());
    } catch (e){
        res.json({'Error': e});
        console.log(e)
    }
})


app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});