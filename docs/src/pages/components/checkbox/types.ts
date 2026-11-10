import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesCheckbox = createMultipleTypes(data);
export const TypesCheckboxAdditional = (_props: Record<string, unknown>) => null;
