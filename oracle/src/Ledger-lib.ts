import fs from 'fs/promises';
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

type AccountBalance = {
    [index: string]: number;
    id: number;
    ETH: number;
    MATIC: number;
    USDC: number;
    BTC: number;    
    USDT: number;
    BNB: number;
    BUSD: number;
    XRP: number;
    DOGE: number;
    ADA: number;    
};

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

export async function loadAccounts(fileName: string): Promise<AccountMap> {
    const savedAccounts = JSON.parse(await fs.readFile(fileName, 'utf8'));
    let balances : number[] = Array(NumberOfTokens).fill(0);

    return savedAccounts.reduce(function(map:AccountMap, account:AccountBalance) {
        TokenNames.forEach((v, i) =>{
            balances[i] = account[v];
        });
        
        map.set(account.id, Account.from(account.id, balances));
        return map;
    }, new Map<number, Account>());
}

export function calcTotalBalances(accounts: AccountMap) {
    let totalBalances = new TotalAccountBalances();

    accounts.forEach(account =>{
        totalBalances = totalBalances.add(account);
    });

    return totalBalances;
}

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

export function generateRandomAccounts(amount: number){
    const MaxToken = 10e10;

    return Array(amount).fill(0).map((_, i) => {
        return {
            id: 1000 + i,
            ETH: getRandomInt(MaxToken),
            MATIC: getRandomInt(MaxToken),
            USDC: getRandomInt(MaxToken),
            BTC: 1,
        }
    });
}

export async function generateRandomAccountsFile(fileName: string, amount: number) {
    const accounts = generateRandomAccounts(amount);

    await fs.writeFile(fileName, JSON.stringify(accounts));
}

export function buildAccountMerkleTree(accounts: AccountMap) {
    let tree = new MerkleMap();

    accounts.forEach(account =>{
        tree.set(account.id, account.hash());
    })

    return tree;
}