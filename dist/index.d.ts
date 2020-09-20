import 'chrome-extension-async';
import { StorageType, UseChromeStorageReturnType, UseOpt } from './type';
declare const useChromeStorage: <T>(storageType: StorageType, useOpt: UseOpt<T>) => UseChromeStorageReturnType<T>;
export * from './type';
export { useChromeStorage as default };
