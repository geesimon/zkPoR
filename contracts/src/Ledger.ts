import {
    SmartContract,
    Field,
    state,
    State,
    method,
    PublicKey,
    MerkleMapWitness,
    Poseidon
  } from 'snarkyjs';
import {Account, TotalAccountBalances } from './Ledger-lib';


export class Ledger extends SmartContract {        
    @state(Field) accountTreeRoot = State<Field>();
    @state(Field) totalBalancesHash = State<Field>();
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) oracleBalancesHash = State<Field>();
  
    // deploy(args: DeployArgs) {
    //     super.deploy(args);
    //     this.setPermissions({
    //       ...Permissions.default(),
    //       editState: Permissions.proofOrSignature(),
    //     });
    // }

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
                        totalBalances: TotalAccountBalances
                        ) {
        // Add account
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        const newRoot = path.computeRootAndKey(account.hash())[0];
        this.accountTreeRoot.set(newRoot);

        // Update balance
        const currentBalancesHash = this.totalBalancesHash.get();
        this.totalBalancesHash.assertEquals(currentBalancesHash);
        this.totalBalancesHash.assertEquals(totalBalances.hash());

        const newBalances =  totalBalances.add(account);
        this.totalBalancesHash.set(newBalances.hash());
    }

    @method updateAccount(
                            oldAcount: Account,
                            oldPath: MerkleMapWitness,
                            newAccount: Account,
                            totalBalances: TotalAccountBalances
                        ) {
        //Account id must be the same
        oldAcount.id.assertEquals(newAccount.id);

        //Update merkle root
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);
        
        oldPath.computeRootAndKey(oldAcount.hash())[0].assertEquals(currentRoot);
        
        const newRoot = oldPath.computeRootAndKey(newAccount.hash())[0];
        this.accountTreeRoot.set(newRoot);

        //Update total balances
        const currentBalancesHash = this.totalBalancesHash.get();
        this.totalBalancesHash.assertEquals(currentBalancesHash);
        this.totalBalancesHash.assertEquals(totalBalances.hash());

        let newBalances = totalBalances.sub(oldAcount).add(newAccount);
        
        this.totalBalancesHash.set(newBalances.hash());
    }

    @method verifyAccount(account: Account, path: MerkleMapWitness) {
        const currentRoot = this.accountTreeRoot.get();
        this.accountTreeRoot.assertEquals(currentRoot);

        let [root, key] = path.computeRootAndKey(account.hash())

        account.id.assertEquals(key, 'Invalid Account Id');
        root.assertEquals(currentRoot, 'Invalid Merkel Root');
    }

    @method updateOracleBalance() {

    }
}