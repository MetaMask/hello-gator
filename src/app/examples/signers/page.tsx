"use client";

import { useEffect, useState } from "react";
import {
  Client,
  createPublicClient,
  Hex,
  http,
  toHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  createRootDelegation,
  DelegationFramework,
  SINGLE_DEFAULT_MODE,
  getExplorerTransactionLink,
  getExplorerAddressLink,
  createExecution,
} from "@codefi/delegator-core-viem";
import {
  createBundlerClient,
  createPaymasterClient,
  UserOperationReceipt,
} from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { randomBytes } from "crypto";
import {
  type SignatoryFactoryName,
  useSelectedSignatory,
} from "./useSelectedSignatory";
import { WEB3AUTH_NETWORK_TYPE } from "@web3auth/base";
import { formatJSON } from "@/app/utils";

const WEB3_AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3_CLIENT_ID!;
const WEB3_AUTH_NETWORK = process.env
  .NEXT_PUBLIC_WEB3_AUTH_NETWORK! as WEB3AUTH_NETWORK_TYPE;
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
// if this is undefined, the API_KEY must be configured to Enable verifying paymaster
const PAYMASTER_POLICY_ID = process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID;

const createSalt = () => toHex(randomBytes(8));

const createSmartAccount = (client: Client) => {
  const privateKey = generatePrivateKey();
  const owner = privateKeyToAccount(privateKey);

  const account = toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [owner.address, [], [], []],
    signatory: { account: owner },
    deploySalt: createSalt(),
  });

  return account;
};

type DeploymentStatus =
  | "deployed"
  | "counterfactual"
  | "deployment in progress";

function DeleGatorAccount({
  account,
  deploymentStatus,
}: {
  account: MetaMaskSmartAccount<Implementation> | undefined;
  deploymentStatus: DeploymentStatus;
}) {
  if (!account) {
    return "NA";
  }

  const explorerUrl = getExplorerAddressLink(chain.id, account.address);

  return (
    <>
      <a href={explorerUrl} target="_blank">
        {account.address} - {deploymentStatus}
      </a>
    </>
  );
}

