import { ethers } from "ethers";
import { Field } from "snarkyjs";

const IECR20_Abi = [
    // Some details about the token
    "function name() view returns (string)",
    "function symbol() view returns (string)",
  
    // Get the account balance
    "function balanceOf(address) view returns (uint)",
  
    // Send some of your tokens to someone else
    "function transfer(address to, uint amount)",
  
    // An event triggered whenever anyone transfers to someone else
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

export async function getETHBalance(NetworkURL: string, address: string) {
    const provider = new ethers.providers.JsonRpcProvider(NetworkURL);
    const balance = await provider.getBalance(address);

    console.log(NetworkURL, address, balance.toString());

    return Field(balance.toString());
}


export async function getUSDCBalance(NetworkURL: string, contractAddress: string, address: string) {
    const provider = new ethers.providers.JsonRpcProvider(NetworkURL);

    const usdcContract = new ethers.Contract(contractAddress, IECR20_Abi, provider);
    const balance = await usdcContract.balanceOf(address);
    
    console.log(NetworkURL, contractAddress, address, balance.toString());
    
    return Field(balance.toString());
}