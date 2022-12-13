import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Signature,
} from 'snarkyjs';
import {Ledger} from './Ledger';
import {
    Account,
    AccountMap, 
    TotalAccountBalance,
    calcTotalBalance,
    buildAccountMerkleTree,
    OracleBalance} from './Ledger-lib';
import {loadAccounts} from './account-utils';

const proofsEnabled = false;
const accountFileName = "../test-accounts.json";

describe('Ledger', () => {
  let deployerAccount: PrivateKey,
    oracleAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,    
    zkApp: Ledger,
    allAccounts: AccountMap,
    totalBalances: TotalAccountBalance,
    oracleBalances: OracleBalance,
    accountTree: MerkleMap,
    testAccountId: number;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) Ledger.compile();

    //Load saved account data
    allAccounts = await loadAccounts(accountFileName);
    totalBalances = calcTotalBalance(allAccounts);
    accountTree = buildAccountMerkleTree(allAccounts);    
    testAccountId = allAccounts.keys().next().value;

    oracleBalances = new OracleBalance(totalBalances.balances);
    //Set oracle balance as doule of account balance
    oracleBalances.balances.forEach((_, i) =>{
      oracleBalances.balances[i] = oracleBalances.balances[i].mul(2);  
    });
    //Prepare Mina block chain
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    deployerAccount = Local.testAccounts[0].privateKey;
    oracleAccount = Local.testAccounts[Local.testAccounts.length - 1].privateKey;

    //Create zkApp keys
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Ledger(zkAppAddress);

    await localDeploy();
  });

  beforeEach(() => {
  });

  afterAll(() => {
    setTimeout(shutdown, 0);
  });

  async function localDeploy() {
    let txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({zkappKey: zkAppPrivateKey});
      zkApp.initState(accountTree.getRoot(), totalBalances.hash(), oracleAccount.toPublicKey(), oracleBalances.hash());
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([zkAppPrivateKey]).send();
  }

  it('deploys and initializes the `Ledger` smart contract', async () => {
    expect(zkApp.accountTreeRoot.get()).toEqual(accountTree.getRoot());
    expect(zkApp.totalBalancesHash.get()).toEqual(totalBalances.hash());
    expect(zkApp.oraclePublicKey.get()).toEqual(oracleAccount.toPublicKey());   

    // //Should only init once
    // const txn = await Mina.transaction(deployerAccount, () => {
    //   zkApp.initState(accountTree.getRoot(), totalBalances.hash(), zkAppAddress,Field(0));
    // });
    // await txn.prove();
    // await txn.send();

    // // await expect(async () => {
    // //   const txn = await Mina.transaction(deployerAccount, () => {
    // //     zkApp.initState(accountTree.getRoot(), totalBalances.hash(), zkAppAddress,Field(0));
    // //   });

    // //   await txn.prove();
    // //   await txn.send();
    // // }).rejects.toThrow(/Once/);
  });

  it('adds new account', async () => {
    const newAccountId = testAccountId * 100;
    const newAccount = Account.from(newAccountId, [100, 100, 100, 10]);
    accountTree.set(Field(newAccountId), newAccount.hash());
    allAccounts.set(newAccountId, newAccount);

    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addAccount( newAccount, 
                        accountTree.getWitness(Field(newAccountId)), 
                        totalBalances, 
                        oracleBalances );
    });
    await txn.prove();
    await txn.send();

    totalBalances = totalBalances.add(newAccount, false);

    const newRoot = zkApp.accountTreeRoot.get();
    expect(newRoot).toEqual(accountTree.getRoot());
  });

  it('updateds the account state and balances', async () => {
    const oldAccount = allAccounts.get(testAccountId);
    const updatedAccount = Account.from(testAccountId, [100, 100, 100, 0]);
    allAccounts.set(testAccountId, updatedAccount);

    accountTree.set(Field(testAccountId), updatedAccount.hash());

    // update transaction
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateAccount( oldAccount!,
                            accountTree.getWitness(Field(testAccountId)), 
                            updatedAccount,
                            totalBalances,
                            oracleBalances);
    });
    await txn.prove();
    await txn.send();

    totalBalances = totalBalances.sub(oldAccount!, false).add(updatedAccount, false);
    const newBalances = calcTotalBalance(allAccounts);
    expect(newBalances.hash()).toEqual(totalBalances.hash());

    const newAccoutTreeRoot = zkApp.accountTreeRoot.get();
    expect(newAccoutTreeRoot).toEqual(accountTree.getRoot());

    const newTotalBalancesHash = zkApp.totalBalancesHash.get();    
    expect(newTotalBalancesHash).toEqual(totalBalances.hash());    
  });

  it('verifies good account and invalid account', async () => {
    const account = allAccounts.get(testAccountId);
    const path = accountTree.getWitness(account!.id);

    // happy path
    let txn = await Mina.transaction(deployerAccount, () => {
      zkApp.verifyAccount(account!, path);
    });
    await txn.prove();
    await txn.send();

    //invalidate account id
    const testAccount = allAccounts.get(testAccountId);
    const badIdAccount = Account.from(testAccountId + 1, testAccount!.balances.map(n => Number(n.toString())));
    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.verifyAccount(badIdAccount, path);
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Id/);

    //invalidate path
    let badPath = accountTree.getWitness(account!.id);
    badPath.siblings[0] = badPath.siblings[0].add(1);
    
    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.verifyAccount(account!, badPath);
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Root/);    
  });

  it('takes and verifies oracle balances update', async () => {
    const newOracleBalances = new OracleBalance();

    newOracleBalances.balances.forEach((_, i) => {
      newOracleBalances.balances[i] = oracleBalances.balances[i].add(10);
    });

    const signature = Signature.create(oracleAccount, newOracleBalances.balances);

    let txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateOracleBalance(newOracleBalances, signature);
    });
    await txn.prove();
    await txn.send();

    expect(zkApp.oracleBalancesHash.get()).toEqual(newOracleBalances.hash());

    //Should reject bad signature
    const badSignature = Signature.create(deployerAccount, newOracleBalances.balances);

    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.updateOracleBalance(newOracleBalances, badSignature);
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Signature/);
  });

  it('prevents from adding or updating account if balances exceed oracle balances', async () => {
    const newOracleBalances = new OracleBalance();

    const signature = Signature.create(oracleAccount, newOracleBalances.balances);

    let txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateOracleBalance(newOracleBalances, signature);
    });
    await txn.prove();
    await txn.send();

    const newAccountId = testAccountId * 1000;
    const newAccount = Account.from(newAccountId, [100, 100, 100, 10]);
    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.addAccount( newAccount, 
          accountTree.getWitness(Field(newAccountId)), 
          totalBalances, 
          newOracleBalances );
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Exceed/);

    const oldAccount = allAccounts.get(testAccountId);
    const updatedAccount = Account.from(testAccountId, [100, 100, 100, 0]);
    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.updateAccount( oldAccount!,
          accountTree.getWitness(Field(testAccountId)), 
          updatedAccount,
          totalBalances,
          newOracleBalances);
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Exceed/);
  })
});
