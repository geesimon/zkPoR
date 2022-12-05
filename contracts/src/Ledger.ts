import {
    SmartContract,
    Field,
    state,
    State,
    method,
    PublicKey,
  } from 'snarkyjs';


export class Ledger extends SmartContract {    
    @state(Field) balanceRoot = State<Field>();
    @state(Field) accountRoot = State<Field>();
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) oracleBalance = State<Field>();
  
    // deploy(args: DeployArgs) {
    //     super.deploy(args);
    //     this.setPermissions({
    //       ...Permissions.default(),
    //       editState: Permissions.proofOrSignature(),
    //     });
    // }

    @method initState(
            balanceRoot: Field,
            accountRoot: Field,
            oraclePublicKey: PublicKey,
            oracleBalance: Field
            ) {        
        this.balanceRoot.set(balanceRoot);
        this.accountRoot.set(accountRoot);
        this.oraclePublicKey.set(oraclePublicKey);
        this.oracleBalance.set(oracleBalance);
    }
    
    @method updateAccount() {

    }

    @method updateOracleBalance() {

    }
}