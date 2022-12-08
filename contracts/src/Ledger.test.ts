import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  MerkleMapWitness,
} from 'snarkyjs';
import {Ledger} from './Ledger';
import {
    loadAccounts, 
    Account, 
    AccountMap, 
    TotalAccountBalances,
    calcTotalBalances,
    buildAccountMerkleTree} from './Ledger-lib'

const proofsEnabled = false;
const accountFileName = "../test-accounts.json";

describe('Ledger', () => {
  let deployerAccount: PrivateKey,
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
    await initAccounts();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    deployerAccount = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Ledger(zkAppAddress);
  });

  afterAll(() => {
    setTimeout(shutdown, 0);
  });

  async function initAccounts() {
    allAccounts = await loadAccounts(accountFileName);

    totalBalances = calcTotalBalances(allAccounts);
    // console.log("total_balance_1:", totalBalances.balances[0].toString());
    // console.log("total_balance_4:", totalBalances.balances[3].toString());
    // console.log("hash:", totalBalances.hash().toString());

    accountTree = buildAccountMerkleTree(allAccounts);
    // console.log("Merkel root:", accountTree.getRoot().toString());
    testAccountId = allAccounts.keys().next().value;
  }

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
      zkApp.initState(accountTree.getRoot(), totalBalances.hash(), zkAppAddress,Field(0));
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Ledger` smart contract', async () => {
    await localDeploy();

    const root = zkApp.accountTreeRoot.get();
    expect(root).toEqual(accountTree.getRoot());
  });

  it('correctly add new account on the `Ledger` smart contract', async () => {
    await localDeploy();

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

  it('correctly updated the account state and balances to `Ledger` smart contract', async () => {
    await localDeploy();

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

  it('correctly verify good account and invalid account on the `Ledger` smart contract', async () => {
    await localDeploy();

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
});
