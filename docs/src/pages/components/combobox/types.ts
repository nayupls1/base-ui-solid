import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesCombobox = createMultipleTypes(data);
export const TypesComboboxAdditional = (_props: Record<string, unknown>) => null;
