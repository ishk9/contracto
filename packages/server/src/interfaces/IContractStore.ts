import type { Contract, ContractStatus } from '@contractcheck/core';

export interface IContractReader {
  getContract(provider: string, endpoint: string, method: string): Contract | null;
  listContracts(provider: string): Contract[];
  getAllContracts(): Contract[];
}

export interface IContractWriter {
  upsertContract(contract: Contract): void;
  updateStatus(id: string, status: ContractStatus): void;
}

export type IContractStore = IContractReader & IContractWriter;
