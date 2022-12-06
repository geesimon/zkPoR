import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
} from 'snarkyjs';
import {Ledger} from './Ledger';
import {loadAccounts, Account, AccountMap} from './Ledger-lib'

const proofsEnabled = false;
const accountFileName = "./accounts.json";

describe('Ledger', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Ledger,
    accounts: AccountMap;

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
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  async function initAccounts() {
    const accounts = await loadAccounts(accountFileName);

    console.log("id:", accounts[1000].id.toString());
    console.log("balance_0", accounts[1000].balances[0].toString());
  }

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Add` smart contract', async () => {
    await localDeploy();
    // const num = zkApp.num.get();
    // expect(num).toEqual(Field(1));
  });

  it('correctly updates the num state on the `Add` smart contract', async () => {
    await localDeploy();

    // update transaction
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.updateAccount();
    });
    await txn.prove();
    await txn.send();

    // const updatedNum = zkApp.num.get();
    // expect(updatedNum).toEqual(Field(3));
  });
});
