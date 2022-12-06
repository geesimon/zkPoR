import fs from 'fs/promises';
import {
    Field,
    Poseidon,
    Struct,
    Circuit
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

export async function loadAccounts(fileName: string) {
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

export function totalBalances(accounts: AccountMap) {
    let totalBalances = Array(NumberOfTokens).fill(0).map(Field);

    accounts.forEach(account =>{
        totalBalances.forEach((_, i) =>{
            totalBalances[i] = totalBalances[i].add(account.balances[i])
        })
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

export async function generateRandomAccountsFile(fileName: string) {
    const accounts = generateRandomAccounts(100);

    await fs.writeFile(fileName, JSON.stringify(accounts));
}