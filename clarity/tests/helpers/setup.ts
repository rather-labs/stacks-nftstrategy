
declare const simnet: any;

// Test accounts
const signers = () => {
  const accounts = simnet.getAccounts();
  return {
    deployer: accounts.get("deployer")!,
    alice: accounts.get("wallet_1")!,
    bob: accounts.get("wallet_2")!,
    charlie: accounts.get("wallet_3")!,
  };
};

const getSimnet = () => simnet;

export { signers, simnet, getSimnet };
