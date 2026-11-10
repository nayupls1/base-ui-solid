import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesAvatar = createMultipleTypes(data);
export const TypesAvatarAdditional = (_props: Record<string, unknown>) => null;
