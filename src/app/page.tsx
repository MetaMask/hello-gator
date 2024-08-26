"use client";

import { useEffect, useState } from "react";
import { http, toHex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia as chain } from "viem/chains";
import {
  Implementation,
  createDeleGatorClient,
  PimlicoVerifyingPaymasterSponsor,
  PimlicoGasFeeResolver,
  createBundlerClient,
  createRootDelegation,
  createAction,
  getExplorerAddressLink,
  getExplorerTransactionLink,
  type DeleGatorClient,
  type DelegationStruct,
  type UserOperationV07,
} from "@codefi/delegator-core-viem";
import { randomBytes } from "crypto";
import {
  type SignatoryFactoryName,
  useSelectedSignatory,
} from "./useSelectedSignatory";
import { WEB3AUTH_NETWORK_TYPE } from "@web3auth/base";

const PIMLICO_PAYMASTER_KEY = process.env.NEXT_PUBLIC_PAYMASTER_API_KEY!;
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;
const WEB3_AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3_CLIENT_ID!;
const WEB3_AUTH_NETWORK = process.env
  .NEXT_PUBLIC_WEB3_AUTH_NETWORK! as WEB3AUTH_NETWORK_TYPE;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;

const createSalt = () => toHex(randomBytes(8));

const createCounterfactualDelegatorClient = () => {
  const privateKey = generatePrivateKey();
  const owner = privateKeyToAccount(privateKey);

  const viemClient = createDeleGatorClient({
    transport: http(),
    chain,
    account: {
      implementation: Implementation.Hybrid,
      deployParams: [owner.address, [], [], []],
      isAccountDeployed: false,
      signatory: owner,
      deploySalt: createSalt(),
    },
  });

  return viemClient;
};

const formatJSON = (value: any) => {
  if (value === null || value === undefined) {
    return "NA";
  }

  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
    2
  );
};

function DeleGatorAccount({
  client,
  isDeploying,
}: {
  client: DeleGatorClient | undefined;
  isDeploying: boolean;
}) {
  if (!client) {
    return "NA";
  }
  const status = client.account.isAccountDeployed
    ? "deployed"
    : isDeploying
      ? "deployment in progress"
      : "counterfactual";

  const explorerUrl = getExplorerAddressLink(chain.id, client.account.address);

  return (
    <>
      {client.account.address} -{" "}
      <a href={explorerUrl} target="_blank">
        {status}
      </a>
    </>
  );
}

