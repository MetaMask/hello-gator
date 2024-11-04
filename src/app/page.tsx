"use client";

import Hero from "@/components/Hero";
import {
  createMetaMaskAccount,
  createDelegation,
  executeOnBehalfOfDelegator,
} from "./quickstart";
import examples from "@/app/examples";
import { useState } from "react";
import {
  DelegationStruct,
  Implementation,
  MetaMaskSmartAccount,
  getExplorerAddressLink,
  getExplorerTransactionLink,
} from "@codefi/delegator-core-viem";
import { chain, getExplorerUserOperationLink } from "./examples/shared";
import { UserOperationReceipt } from "viem/account-abstraction";

function App() {
  const [executeOnBehalfIsLoading, setExecuteOnBehalfIsLoading] =
    useState(false);

  const [delegatorAccount, setDelegatorAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegateAccount, setDelegateAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegation, setDelegation] = useState<DelegationStruct>();
  const [userOperationReceipt, setUserOperationReceipt] =
    useState<UserOperationReceipt>();
  const [userOperationErrorMessage, setUserOperationErrorMessage] =
    useState<string>();

  const [isDelegateDeployed, setIsDelegateDeployed] = useState(false);
  const [isDelegatorDeployed, setIsDelegatorDeployed] = useState(false);

  const handleCreateDelegator = async () => {
    try {
      const account = await createMetaMaskAccount();
      setDelegatorAccount(account);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDelegate = async () => {
    try {
      const account = await createMetaMaskAccount();
      setDelegateAccount(account);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDelegation = async () => {
    if (!delegatorAccount || !delegateAccount) return;

    // Reset downstream state, as it may be a subsequent delegation.

    setDelegation(undefined);
    setUserOperationReceipt(undefined);

    try {
      const delegation = await createDelegation(
        delegatorAccount,
        delegateAccount.address
      );
      setDelegation(delegation);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExecuteOnBehalf = async () => {
    if (!delegateAccount || !delegatorAccount || !delegation) return;

    setUserOperationReceipt(undefined);

    setExecuteOnBehalfIsLoading(true);

    const { factory, factoryData } = await delegatorAccount.getFactoryArgs();

    const factoryArgs =
      factory && factoryData ? { factory, factoryData } : undefined;

    try {
      const receipt = await executeOnBehalfOfDelegator(
        delegateAccount,
        delegation,
        factoryArgs
      );
      if (receipt.success) {
        setUserOperationReceipt(receipt);
      } else {
        throw new Error(`User operation failed: ${receipt.reason}`);
      }
    } catch (error) {
      setUserOperationErrorMessage((error as Error).message);
    }
    setExecuteOnBehalfIsLoading(false);

    delegateAccount.isDeployed().then(setIsDelegateDeployed);
    delegatorAccount.isDeployed().then(setIsDelegatorDeployed);
  };

  const handleStartAgain = () => {
    setDelegatorAccount(undefined);
    setDelegateAccount(undefined);
    setDelegation(undefined);
    setUserOperationReceipt(undefined);
  };

  return (
    <div className="mx-auto">
      <Hero />
      <h2 className="text-2xl font-bold mb-4">
        Hello <span className="line-through">World</span>{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-green-500">
          Gator
        </span>{" "}
        - Quickstart
      </h2>
      <p className="mb-4">
        This example demonstrates how to get started with the Delegation
        Toolkit. See the{" "}
        <a
          href="https://docs.gator.metamask.io/get-started/quickstart"
          className="text-green-500"
          target="_blank"
        >
          accompanying documentation
        </a>
        .
      </p>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">Delegator Account</h3>
          <p>
            The MetaMask smart contract account that grants authority. Initially
            this will be counterfactual (not deployed on-chain), and will be
            deployed in the same user operation, just in time for redeeming the
            delegation.
          </p>
          {!delegatorAccount && (
            <button
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              onClick={handleCreateDelegator}
            >
              Create Delegator Account
            </button>
          )}
          {delegatorAccount && (
            <div>
              <a
                href={getExplorerAddressLink(
                  chain.id,
                  delegatorAccount.address
                )}
                target="_blank"
                className="text-green-500 font-mono"
              >
                {delegatorAccount.address}
              </a>{" "}
              - {isDelegatorDeployed ? "Deployed" : "Counterfactual"}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold">Delegate Account</h3>
          <p>
            The MetaMask smart contract account that receives the{" "}
            <span className="font-mono">delegation</span>. Initially this will
            be counterfactual (not deployed on-chain), until it is deployed by
            submitting a user operation.
          </p>
          {!delegateAccount && (
            <button
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              onClick={handleCreateDelegate}
            >
              Create Delegate Account
            </button>
          )}

          {delegateAccount && (
            <div>
              <a
                href={getExplorerAddressLink(chain.id, delegateAccount.address)}
                target="_blank"
                className="text-green-500 font-mono"
              >
                {delegateAccount.address}
              </a>{" "}
              - {isDelegateDeployed ? "Deployed" : "Counterfactual"}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold">Delegation</h3>
          <p>
            The <span className="font-mono">delegator</span> creates and signs a{" "}
            <span className="font-mono">delegation</span>, granting specific
            authority to the <span className="font-mono">delegate account</span>
            . In this case, the delegation allows a transfer of 0 ether to the
            zero address.
          </p>

          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleCreateDelegation}
            disabled={
              !delegatorAccount || !delegateAccount || executeOnBehalfIsLoading
            }
          >
            Create Delegation
          </button>

          {delegation && (
            <div className="mt-2 p-2 bg-gray-800 rounded">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(
                  delegation,
                  (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold">Execute</h3>
          <p>
            The redeemer submits a user operation that executes the action
            allowed by the <span className="font-mono">delegation</span> (in
            this case, transfer nothing to no one) on behalf of the{" "}
            <span className="font-mono">delegator</span>. If the{" "}
            <span className="font-mono">delegator</span> is counterfactual, it
            will be deployed as a separate{" "}
            <span className="font-mono">Call</span> in the same user operation.
          </p>
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleExecuteOnBehalf}
            disabled={!delegation || executeOnBehalfIsLoading}
          >
            Execute
          </button>

          {executeOnBehalfIsLoading && (
            <span className="animate-spin inline-block ml-2">
              🐊 loading...
            </span>
          )}
          {userOperationReceipt && (
            <div>
              User operation hash:{" "}
              <a
                href={getExplorerUserOperationLink(
                  chain.id,
                  userOperationReceipt.userOpHash
                )}
                className="text-green-500 font-mono"
                target="_blank"
              >
                {userOperationReceipt.userOpHash}
              </a>
              <br />
              Transaction hash:{" "}
              <a
                href={getExplorerTransactionLink(
                  chain.id,
                  userOperationReceipt.receipt.transactionHash
                )}
                className="text-green-500 font-mono"
                target="_blank"
              >
                {userOperationReceipt.receipt.transactionHash}
              </a>
            </div>
          )}
          {userOperationErrorMessage && (
            <div className="mt-2 p-2 bg-gray-800 rounded">
              <pre className="whitespace-pre-wrap break-all">
                Error submitting User Operation: {userOperationErrorMessage}
              </pre>
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={handleStartAgain}
              disabled={
                (!delegateAccount && !delegatorAccount) ||
                executeOnBehalfIsLoading
              }
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            >
              Start over
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Examples</h2>
      <div className="flex flex-wrap gap-4 mb-4">
        {examples.map((e, i) => {
          return (
            <a
              href={`/examples/${e.path}`}
              className="text-decoration-none bg-[rgb(36,41,46)] w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] px-5 py-2.5 text-white hover:bg-[rgb(41,46,51)] hover:text-gray-300 transition duration-200 transform hover:scale-105"
              key={i}
            >
              <h3>{e.name}</h3>
              <p>{e.description}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default App;
