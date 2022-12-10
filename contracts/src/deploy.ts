import {
    isReady,
    shutdown,
    Mina,
    PrivateKey,
    AccountUpdate,
    VerificationKey
} from 'snarkyjs';
import {
    Ledger
} from './Ledger.js';
import dotenv from 'dotenv';

dotenv.config();

function getEnv(name:string, defaultValue:any) {
    return (typeof process.env[name] === 'undefined') ? defaultValue : process.env[name];
}

(async function main() {
    await isReady;

    console.log('SnarkyJS loaded');

    // ----------------------------------------------------
    const NetworkUrl = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
    const Berkeley = Mina.Network(NetworkUrl);
    Mina.setActiveInstance(Berkeley);

    let transactionFee = 100_000_000;

    const deployerPrivateKey = PrivateKey.fromBase58(getEnv('DEPLOYER_PRIVATE_KEY', ''));
    const zkAppPrivateKey = PrivateKey.fromBase58(getEnv('ZKAPP_PRIVATE_KEY', ''));
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

    console.log('Compiling smart contract...');
    let { verificationKey } = await Ledger.compile();
    let zkapp = new Ledger(zkAppPublicKey);

    console.log('Deploying zkapp for public key', zkAppPublicKey.toBase58());

    let transaction = await Mina.transaction(
            { feePayerKey: deployerPrivateKey, fee: transactionFee },
            () => {
                // AccountUpdate.fundNewAccount(deployerPrivateKey);  //Only needed for creating new account
                zkapp.deploy({ zkappKey: zkAppPrivateKey, verificationKey });
            }
        );

    console.log('Sending the deploy transaction...');
    const res = await transaction.sign().send();
    const hash = await res.hash();
    if (hash == null) {
        console.log('error sending transaction (see above)');
    } else {
        console.log(
            'See deploy transaction at',
            'https://berkeley.minaexplorer.com/transaction/' + hash
        );
    }

    console.log('Shutting down');
    await shutdown();
})().catch((e) => console.log(e));