"use client";

import { useState } from "react";
import { createPublicClient, http, zeroAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
} from "@codefi/delegator-core-viem";
import {
  createBundlerClient,
  createPaymasterClient,
  UserOperationReceipt,
} from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";

const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
// if this is undefined, the API_KEY must be configured to Enable verifying paymaster
const PAYMASTER_POLICY_ID = process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID;

import examples from "@/app/examples";
import Hero from "../components/Hero";

function App() {
  const [delegatorSmartAccount, setDelegatorSmartAccount] =
    useState<MetaMaskSmartAccount<Implementation.Hybrid>>();
  const [isDeploying, setIsDeploying] = useState(false);
  const [userOperationReceipt, setUserOperationReceipt] =
    useState<UserOperationReceipt>();

  const publicClient = createPublicClient({
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

  const paymasterClient = createPaymasterClient({
    transport: http(BUNDLER_URL),
  });

  const bundlerClient = createBundlerClient({
    transport: http(BUNDLER_URL),
    paymaster: paymasterClient,
    chain,
    paymasterContext,
  });

  async function handleCreateDelegator() {
    const privateKey = generatePrivateKey();
    const owner = privateKeyToAccount(privateKey);

    const deploySalt = "0x";

    const smartaccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [owner.address, [], [], []],
      deploySalt,
      signatory: { account: owner },
    });

    setDelegatorSmartAccount(smartaccount);
  }

  async function handleDeployDelegator() {
    setIsDeploying(true);
    if (!delegatorSmartAccount) {
      return;
    }

    // we use a bespoke pimlico client to get the gas price specified by the bundler,
    // as there is no standard way to do this
    const { fast: fees } = await pimlicoClient.getUserOperationGasPrice();

    const gasEstimate = await bundlerClient.estimateUserOperationGas({
      account: delegatorSmartAccount,
      calls: [
        {
          to: zeroAddress,
        },
      ],
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    });

    console.log({ gasEstimate });

    const userOpHash = await bundlerClient.sendUserOperation({
      account: delegatorSmartAccount,
      calls: [
        {
          to: zeroAddress,
        },
      ],
      ...fees,
    });

    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    setIsDeploying(false);
    setUserOperationReceipt(receipt);
  }

  return (
    <div className="mx-auto">
      <Hero />
      <h2 className="text-2xl font-bold mb-4">Overview</h2>
      <p className="mb-4">
        A basic template to get you started with the{" "}
        <a
          className="text-green-500"
          href="https://metamask.io/developer/delegation-toolkit/"
          target="_blank"
        >
          Delegation Toolkit
        </a>
        . It includes a collection of self contained examples (selectable via
        the dropdown in the top-right or via the cards below) which can simply
        be deleted if you're using this as a scaffold for a new project.
      </p>
      <h2 className="text-2xl font-bold mb-4">
        Hello <span className="line-through">World</span>{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-green-500">
          Gator
        </span>
      </h2>
      <p className="mb-4">
        Click the following to create a new Delegator account.
      </p>
      <button
        className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
        onClick={handleCreateDelegator}
        disabled={!!delegatorSmartAccount}
      >
        Create Delegator Account
      </button>
      <p className="mb-4" style={{ overflow: "auto" }}>
        {delegatorSmartAccount ? (
          <a
            href={`https://sepolia.etherscan.io/address/${delegatorSmartAccount.address}`}
            className="text-green-500"
            target="_blank"
          >
            {userOperationReceipt && (
              <span className="inline-block animate-ping mr-2">🐊</span>
            )}
            {delegatorSmartAccount.address}
            {userOperationReceipt && (
              <span className="inline-block animate-ping ml-2">🐊</span>
            )}
          </a>
        ) : (
          "NA"
        )}
        {isDeploying && (
          <span>
            {" "}
            <span className="inline-block animate-spin">🐊</span> Deploying{" "}
            <span className="inline-block animate-spin">🐊</span>
          </span>
        )}
      </p>
      {delegatorSmartAccount && !userOperationReceipt && (
        <div>
          <p className="mb-4">
            Nice! You've just created a counterfactual (meaning it's not yet
            deployed on chain) Delegator account. Click below to deploy it via a
            pre-configured bundler.
          </p>
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleDeployDelegator}
            disabled={isDeploying || !delegatorSmartAccount}
          >
            Deploy Delegator Account
          </button>
        </div>
      )}
      {userOperationReceipt && (
        <p className="mb-4">
          <a
            className="text-green-500"
            href={`https://sepolia.etherscan.io/tx/${userOperationReceipt.receipt.transactionHash}`}
            target="_blank"
          >
            Done!{" "}
          </a>
          Click on the address above to check it out. Now feel free to try out
          some of the examples below to see what else you can do with the
          Delegation Toolkit.
        </p>
      )}

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
