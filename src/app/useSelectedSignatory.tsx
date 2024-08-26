import { useEffect, useState } from "react";
import type {
  SignatoryFactory,
  SignatoryFactoryConfig,
} from "./SignatoryTypes";
import { createBurnerSignatoryFactory } from "./burnerSignatoryFactory";
import { createWeb3AuthSignatoryFactory } from "./web3AuthSignatoryFactory";
import { createInjectedProviderSignatoryFactory } from "./injectedProviderSignatoryFactory";

export type SignatoryFactoryName =
  | "burnerSignatoryFactory"
  | "web3AuthSignatoryFactory"
  | "injectedProviderSignatoryFactory";

export const useSelectedSignatory = (config: SignatoryFactoryConfig) => {
  const [configuredFactoriesByName, setConfiguredFactoriesByName] = useState<{
    [K in SignatoryFactoryName]: SignatoryFactory;
  }>();

  const [selectedSignatoryName, setSelectedSignatoryName] =
    useState<SignatoryFactoryName>("burnerSignatoryFactory");

  useEffect(() => {
    const factoriesByName = {
      burnerSignatoryFactory: createBurnerSignatoryFactory(config),
      web3AuthSignatoryFactory: createWeb3AuthSignatoryFactory(config),
      injectedProviderSignatoryFactory:
        createInjectedProviderSignatoryFactory(config),
    };
    setConfiguredFactoriesByName(factoriesByName);
  }, []);

  const selectedSignatory =
    configuredFactoriesByName &&
    configuredFactoriesByName[selectedSignatoryName];

  return {
    selectedSignatory,
    setSelectedSignatoryName,
    selectedSignatoryName,
  };
};
