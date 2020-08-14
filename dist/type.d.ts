declare type StorageType = 'local' | 'sync';
declare type UseOpt<T> = {
    [P in keyof T]: {
        path: string;
        initialValue?: T[P];
        defaultValue?: T[P];
    };
};
interface StorageChangeInfo<V> {
    newState: V;
    oldState: V;
}
declare type Listener<V> = (storageInfo: StorageChangeInfo<V>) => void;
declare type ListenerList<T> = {
    [P in keyof T]?: Listener<T[P]>[];
};
declare type ResolveList<T> = {
    [P in keyof T]?: (value?: PromiseLike<void>) => void;
};
interface SetterOpt {
    stateOnly?: boolean;
}
declare type StateItem<V> = [V, (value: V, setterOpt?: SetterOpt) => Promise<void>, {
    addListener: (listener: Listener<V>) => void;
    removeListener: (listener: Listener<V>) => void;
    awaitListener: () => Promise<void>;
}];
declare type MappedStateList<T> = {
    [P in keyof T]: StateItem<T[P]>;
};
declare type UpdateProcedures<T> = {
    [P in keyof T]: T;
};
declare type UseOptPathList<T> = {
    [P in keyof UseOpt<T>]: string[];
};
declare type UseChromeStorageReturnType<T> = [MappedStateList<T>, {
    isLoadingCompleted: boolean;
    promiseSetterMulti: (updateProcedures: UpdateProcedures<T>) => Promise<void>;
    useOptPathList: UseOptPathList<T>;
}];
export { StorageType, UseOpt, StorageChangeInfo, Listener, ListenerList, ResolveList, SetterOpt, StateItem, MappedStateList, UpdateProcedures, UseOptPathList, UseChromeStorageReturnType, };