function App() {
  const [delegateClient, setDelegateClient] = useState<DeleGatorClient>();
  const [delegatorClient, setDelegatorClient] = useState<DeleGatorClient>();

  const [delegation, setDelegation] = useState<DelegationStruct>();
  const [userOp, setUserOp] = useState<UserOperationV07>();
  const [userOpExplorerUrl, setUserOpExplorerUrl] = useState<string>();
  const [isDelegatorDeploymentStarted, setIsDelegatorDeploymentStarted] =
    useState(false);
  const [isDelegateDeploymentStarted, setIsDelegateDeploymentStarted] =
    useState(false);

  const { selectedSignatory, setSelectedSignatoryName, selectedSignatoryName } =
    useSelectedSignatory({
      chain,
      web3AuthClientId: WEB3_AUTH_CLIENT_ID,
      web3AuthNetwork: WEB3_AUTH_NETWORK,
      rpcUrl: RPC_URL,
    });

  const bundler = createBundlerClient(BUNDLER_URL);
  const paymaster = PimlicoVerifyingPaymasterSponsor({
    pimlicoAPIKey: PIMLICO_PAYMASTER_KEY,
  });
  const gasFeeResolver = PimlicoGasFeeResolver({
    pimlicoAPIKey: PIMLICO_PAYMASTER_KEY,
    inclusionSpeed: "fast",
  });

  const isValidSignatorySelected =
    selectedSignatory && !selectedSignatory.isDisabled;

  const canDeployDelegatorAccount =
    delegatorClient && !isDelegatorDeploymentStarted;
  const canCreateDelegation = !!(delegateClient && delegatorClient);
  const canSignDelegation = !!(delegatorClient && delegation);
  const canRedeemDelegation = !!(
    delegatorClient?.account.isAccountDeployed &&
    delegateClient &&
    delegation?.signature !== undefined &&
    delegation?.signature !== "0x"
  );
  const canLogout = isValidSignatorySelected && selectedSignatory.canLogout();

  useEffect(() => {
    const viemClient = createCounterfactualDelegatorClient();
    setDelegateClient(viemClient);
  }, []);

  const handleSignatoryChange = (ev: any) => {
    const signatoryName = ev.target.value as SignatoryFactoryName;
    setSelectedSignatoryName(signatoryName);

    setDelegatorClient(undefined);
    setIsDelegatorDeploymentStarted(false);
    setUserOp(undefined);
    setUserOpExplorerUrl(undefined);
    setDelegation(undefined);
  };

  const handleLogout = async () => {
    if (!canLogout) {
      return;
    }
    await selectedSignatory!.logout!();

    setDelegatorClient(undefined);
    setIsDelegatorDeploymentStarted(false);
    setUserOp(undefined);
    setUserOpExplorerUrl(undefined);
    setDelegation(undefined);
  };

  const handleCreateDelegator = async () => {
    if (selectedSignatory === undefined) {
      throw new Error("Delegator factory not set");
    }

    const { owner, signatory } = await selectedSignatory.login();
    const viemClient = createDeleGatorClient({
      transport: http(),
      chain,
      account: {
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        isAccountDeployed: false,
        signatory,
        deploySalt: createSalt(),
      },
    });

    setDelegatorClient(viemClient);
    setIsDelegatorDeploymentStarted(false);
    setUserOp(undefined);
    setUserOpExplorerUrl(undefined);
    setDelegation(undefined);
  };

  const handleDeployDelegator = async () => {
    if (!canDeployDelegatorAccount) {
      return;
    }

    setIsDelegatorDeploymentStarted(true);

    const action = createAction("0x0000000000000000000000000000000000000000");
    const unsponsoredUserOp = await delegatorClient.createExecuteUserOp(
      action,
      await gasFeeResolver.determineGasFee(chain)
    );

    await sponsorAndSubmitUserOp(delegatorClient, unsponsoredUserOp);

    if (!delegatorClient.account.isAccountDeployed) {
      setDelegatorClient(delegatorClient.toDeployedClient());
    }
  };

  const handleCreateDelegation = () => {
    if (!canCreateDelegation) {
      return;
    }

    const newDelegation = createRootDelegation(
      delegateClient.account.address,
      delegatorClient.account.address
    );

    setDelegation(newDelegation);
  };

  const handleSignDelegation = async () => {
    if (!canSignDelegation) {
      return;
    }

    const signedDelegation = await delegatorClient.signDelegation(delegation);
    setDelegation(signedDelegation);
  };

  const sponsorAndSubmitUserOp = async (
    client: DeleGatorClient,
    unsponsoredUserOp: UserOperationV07
  ) => {
    const sponsorship = await paymaster.getUserOperationSponsorship(
      client.account.environment.EntryPoint,
      chain,
      unsponsoredUserOp
    );

    const unsignedUserOp = {
      ...unsponsoredUserOp,
      ...sponsorship,
    };

    const userOp = await client.signUserOp(unsignedUserOp);

    const { result: hash } = await bundler.sendUserOp(
      userOp,
      client.account.environment.EntryPoint
    );

    const { result: userOperationReceipt } = await bundler.pollForReceipt(hash);

    if (!userOperationReceipt.success) {
      throw new Error(`UserOperation failed: ${userOperationReceipt.reason}`);
    }

    return {
      userOperationReceipt,
      userOp,
    };
  };

  const handleRedeemDelegation = async () => {
    if (!canRedeemDelegation) {
      return;
    }

    const action = createAction(delegateClient.account.address);

    const unsponsoredUserOp = await delegateClient.createRedeemDelegationUserOp(
      [delegation],
      action,
      await gasFeeResolver.determineGasFee(chain)
    );
    setUserOp(unsponsoredUserOp);

    if (!delegateClient.account.isAccountDeployed) {
      // if the account is already deployed, isDelegateDeploymentStarted is already true anyway
      setIsDelegateDeploymentStarted(true);
    }

    const { userOp, userOperationReceipt } = await sponsorAndSubmitUserOp(
      delegateClient,
      unsponsoredUserOp
    );

    setUserOp(userOp);

    setDelegateClient(delegateClient.toDeployedClient());

    const explorerUrl = getExplorerTransactionLink(
      chain.id,
      userOperationReceipt.receipt.transactionHash
    );

    setUserOpExplorerUrl(explorerUrl);
  };

  return (
    <div style={{ margin: "auto", width: "50%" }}>
      <h1>Viem Client Quickstart</h1>
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
      <select onChange={handleSignatoryChange} value={selectedSignatoryName}>
        <option value="burnerSignatoryFactory">Burner private key</option>
        <option value="injectedProviderSignatoryFactory">
          Injected provider
        </option>
        <option value="web3AuthSignatoryFactory">Web3Auth</option>
      </select>
      {canLogout && <button onClick={handleLogout}>Logout</button>}
      <br />
      <button
        onClick={handleCreateDelegator}
        disabled={!isValidSignatorySelected}
      >
        Create "delegator" Account
      </button>{" "}
      <button
        onClick={handleDeployDelegator}
        disabled={!canDeployDelegatorAccount}
      >
        Deploy "delegator" Account
      </button>
      <h3>Accounts:</h3>
      <pre style={{ overflow: "auto" }}>
        Delegate:{" "}
        <DeleGatorAccount
          client={delegateClient}
          isDeploying={isDelegateDeploymentStarted}
        />
        <br />
        Delegator:{" "}
        <DeleGatorAccount
          client={delegatorClient}
          isDeploying={isDelegatorDeploymentStarted}
        />
      </pre>
      <button onClick={handleCreateDelegation} disabled={!canCreateDelegation}>
        Create Delegation
      </button>{" "}
      <button onClick={handleSignDelegation} disabled={!canSignDelegation}>
        Sign Delegation
      </button>
      <h3>Delegation:</h3>
      <pre style={{ overflow: "auto" }}>{formatJSON(delegation)}</pre>
      <button onClick={handleRedeemDelegation} disabled={!canRedeemDelegation}>
        Redeem Delegation
      </button>
      <h3>UserOp:</h3>
      {userOpExplorerUrl && (
        <a href={userOpExplorerUrl} target="_blank">
          view transaction
        </a>
      )}
      <pre style={{ overflow: "auto" }}>{formatJSON(userOp)}</pre>
    </div>
  );
}

export default App;