function App() {
  const [delegateAccount, setDelegateSmartAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegatorAccount, setDelegatorAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegation, setDelegation] = useState<DelegationStruct>();
  const [userOpReceipt, setUserOpReceipt] = useState<UserOperationReceipt>();
  const [delegateDeploymentStatus, setDelegateDeploymentStatus] =
    useState<DeploymentStatus>("counterfactual");
  const [delegatorDeploymentStatus, setDelegatorDeploymentStatus] =
    useState<DeploymentStatus>("counterfactual");
  const [isRedeemingDelegation, setIsRedeemingDelegation] =
    useState<boolean>(false);

  const { selectedSignatory, setSelectedSignatoryName, selectedSignatoryName } =
    useSelectedSignatory({
      chain,
      web3AuthClientId: WEB3_AUTH_CLIENT_ID,
      web3AuthNetwork: WEB3_AUTH_NETWORK,
      rpcUrl: RPC_URL,
    });

  const client = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });
  const paymasterContext = PAYMASTER_POLICY_ID
    ? {
        sponsorshipPolicyId: PAYMASTER_POLICY_ID,
      }
    : undefined;

  const pimlicoClient = createPimlicoClient({
    transport: http(BUNDLER_URL),
  });

  const bundlerClient = createBundlerClient({
    transport: http(BUNDLER_URL),
    paymaster: createPaymasterClient({
      transport: http(BUNDLER_URL),
    }),
    chain,
    paymasterContext,
  });

  const isValidSignatorySelected =
    selectedSignatory && !selectedSignatory.isDisabled;

  const canDeployDelegatorAccount =
    delegatorAccount && delegatorDeploymentStatus === "counterfactual";
  const canCreateDelegation = !!(delegateAccount && delegatorAccount);
  const canSignDelegation = !!(delegatorAccount && delegation);
  const canRedeemDelegation = !!(
    delegatorDeploymentStatus === "deployed" &&
    !isRedeemingDelegation &&
    delegateAccount &&
    delegation?.signature !== undefined &&
    delegation?.signature !== "0x"
  );
  const canLogout = isValidSignatorySelected && selectedSignatory.canLogout();

  // create the delegate account immediately on page load
  useEffect(() => {
    createSmartAccount(client).then(setDelegateSmartAccount);
  }, []);

  const handleSignatoryChange = (ev: any) => {
    const signatoryName = ev.target.value as SignatoryFactoryName;
    setSelectedSignatoryName(signatoryName);

    setDelegatorAccount(undefined);
    setUserOpReceipt(undefined);
    setDelegation(undefined);
  };

  const handleLogout = async () => {
    if (!canLogout) {
      return;
    }
    await selectedSignatory!.logout!();

    setDelegatorAccount(undefined);
    setUserOpReceipt(undefined);
    setDelegation(undefined);
  };

  const handleCreateDelegator = async () => {
    if (selectedSignatory === undefined) {
      throw new Error("Delegator factory not set");
    }

    const { owner, signatory } = await selectedSignatory.login();
    const smartAccount = await toMetaMaskSmartAccount({
      client,
      implementation: Implementation.Hybrid,
      deployParams: [owner, [], [], []],
      deploySalt: createSalt(),
      signatory,
    });

    setDelegatorAccount(smartAccount);
    setDelegatorDeploymentStatus("counterfactual");
    setDelegation(undefined);
  };

  const handleDeployDelegator = async () => {
    if (!canDeployDelegatorAccount) {
      return;
    }

    setDelegatorDeploymentStatus("deployment in progress");

    const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

    const userOpHash = await bundlerClient.sendUserOperation({
      account: delegatorAccount,
      calls: [
        {
          to: zeroAddress,
        },
      ],
      ...fee,
    });

    const userOpHash2 = await bundlerClient.sendUserOperation({
      account: delegateAccount,
      calls: [
        {
          to: zeroAddress,
        },
      ],
      ...fee,
    });

    bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash2,
    });

    setDelegatorDeploymentStatus("deployed");
  };

  const handleCreateDelegation = () => {
    if (!canCreateDelegation) {
      return;
    }

    const newDelegation = createRootDelegation(
      delegateAccount.address,
      delegatorAccount.address,
      []
    );

    setDelegation(newDelegation);
  };

  const handleSignDelegation = async () => {
    if (!canSignDelegation) {
      return;
    }

    const signature = await delegatorAccount.signDelegation({
      delegation,
    });

    setDelegation({
      ...delegation,
      signature,
    });
  };

  const handleRedeemDelegation = async () => {
    if (!canRedeemDelegation) {
      return;
    }

    setIsRedeemingDelegation(true);

    const execution = createExecution();

    const data = DelegationFramework.encode.redeemDelegations(
      [[delegation]],
      [SINGLE_DEFAULT_MODE],
      [[execution]]
    );

    if (delegateDeploymentStatus === "counterfactual") {
      setDelegateDeploymentStatus("deployment in progress");
    }

    const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

    let userOpHash: Hex;

    try {
      userOpHash = await bundlerClient.sendUserOperation({
        account: delegateAccount,
        calls: [
          {
            to: delegateAccount.address,
            data,
          },
        ],
        ...fee,
      });
    } catch (error) {
      setIsRedeemingDelegation(false);
      if (delegateDeploymentStatus === "deployment in progress") {
        setDelegateDeploymentStatus("counterfactual");
      }
      throw error;
    }

    const userOperationReceipt =
      await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

    setUserOpReceipt(userOperationReceipt);

    setDelegateDeploymentStatus("deployed");

    setIsRedeemingDelegation(false);
  };

  const userOpExplorerUrl =
    userOpReceipt &&
    getExplorerTransactionLink(chain.id, userOpReceipt.receipt.transactionHash);

  return (
    <div>
      <h2>Viem Client Quickstart</h2>
      <p>
        In the following example, two DeleGator accounts are created (the
        "delegate" in the background when the page loads and the "delegator"
        when the "Create DeleGator Account" is pressed). Note: a random salt is
        used each time an account is created, so even if you've deployed one in
        the past, a new one will be created.
      </p>
      <p>
        Full control is then delegated from the "delegator" to the "delegate",
        via a signed Delegation.
      </p>
      <p>
        Before the Delegation can be used, the "delegator" account must be
        deployed. The "delegate" may be deployed as part of the UserOp used to
        redeem the delegation.
      </p>
      <p>
        The "delegate" then invokes this delegation to transfer 0 ETH (given the
        account has no balance). This is sent to the bundler, via a signed User
        Operation, where it is settled on-chain.
      </p>
      <label>Signatory:</label>{" "}
      <select
        onChange={handleSignatoryChange}
        value={selectedSignatoryName}
        className="bg-white text-black rounded-md px-2 py-1"
      >
        <option value="burnerSignatoryFactory">Burner private key</option>
        <option value="injectedProviderSignatoryFactory">
          Injected provider
        </option>
        <option value="web3AuthSignatoryFactory">Web3Auth</option>
      </select>
      <br />
      {canLogout && (
        <button
          onClick={handleLogout}
          className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
          disabled={!canLogout}
        >
          Logout
        </button>
      )}
      <br />
      <button
        onClick={handleCreateDelegator}
        disabled={!isValidSignatorySelected}
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
      >
        Create "delegator" Account
      </button>{" "}
      <button
        onClick={handleDeployDelegator}
        disabled={!canDeployDelegatorAccount}
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
      >
        Deploy "delegator" Account
      </button>
      <h3>Accounts:</h3>
      <pre style={{ overflow: "auto" }}>
        Delegate:{" "}
        <DeleGatorAccount
          account={delegateAccount}
          deploymentStatus={delegateDeploymentStatus}
        />
        <br />
        Delegator:{" "}
        <DeleGatorAccount
          account={delegatorAccount}
          deploymentStatus={delegatorDeploymentStatus}
        />
      </pre>
      <br />
      <button
        onClick={handleCreateDelegation}
        disabled={!canCreateDelegation}
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
      >
        Create Delegation
      </button>{" "}
      <button
        onClick={handleSignDelegation}
        disabled={!canSignDelegation}
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
      >
        Sign Delegation
      </button>
      <h3>Delegation:</h3>
      <pre style={{ overflow: "auto" }}>{formatJSON(delegation)}</pre>
      <button
        onClick={handleRedeemDelegation}
        disabled={!canRedeemDelegation}
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
      >
        Redeem Delegation
      </button>
      {isRedeemingDelegation && (
        <span className="ml-2 inline-block animate-spin">🐊</span>
      )}
      <h3>UserOp receipt:</h3>
      {userOpExplorerUrl && (
        <a href={userOpExplorerUrl} target="_blank">
          View transaction
        </a>
      )}
      {userOpReceipt && (
        <pre style={{ overflow: "auto", maxHeight: "200px" }}>
          {formatJSON(userOpReceipt)}
        </pre>
      )}
    </div>
  );
}

export default App;
