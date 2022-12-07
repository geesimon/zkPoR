import fs from 'fs/promises';
import {
    Field,
    Poseidon,
    Struct,
    Circuit,
    MerkleMap
} from 'snarkyjs';

export const NumberOfTokens = 4;

const MaxToken = 10e10;

type AccountBalance = {
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
}

export class TotalAccountBalances extends Struct({
    balances: Circuit.array(Field, NumberOfTokens)    
}){
    constructor() {
        super({balances: Array(NumberOfTokens).fill(0).map(Field)});
    }

    add(account: Account){
        account.balances.forEach((v, i) =>{
            this.balances[i] = this.balances[i].add(v);
        })
    };

    sub(account: Account, checkConstraint = true){
        account.balances.forEach((v, i) =>{
            if (checkConstraint) {
                this.balances[i].assertGte(v);
            }
            this.balances[i] = this.balances[i].sub(v);
        })
    };

    hash() {
        return Poseidon.hash(this.balances);
    };
};

export async function loadAccounts(fileName: string): Promise<AccountMap> {
    const savedAccounts = JSON.parse(await fs.readFile(fileName, 'utf8'));
    let balances : number[] = Array(NumberOfTokens).fill(0);

    return savedAccounts.reduce(function(map:AccountMap, account:AccountBalance) {
        balances[0] = account.ETH;
        balances[1] = account.MATIC;
        balances[2] = account.USDC;
        balances[3] = 1;

        map.set(account.id, Account.from(account.id, balances));
        return map;
    }, new Map<number, Account>());
}

export function calcTotalBalances(accounts: AccountMap) {
    let totalBalances = new TotalAccountBalances();

    accounts.forEach(account =>{
        totalBalances.add(account);
    });

    return totalBalances;
}

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

export function generateRandomAccounts(amount: number){
    return Array(amount).fill(0).map((_, i) => {
        return {
            id: 1000 + i,
            ETH: getRandomInt(MaxToken),
            MATIC: getRandomInt(MaxToken),
            USDC: getRandomInt(MaxToken),
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