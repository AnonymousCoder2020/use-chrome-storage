type StorageType = 'local' | 'sync'

type UseOpt<T> = {
  [P in keyof T]: {
    path: string
    initialValue?: T[P]
    defaultValue?: T[P]
  }
}

interface StorageChangeInfo<V> {
  newState: V
  oldState: V
}

type Listener<V> = (storageInfo: StorageChangeInfo<V>) => void

type ListenerList<T> = {
  [P in keyof T]?: Listener<T[P]>[]
}

type ResolveList<T> = {
  [P in keyof T]?: (value?: PromiseLike<void>) => void
}

interface SetterOpt {
  stateOnly?: boolean
}

type StateItem<V> = [
  V,
  (value: V, setterOpt?: SetterOpt) => Promise<void>,
  {
    addListener: (listener: Listener<V>) => void
    removeListener: (listener: Listener<V>) => void
    awaitListener: () => Promise<void>
  }
]

type MappedStateList<T> = {
  [P in keyof T]: StateItem<T[P]>
}

type UpdateProcedures<T> = {
  [P in keyof T]: T
}

type UseOptPathList<T> = { [P in keyof UseOpt<T>]: string[] }

type UseChromeStorageReturnType<T> = [
  MappedStateList<T>,
  {
    isLoadingCompleted: boolean
    promiseSetterMulti: (updateProcedures: UpdateProcedures<T>) => Promise<void>
    useOptPathList: UseOptPathList<T>
  }
]

export {
  StorageType,
  UseOpt,
  StorageChangeInfo,
  Listener,
  ListenerList,
  ResolveList,
  SetterOpt,
  StateItem,
  MappedStateList,
  UpdateProcedures,
  UseOptPathList,
  UseChromeStorageReturnType,
}
