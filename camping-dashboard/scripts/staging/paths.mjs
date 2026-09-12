import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const SOURCE_ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const sourcePath=(...parts)=>resolve(SOURCE_ROOT,...parts);
