import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesOTPField = createMultipleTypes(data);
export const TypesOTPFieldAdditional = (_props: Record<string, unknown>) => null;
