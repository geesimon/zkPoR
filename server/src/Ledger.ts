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
import {Account, TotalAccountBalances, OracleBalances } from './Ledger-lib.js';


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
                        totalAccountBalances: TotalAccountBalances,
                        oracleBalances: OracleBalances
                        ) {
        // Add account
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        const newRoot = path.computeRootAndKey(account.hash())[0];
        this.accountTreeRoot.set(newRoot);

        // Update balance
        const currentBalancesHash = this.totalBalancesHash.get();
        this.totalBalancesHash.assertEquals(currentBalancesHash);
        this.totalBalancesHash.assertEquals(totalAccountBalances.hash());

        const newBalances =  totalAccountBalances.add(account);
        this.totalBalancesHash.set(newBalances.hash());
        
        this.checkBalances(oracleBalances, totalAccountBalances);
    }

    @method updateAccount(
                            oldAcount: Account,
                            oldPath: MerkleMapWitness,
                            updatedAccount: Account,
                            totalAccountBalances: TotalAccountBalances,
                            oracleBalances: OracleBalances
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
        this.totalBalancesHash.assertEquals(totalAccountBalances.hash());

        let newBalances = totalAccountBalances.sub(oldAcount).add(updatedAccount);
        
        this.totalBalancesHash.set(newBalances.hash());

        this.checkBalances(oracleBalances, totalAccountBalances);
    }

    @method verifyAccount(account: Account, path: MerkleMapWitness) {
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        let [root, key] = path.computeRootAndKey(account.hash())

        account.id.assertEquals(key, 'Invalid Account Id');
        root.assertEquals(currentRoot, 'Invalid Merkel Root');
    }

    @method updateOracleBalance(oracleBalances: OracleBalances, signature: Signature) {
        const oraclePublicKey = this.oraclePublicKey.get();
        this.oraclePublicKey.assertEquals(oraclePublicKey);

        const validSignature = oracleBalances.verify(oraclePublicKey, signature);
        validSignature.assertTrue('Bad Signature');

        this.oracleBalancesHash.set(oracleBalances.hash());
    }

    // Check Oracle balance constraint
    checkBalances(oracleBalances: OracleBalances, totalAccountBalances: TotalAccountBalances){
       //Check account balances are less than oracle balances
       const oracleBalancesHash = this.oracleBalancesHash.get();
       this.oracleBalancesHash.assertEquals(oracleBalancesHash);
       this.oracleBalancesHash.assertEquals(oracleBalances.hash());

       oracleBalances.balances.forEach((_, i) => {
           oracleBalances.balances[i].assertGte(totalAccountBalances.balances[i], 'Account Value Exceed Oracle Value:' );
       })        
    }
}