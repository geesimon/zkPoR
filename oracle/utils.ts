import {
    Field,
    Mina,
    PrivateKey,
    PublicKey,
    fetchAccount,
  } from 'snarkyjs';
  
  // ========================================================
  
  export const accountExists = async (account: PublicKey) => {
    let response = await fetchAccount({ publicKey: account });
    let accountExists = response.error == null;
    return accountExists;
  }
  
  
  // ========================================================
  
  export const loopUntilAccountExists = async (
    { account,
      eachTimeNotExist,
      isZkAppAccount
    }:
    { account: PublicKey,
      eachTimeNotExist: () => void,
      isZkAppAccount: boolean
    }
  ) => {
    for (;;) {
      let response = await fetchAccount({ publicKey: account });
      let accountExists = response.error == null;
      if (isZkAppAccount) {
        accountExists = accountExists && response.account!.appState != null;
      }
      if (!accountExists) {
        await eachTimeNotExist();
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        // TODO add optional check that verification key is correct once this is available in SnarkyJS
        return response.account!;
      }
    }
  };
  
  // ========================================================
  
  interface ToString {
    toString: () => string;
  }
  
  type FetchedAccountResponse = Awaited<ReturnType<typeof fetchAccount>>
  type FetchedAccount =  NonNullable<FetchedAccountResponse["account"]>
  
  export const makeAndSendTransaction = async <State extends ToString>({ 
    feePayerPrivateKey,
    zkAppPublicKey,
    mutateZkApp,
    transactionFee,
    getState,
    statesEqual,
    transactionTimeout = 15 * 60 * 1000,
  }: { 
    feePayerPrivateKey: PrivateKey,
    zkAppPublicKey: PublicKey,
    mutateZkApp: () => void,
    transactionFee: number,
    getState: () => State,
    statesEqual: (state1: State, state2: State) => boolean,
    transactionTimeout?: number,
  }) => {
    const initialState = getState();
  
    // Why this line? It increments internal feePayer account variables, such as
    // nonce, necessary for successfully sending a transaction
    await fetchAccount({ publicKey: feePayerPrivateKey.toPublicKey() });
  
    let transaction = await Mina.transaction(
      { feePayerKey: feePayerPrivateKey, fee: transactionFee },
      () => {
        mutateZkApp();
      }
    );
  
    // fill in the proof - this can take a while...
    console.log('Creating an execution proof...');
    let time0 = Date.now();
    await transaction.prove();
    let time1 = Date.now();
    console.log('creating proof took', (time1 - time0) / 1e3, 'seconds');
  
    console.log('Sending the transaction...');
    const res = await transaction.send();
    const hash = await res.hash(); // This will change in a future version of SnarkyJS
    if (hash == null) {
      throw('Error sending transaction');
    } else {
      console.log(
        'See transaction at',
        'https://berkeley.minaexplorer.com/transaction/' + hash
      );
    }
  
    let state = getState();
  
    time0 = time1 = Date.now();
    let stateChanged = false;
    while (!stateChanged) {
      if ((time1 - time0) > transactionTimeout){
        throw('Transaction timeout');
      }
      console.log(
        (time1 - time0) / 1e3,
        ' - Waiting for zkApp state to change... (current state: ',
        state.toString() + ')'
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await fetchAccount({ publicKey: zkAppPublicKey });
      state = await getState();
      stateChanged = !statesEqual(initialState, state);
      time1 = Date.now();
    }
   
    console.log('Change done in ', (time1 - time0) / 1e3, 'seconds');
  };
  
  // ========================================================
  
  export const zkAppNeedsInitialization = async (
    { zkAppAccount }:
    { zkAppAccount: FetchedAccount }
  ) => {
    console.warn('warning: using a `utils.ts` written before `isProved` made available. Check https://docs.minaprotocol.com/zkapps/tutorials/deploying-to-a-live-network for updates');
    // TODO when available in the future, use isProved.
    const allZeros = zkAppAccount.appState!.every((f: Field) =>
      f.equals(Field.zero).toBoolean()
    );
    const needsInitialization = allZeros;
    return needsInitialization;
  }
  
  // ========================================================