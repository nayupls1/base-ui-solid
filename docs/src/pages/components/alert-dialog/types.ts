import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesAlertDialog = createMultipleTypes(data);
export const TypesAlertDialogAdditional = (_props: Record<string, unknown>) => null;
