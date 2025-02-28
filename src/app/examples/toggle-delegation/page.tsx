"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { createPublicClient, getContract, http, toHex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import {
  Implementation,
  toMetaMaskSmartAccount,
  createRootDelegation,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  getExplorerAddressLink,
  getExplorerTransactionLink,
  DelegationManager,
  getDelegationHashOffchain,
  Call,
  DelegationFramework,
} from "@metamask-private/delegator-core-viem";
import {
  createBundlerClient,
  createPaymasterClient,
} from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { randomBytes } from "crypto";
import { formatJSON } from "@/app/utils";

const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const PAYMASTER_POLICY_ID = process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID;

const createSalt = () => toHex(randomBytes(8));

const createCounterfactualDelegatorAccount = async () => {
  const privateKey = generatePrivateKey();
  const owner = privateKeyToAccount(privateKey);

  const client = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  const smartAccount = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [owner.address, [], [], []],
    deploySalt: createSalt(),
    signatory: { account: owner },
  });

  return smartAccount;
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
  const [delegateAccount, setDelegateAccount] =
    useState<MetaMaskSmartAccount<Implementation.Hybrid>>();
  const [delegatorAccount, setDelegatorAccount] =
    useState<MetaMaskSmartAccount<Implementation.Hybrid>>();
  const [delegation, setDelegation] = useState<DelegationStruct>();
  const [userOpExplorerUrlEnable, setUserOpExplorerUrlEnable] =
    useState<string>();
  const [userOpExplorerUrlDisable, setUserOpExplorerUrlDisable] =
    useState<string>();
  const [delegateDeploymentStatus, setDelegateDeploymentStatus] =
    useState<DeploymentStatus>("counterfactual");
  const [delegatorDeploymentStatus, setDelegatorDeploymentStatus] =
    useState<DeploymentStatus>("counterfactual");
  const [delegationStatus, setDelegationStatus] = useState<boolean>();
  const [isActionLoading, setIsActionLoading] = useState(false);

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

  const canCreateDelegation = !!(delegateAccount && delegatorAccount);
  const canSignDelegation = !!(delegatorAccount && delegation);

  useEffect(() => {
    createCounterfactualDelegatorAccount().then(setDelegateAccount);
  }, []);

  const handleCreateDelegator = async () => {
    const account = await createCounterfactualDelegatorAccount();

    setDelegatorAccount(account);
    setDelegateDeploymentStatus("counterfactual");
    setUserOpExplorerUrlDisable(undefined);
    setUserOpExplorerUrlEnable(undefined);
    setDelegation(undefined);
  };

  const handleDelegationAction = async (
    createCalls: () => Call[],
    setExplorerUrl: Dispatch<SetStateAction<string | undefined>>
  ) => {
    if (delegatorAccount) {
      if (!delegatorAccount.isDeployed) {
        setDelegatorDeploymentStatus("deployment in progress");
      }

      setIsActionLoading(true); // Disable the button
      try {
        const { fast: fees } = await pimlicoClient.getUserOperationGasPrice();

        const calls = await createCalls();

        const userOpHash = await bundlerClient.sendUserOperation({
          account: delegatorAccount,
          calls,
          ...fees,
        });

        const userOperationReceipt =
          await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });

        const explorerUrl = getExplorerTransactionLink(
          chain.id,
          userOperationReceipt.receipt.transactionHash
        );

        setTimeout(() => {
          handleCheckDelegationStatus();
        }, 2000);

        setDelegatorDeploymentStatus("deployed");
        setExplorerUrl(explorerUrl);
      } finally {
        setIsActionLoading(false); // Re-enable the button
      }
    }
  };

  const handleDisableDelegation = async () => {
    await handleDelegationAction(
      () => [
        {
          to: delegatorAccount!.address,
          data: DelegationFramework.encode.disableDelegation(delegation!),
        },
      ],
      setUserOpExplorerUrlDisable
    );
  };

  const handleEnableDelegation = async () => {
    await handleDelegationAction(
      () => [
        {
          to: delegatorAccount!.address,
          data: DelegationFramework.encode.enableDelegation(delegation!),
        },
      ],

      setUserOpExplorerUrlEnable
    );
  };

  const handleCreateDelegation = async () => {
    if (!canCreateDelegation) {
      return;
    }

    const newDelegation = createRootDelegation(
      delegateAccount!.address,
      delegatorAccount!.address,
      []
    );

    setDelegation(newDelegation);
    await handleCheckDelegationStatusFromInput(newDelegation);
  };

  const handleSignDelegation = async () => {
    if (!canSignDelegation) {
      return;
    }

    const signedDelegation = {
      ...delegation,
      signature: await delegatorAccount!.signDelegation({ delegation }),
    };

    setDelegation(signedDelegation);
  };

  const handleCheckDelegationStatus = async () => {
    handleCheckDelegationStatusFromInput(delegation as DelegationStruct);
  };

  const handleCheckDelegationStatusFromInput = async (
    delegationInput: DelegationStruct
  ) => {
    try {
      if (delegatorAccount) {
        const contract = getContract({
          abi: DelegationManager.abi,
          address: delegatorAccount.environment.DelegationManager,
          client,
        });
        const delegationHash = getDelegationHashOffchain(delegationInput);
        const isDelegationDisabled = await contract.read.disabledDelegations([
          delegationHash,
        ]);
        setDelegationStatus(!isDelegationDisabled);
      }
    } catch (error) {
      console.error("Failed to check delegation status", error);
    }
  };

  return (
    <div>
      <h2>Enable and Disable Delegations</h2>
      <p>
        In this example, a delegation is created that is enabled by default. Its
        status can then be changed using the provided buttons which send the
        corresponding User Operation.
      </p>
      <div
        className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 px-4 py-1 mb-6 rounded-lg"
        role="alert"
      >
        <p className="font-bold my-2">Note</p>
        <p className="mt-1">
          A delegation can only be re-enabled if it is currently disabled, and
          disabled if it is currently enabled. Attempting to set the status to
          its existing state will result in an error."
        </p>
      </div>
      <button
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
        onClick={handleCreateDelegator}
      >
        Create "delegator" Account
      </button>{" "}
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
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
        onClick={handleCreateDelegation}
        disabled={!canCreateDelegation}
      >
        Create Delegation
      </button>{" "}
      {delegation && (
        <>
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleSignDelegation}
            disabled={!canSignDelegation}
          >
            Sign Delegation
          </button>
          <h3>Delegation:</h3>
          <pre style={{ overflow: "auto" }}>{formatJSON(delegation)}</pre>
          <h3>Delegation Status:</h3>
          <pre style={{ overflow: "auto" }}>
            {`The delegation is ` + (delegationStatus ? "enabled" : "disabled")}
            .
          </pre>
          <br />
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleCheckDelegationStatus}
          >
            Refresh Status
          </button>{" "}
          {/* New button */}
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleDisableDelegation}
            disabled={isActionLoading || !delegationStatus}
          >
            Disable Delegation
          </button>{" "}
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleEnableDelegation}
            disabled={isActionLoading || delegationStatus}
          >
            Enable Delegation
          </button>
          <h3>UserOpDisable:</h3>
          {userOpExplorerUrlDisable && (
            <a
              href={userOpExplorerUrlDisable}
              target="_blank"
              className="text-green-500"
            >
              View transaction
            </a>
          )}
          <h3>UserOpEnable:</h3>
          {userOpExplorerUrlEnable && (
            <a
              href={userOpExplorerUrlEnable}
              target="_blank"
              className="text-green-500"
            >
              View transaction
            </a>
          )}
        </>
      )}
    </div>
  );
}

export default App;
