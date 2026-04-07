export interface ContractSchema {
  readonly _type: 'object';
  readonly fields: Readonly<Record<string, FieldSchema>>;
}

export interface FieldSchema {
  readonly types: readonly TypeFrequency[];
  readonly presence: number;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly enumValues?: readonly string[];
  readonly nested?: ContractSchema;
  readonly arrayItems?: FieldSchema;
  readonly sampleCount: number;
}

export interface TypeFrequency {
  readonly type: string;
  readonly count: number;
  readonly percentage: number;
}

export type ContractStatus = 'learning' | 'stable' | 'drifting';

export interface Contract {
  readonly id: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly method: string;
  readonly schema: ContractSchema;
  readonly sampleCount: number;
  readonly confidence: number;
  readonly status: ContractStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
