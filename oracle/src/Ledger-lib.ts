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

export class TotalAccountBalances extends Struct({
    balances: Circuit.array(Field, NumberOfTokens)    
}){
    constructor(balances?: Field[]) {
        if (typeof balances !== 'undefined') {
            super({balances: balances.map(Field)});
        } else {
            super({balances: Array(NumberOfTokens).fill(0).map(Field)});
        }
    }

    add(account: Account){
        let newBalances = new TotalAccountBalances();
                
        account.balances.forEach((v, i) =>{
            newBalances.balances[i] = this.balances[i].add(v);
        })

        return newBalances;
    };

    sub(account: Account, checkConstraint = true){
        let newBalances = new TotalAccountBalances();

        account.balances.forEach((v, i) =>{
            if (checkConstraint) {
                this.balances[i].assertGte(v);
            }
            newBalances.balances[i] = this.balances[i].sub(v);
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

export class OracleBalances extends Struct({
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

export function calcTotalBalances(accounts: AccountMap) {
    let totalBalances = new TotalAccountBalances();

    accounts.forEach(account =>{
        totalBalances = totalBalances.add(account);
    });

    return totalBalances;
}


export function buildAccountMerkleTree(accounts: AccountMap) {
    let tree = new MerkleMap();

    accounts.forEach(account =>{
        tree.set(account.id, account.hash());
    })

    return tree;
}