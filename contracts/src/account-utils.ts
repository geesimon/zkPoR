import fs from 'fs/promises';
import { 
        NumberOfTokens, 
        TokenNames,
        Account,
        AccountMap,
} from './Ledger-lib';

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
