import 'chrome-extension-async';
import { StorageType, UseOpt, UseChromeStorageReturnType } from './type';
declare const useChromeStorage: <T>(storageType: StorageType, useOpt: UseOpt<T>) => UseChromeStorageReturnType<T>;
export { useChromeStorage as default };
export * from './type';
