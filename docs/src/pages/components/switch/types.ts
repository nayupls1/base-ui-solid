import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesSwitch = createMultipleTypes(data);
export const TypesSwitchAdditional = (_props: Record<string, unknown>) => null;
