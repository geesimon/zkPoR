import {
    Field,
    Poseidon,
    Struct,
    Circuit,
    MerkleMap,
    PublicKey,
    Signature,
} from 'snarkyjs';

export const TokenNames = ['ETH', 'MATIC', 'USDC', 'BTC'];
export const NumberOfTokens = TokenNames.length;

export type AccountMap = Map<number, Account>;

export class Account extends Struct({
    id: Field,
    balances: Circuit.array(Field, NumberOfTokens)    
  }) {
    static from(id: number, balances: number[]) {
      return new Account({ id: Field(id), balances: balances.map(Field)});
    }
  
    hash() {
      return Poseidon.hash([this.id, this.balances].flat());
    }

    display(){
        let result :{[index: string]: string;} = {
            'UserID': this.id.toString(),
        };

        this.balances.forEach((v, i) =>{
            result[TokenNames[i]] = v.toString(); 
        });

        return result;
    }
}

export class TotalAccountBalance extends Struct({
    balances: Circuit.array(Field, NumberOfTokens)    
}){
    constructor(balances?: Field[]) {
        if (typeof balances !== 'undefined') {
            super({balances: balances.map(Field)});
        } else {
            super({balances: Array(NumberOfTokens).fill(0).map(Field)});
        }
    }

    add(account: Account, checkConstraint = true){
        let newBalances = new TotalAccountBalance();
                
        account.balances.forEach((v, i) =>{
            newBalances.balances[i] = this.balances[i].add(v);
            if (checkConstraint){
                newBalances.balances[i].assertGte(this.balances[i]); //overflow check
            }
        })

        return newBalances;
    };

    sub(account: Account, checkConstraint = true){
        let newBalances = new TotalAccountBalance();

        account.balances.forEach((v, i) =>{
            if (checkConstraint) {
                this.balances[i].assertGte(v);
            }
            newBalances.balances[i] = this.balances[i].sub(v);
            if (checkConstraint){
                newBalances.balances[i].assertLte(this.balances[i]); //overflow check
            }            
        })

        return newBalances;
    };

    hash() {
        return Poseidon.hash(this.balances);
    }

    display() {
        let result :{[index: string]: string;} = {};

        this.balances.forEach((v, i) =>{
            result[TokenNames[i]] = v.toString(); 
        });

        return result;
    }
}

export class OracleBalance extends Struct({
    balances: Circuit.array(Field, NumberOfTokens)    
}){
    constructor(balances?: Field[]) {
        if (typeof balances !== 'undefined') {
            super({balances: balances.map(Field)});
        } else {
            super({balances: Array(NumberOfTokens).fill(0).map(Field)});
        }
    }

    verify(publicKey: PublicKey, signature: Signature){
        return signature.verify(publicKey, this.balances);
    }

    hash() {
        return Poseidon.hash(this.balances);
    }
    
    display() {
        let result :{[index: string]: string;} = {};

        this.balances.forEach((v, i) =>{
            result[TokenNames[i]] = v.toString(); 
        });

        return result;
    }
}

export function calcTotalBalance(accounts: AccountMap) {
    let totalBalance = new TotalAccountBalance();

    accounts.forEach(account =>{
        totalBalance = totalBalance.add(account, false);
    });

    return totalBalance;
}


export function buildAccountMerkleTree(accounts: AccountMap) {
    let tree = new MerkleMap();

    accounts.forEach(account =>{
        tree.set(account.id, account.hash());
    })

    return tree;
}