import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { ChangeEventHandler, useEffect, useState } from 'react';
import {
  isReady,
  PublicKey,
  fetchAccount,
  setGraphqlEndpoint,
  MerkleMapWitness,
  Field,
} from 'snarkyjs';
import { Ledger } from './Ledger';
import {Account, TokenNames} from './Ledger-lib';

const NetworkURL= 'https://proxy.berkeley.minaexplorer.com/graphql'
const zkAppAddress = 'B62qkxEUpZptriUW45cdxurMy8VTs1U9LoiZiZe3WRsHLSCho6AhLbv';


export default function Home() {
  const [status, setStatus] = useState({
    accountTreeRoot: '',
    merklePath:''
  });

  useEffect(() => {
    (async () => {
      await isReady;
      // const { Ledger } = await import('../../contracts/build/src/Ledger');      

      if (!zkAppAddress) {
        console.error(
          'The following error is caused because the zkAppAddress has an empty string as the public key. Update the zkAppAddress with the public key for your zkApp account, or try this address for an example "Add" smart contract that we deployed to Berkeley Testnet: B62qqkb7hD1We6gEfrcqosKt9C398VLp1WXeTo1i9boPoqF7B1LxHg4'
        );
      }
      
      setGraphqlEndpoint(NetworkURL);
      const zkApp = new Ledger(PublicKey.fromBase58(zkAppAddress));
      await fetchAccount({publicKey:zkAppAddress});

      setStatus(prev => {
        return {
          ...prev,
          accountTreeRoot: zkApp.accountTreeRoot.get().toString(),
        }
      })

      })();
    }, []);

  const handleVerification = async() =>{
    // const {Account, TokenNames} = await import('../../contracts/build/src/Ledger-lib');
    const json = JSON.parse(status.merklePath)
    
    const accountJson = json['Account'];    
    let accountBalances : Field[] = [];
    TokenNames.forEach((v, i) =>{
      accountBalances.push(Field(accountJson[v]));
    });
    console.log(accountBalances);
    console.log(accountJson['UserID']);
    const account = new Account({id: Field(accountJson['UserID']), balances: accountBalances})
    const accountHash = account.hash();
    console.log('Account hash', accountHash.toString());

    const merklePathJson = json['MerklePath'];
    console.log(merklePathJson);
    const withness = MerkleMapWitness.fromJSON(merklePathJson);
    const MerkleRoot = withness.computeRootAndKey(accountHash);

    console.log('Merkle Path Root', MerkleRoot[0].toString());
    console.log('Contract Account Root:', status.accountTreeRoot);

    if (MerkleRoot[0].equals(Field(status.accountTreeRoot)).toBoolean()){
      confirm('Congratulations! Your accout is safe and verified');
    } else {
      alert('Oops!\nCan\'t find the account specified');
    }
  }

  const handleChange:ChangeEventHandler = (event) =>{
    setStatus(prev => {
      return {
        ...prev,
        merklePath: (event.target as HTMLInputElement).value
      }
    })
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Account Inclusion Verification</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <p className={styles.description}>
          <label>
            Copy & Paste Account Merkel Path<br/>
            <textarea rows={50} cols ={80} onChange = {handleChange}/>
          </label>
          <br/>
          <button className={styles.large} onClick={handleVerification}>Verify</button>
        </p>
      </main>
    </div>
  );
}

