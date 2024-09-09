"use client";

import { useState } from "react";
import { http } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import {
  Implementation,
  createDeleGatorClient,
  PimlicoVerifyingPaymasterSponsor,
  PimlicoGasFeeResolver,
  createBundlerClient,
  createAction,
  type DeleGatorClient,
  UserOperationReceiptResponse,
  getExplorerAddressLink,
  getExplorerTransactionLink,
} from "@codefi/delegator-core-viem";

const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;
const PIMLICO_PAYMASTER_KEY = process.env.NEXT_PUBLIC_PAYMASTER_API_KEY!;

import examples from "@/app/examples";
import Hero from "../components/Hero";

function App() {
  const [delegator, setDelegator] = useState<DeleGatorClient>();
  const [isDeploying, setIsDeploying] = useState(false);
  const [userOperationReceipt, setUserOperationReceipt] =
    useState<UserOperationReceiptResponse>();

  const gasFeeResolver = PimlicoGasFeeResolver({
    pimlicoAPIKey: PIMLICO_PAYMASTER_KEY,
    inclusionSpeed: "fast",
  });

  const paymaster = PimlicoVerifyingPaymasterSponsor({
    pimlicoAPIKey: PIMLICO_PAYMASTER_KEY,
  });

  function handleCreateDelegator() {
    const privateKey = generatePrivateKey();
    const owner = privateKeyToAccount(privateKey);

    const delegatorClient = createDeleGatorClient({
      transport: http(),
      chain,
      account: {
        implementation: Implementation.Hybrid,
        deployParams: [owner.address, [], [], []],
        isAccountDeployed: false,
        signatory: owner,
        deploySalt: "0x1",
      },
    });

    setDelegator(delegatorClient);
  }

  async function handleDeployDelegator() {
    setIsDeploying(true);
    if (!delegator) {
      return;
    }

    const bundler = createBundlerClient(BUNDLER_URL);
    const action = createAction("0x0000000000000000000000000000000000000000");
    const unsponsoredUserOp = await delegator.createExecuteUserOp(
      action,
      await gasFeeResolver.determineGasFee(chain)
    );

    const sponsorship = await paymaster.getUserOperationSponsorship(
      delegator.account.environment.EntryPoint,
      chain,
      unsponsoredUserOp
    );

    const unsignedUserOp = {
      ...unsponsoredUserOp,
      ...sponsorship,
    };

    const userOp = await delegator.signUserOp(unsignedUserOp);

    const { result: hash } = await bundler.sendUserOp(
      userOp,
      delegator.account.environment.EntryPoint
    );

    const { result } = await bundler.pollForReceipt(hash);

    if (!result.success) {
      throw new Error(`UserOperation failed: ${result.reason}`);
    }

    setIsDeploying(false);
    setUserOperationReceipt(result);
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
        disabled={!!delegator}
      >
        Create Delegator Account
      </button>
      <p className="mb-4" style={{ overflow: "auto" }}>
        {delegator ? (
          <a
            href={getExplorerAddressLink(chain.id, delegator.account.address)}
            className="text-green-500"
            target="_blank"
          >
            {userOperationReceipt && <span className="inline-block animate-ping mr-2">🐊</span>}
            {delegator.account.address}
            {userOperationReceipt && <span className="inline-block animate-ping ml-2">🐊</span>}
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
      {delegator && !userOperationReceipt && (
        <div>
          <p className="mb-4">
            Nice! You've just created a counterfactual (meaning it's not yet
            deployed on chain) Delegator account. Click below to deploy it via a
            pre-configured bundler.
          </p>
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleDeployDelegator}
            disabled={isDeploying || !delegator}
          >
            Deploy Delegator Account
          </button>
        </div>
      )}
      {userOperationReceipt && (
        <p className="mb-4">
          <a
            className="text-green-500"
            href={getExplorerTransactionLink(
              chain.id,
              userOperationReceipt.receipt.transactionHash
            )}
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
