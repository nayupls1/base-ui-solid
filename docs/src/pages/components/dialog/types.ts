import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesDialog = createMultipleTypes(data);
export const TypesDialogAdditional = (_props: Record<string, unknown>) => null;
