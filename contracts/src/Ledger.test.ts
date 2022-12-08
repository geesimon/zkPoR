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
    loadAccounts, 
    Account, 
    AccountMap, 
    TotalAccountBalances,
    calcTotalBalances,
    buildAccountMerkleTree,
    OracleBalances} from './Ledger-lib'

const proofsEnabled = false;
const accountFileName = "../test-accounts.json";

describe('Ledger', () => {
  let deployerAccount: PrivateKey,
    oracleAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,    
    zkApp: Ledger,
    allAccounts: AccountMap,
    totalBalances: TotalAccountBalances,
    accountTree: MerkleMap,
    testAccountId: number;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) Ledger.compile();

    //Load saved account data
    allAccounts = await loadAccounts(accountFileName);
    totalBalances = calcTotalBalances(allAccounts);
    accountTree = buildAccountMerkleTree(allAccounts);    
    testAccountId = allAccounts.keys().next().value;

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
      zkApp.deploy();
      zkApp.initState(accountTree.getRoot(), totalBalances.hash(), oracleAccount.toPublicKey(), Field(0));
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
      zkApp.addAccount(newAccount, accountTree.getWitness(Field(newAccountId)), totalBalances);
    });
    await txn.prove();
    await txn.send();

    totalBalances = totalBalances.add(newAccount);

    const newRoot = zkApp.accountTreeRoot.get();
    expect(newRoot).toEqual(accountTree.getRoot());
  });

  it('updateds the account state and balances', async () => {
    const oldAccount = allAccounts.get(testAccountId);
    const updatedAccount = Account.from(testAccountId, [100, 100, 100, 10]);
    allAccounts.set(testAccountId, updatedAccount);

    accountTree.set(Field(testAccountId), updatedAccount.hash());

    // update transaction
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateAccount( oldAccount!,
                            accountTree.getWitness(Field(testAccountId)), 
                            updatedAccount,
                                                    totalBalances);
    });
    await txn.prove();
    await txn.send();

    totalBalances = totalBalances.sub(oldAccount!).add(updatedAccount);
    const newBalances = calcTotalBalances(allAccounts);
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
    const badIdAccount = allAccounts.get(testAccountId);
    badIdAccount!.id = badIdAccount!.id.add(1);
    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.verifyAccount(badIdAccount!, path);
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
    const oracleBalances = new OracleBalances();
    oracleBalances.balances.forEach((_, i) => {
      oracleBalances.balances[i] = totalBalances.balances[i].add(10);
    });

    const signature = Signature.create(oracleAccount, oracleBalances.balances);

    let txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateOracleBalance(oracleBalances, signature);
    });
    await txn.prove();
    await txn.send();

    expect(zkApp.oracleBalancesHash.get()).toEqual(oracleBalances.hash());

    //Should reject bad signature
    const badSignature = Signature.create(deployerAccount, oracleBalances.balances);

    await expect(async () => {
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.updateOracleBalance(oracleBalances, badSignature);
      });
      await txn.prove();
      await txn.send();
    }).rejects.toThrow(/Signature/);
  });
});
