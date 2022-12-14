import {
    SmartContract,
    DeployArgs,
    Permissions,
    Field,
    state,
    State,
    method,
    PublicKey,
    MerkleMapWitness,
    Signature,
  } from 'snarkyjs';
import {Account, TotalAccountBalance, OracleBalance } from './Ledger-lib';


export class Ledger extends SmartContract {        
    @state(Field) accountTreeRoot = State<Field>();
    @state(Field) totalBalancesHash = State<Field>();
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) oracleBalancesHash = State<Field>();
  
    deploy(args: DeployArgs) {
        super.deploy(args);
        this.setPermissions({
          ...Permissions.default(),
          editState: Permissions.proofOrSignature(),
        });
    }

    @method initState(
            accountTreeRoot: Field,
            totalBalancesHash: Field,            
            oraclePublicKey: PublicKey,
            oracleBalancesHash: Field
            ) {
        this.accountTreeRoot.set(accountTreeRoot);
        this.totalBalancesHash.set(totalBalancesHash);
        this.oraclePublicKey.set(oraclePublicKey);
        this.oracleBalancesHash.set(oracleBalancesHash);
    }
    
    @method addAccount(
                        account: Account, 
                        path: MerkleMapWitness,
                        totalAccountBalance: TotalAccountBalance,
                        oracleBalance: OracleBalance
                        ) {
        // Add account
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        const newRoot = path.computeRootAndKey(account.hash())[0];
        this.accountTreeRoot.set(newRoot);

        // Update balance
        const currentBalancesHash = this.totalBalancesHash.get();
        this.totalBalancesHash.assertEquals(currentBalancesHash);
        this.totalBalancesHash.assertEquals(totalAccountBalance.hash());

        const newBalances =  totalAccountBalance.add(account);
        this.totalBalancesHash.set(newBalances.hash());
        
        this.checkBalance(oracleBalance, totalAccountBalance);
    }

    @method updateAccount(
                            oldAcount: Account,
                            oldPath: MerkleMapWitness,
                            updatedAccount: Account,
                            totalAccountBalance: TotalAccountBalance,
                            oracleBalance: OracleBalance
                        ) {
        //Account id must be the same
        oldAcount.id.assertEquals(updatedAccount.id);

        //Update merkle root
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);
        
        oldPath.computeRootAndKey(oldAcount.hash())[0].assertEquals(currentRoot);
        
        const newRoot = oldPath.computeRootAndKey(updatedAccount.hash())[0];
        this.accountTreeRoot.set(newRoot);

        //Update total balances
        const currentBalancesHash = this.totalBalancesHash.get();
        this.totalBalancesHash.assertEquals(currentBalancesHash);
        this.totalBalancesHash.assertEquals(totalAccountBalance.hash());

        let newBalances = totalAccountBalance.sub(oldAcount).add(updatedAccount);
        
        this.totalBalancesHash.set(newBalances.hash());

        this.checkBalance(oracleBalance, totalAccountBalance);
    }

    @method verifyAccount(account: Account, path: MerkleMapWitness) {
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        let [root, key] = path.computeRootAndKey(account.hash())

        account.id.assertEquals(key, 'Invalid Account Id');
        root.assertEquals(currentRoot, 'Invalid Merkel Root');
    }

    @method updateOracleBalance(oracleBalance: OracleBalance, signature: Signature) {
        const oraclePublicKey = this.oraclePublicKey.get();
        this.oraclePublicKey.assertEquals(oraclePublicKey);

        const validSignature = oracleBalance.verify(oraclePublicKey, signature);
        validSignature.assertTrue('Bad Signature');

        this.oracleBalancesHash.set(oracleBalance.hash());
    }

    // Check Oracle balance constraint
    checkBalance(oracleBalance: OracleBalance, totalAccountBalance: TotalAccountBalance){
       //Check account balances are less than oracle balances
       const oracleBalancesHash = this.oracleBalancesHash.get();
       this.oracleBalancesHash.assertEquals(oracleBalancesHash);
       this.oracleBalancesHash.assertEquals(oracleBalance.hash());

       oracleBalance.balances.forEach((_, i) => {
           oracleBalance.balances[i].assertGte(totalAccountBalance.balances[i], 'Account Value Exceed Oracle Value:' );
       })        
    }
}