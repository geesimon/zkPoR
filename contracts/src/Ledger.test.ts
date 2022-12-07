import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
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

  // it('correctly updateds the account state and balances to `Ledger` smart contract', async () => {
  //   await localDeploy();

  //   const oldAccount = allAccounts.get(testAccountId);
  //   const updatedAccount = Account.from(testAccountId, [100, 100, 100, 10]);
  //   allAccounts.set(testAccountId, updatedAccount);

  //   accountTree.set(Field(testAccountId), updatedAccount.hash());

  //   // update transaction
  //   const txn = await Mina.transaction(deployerAccount, () => {
  //     const app = new Ledger(zkAppAddress);
  //     // const newTotalBalances = app.updateAccount( oldAccount!,
  //     //                                               accountTree.getWitness(Field(testAccountId)), 
  //     //                                               newAccount, 
  //     //                                               totalBalances);
  //   });
  //   await txn.prove();
  //   await txn.send();

  //   const newRoot = zkApp.accountTreeRoot.get();
  //   console.log(newRoot);
  //   // expect(newRoot).toEqual(accountTree.getRoot());
  // });

  it('correctly add new account on the `Ledger` smart contract', async () => {
    await localDeploy();

    const newAccountId = testAccountId * 100;
    const newAccount = Account.from(newAccountId, [100, 100, 100, 10]);
    accountTree.set(Field(newAccountId), newAccount.hash());
    allAccounts.set(newAccountId, newAccount);   

    console.log("old root:", zkApp.accountTreeRoot.get().toString());
    console.log("Balance hash:", totalBalances.hash().toString());
    console.log("Contract Balance hash:", zkApp.totalBalancesHash.get().toString());

    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addAccount(newAccount, accountTree.getWitness(Field(newAccountId)), totalBalances);
    });
    await txn.prove();
    await txn.send();

    // totalBalances.add(newAccount);
    console.log("new root:", zkApp.accountTreeRoot.get().toString());
    console.log("New contract balance hash:", zkApp.totalBalancesHash.get().toString());
    console.log("Balance hash:", zkApp.totalBalancesHash.get().toString());

    const newRoot = zkApp.accountTreeRoot.get();
    expect(newRoot).toEqual(accountTree.getRoot());
  });
});
