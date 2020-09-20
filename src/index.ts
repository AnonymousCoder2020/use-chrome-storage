import 'chrome-extension-async'
import { get, mapValues, set, toPath } from 'lodash'
import { useCallback, useRef, useState } from 'react'
import useAsyncEffect from 'use-async-effect'
import {
  Listener,
  ListenerList,
  MappedStateList,
  ResolveList,
  SetterOpt,
  StateItem,
  StorageChangeInfo,
  StorageType,
  UpdateProcedures,
  UseChromeStorageReturnType,
  UseOpt,
} from './type'

const { storage } = chrome

const useChromeStorage = <T>(storageType: StorageType, useOpt: UseOpt<T>) => {
  // stateListの準備が完了したら
  const isLoadedRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  // 指定されたuseOptの各文字列pathを分解して内部的に使うために置いておく
  const pathListRef = useRef(mapValues(useOpt, optValue => toPath(optValue.path)))

  // state or chrome storage の状態を変更する
  const promiseSetter = useCallback((stateName: keyof T, newValue: T[keyof T], setterOpt: SetterOpt) => {
    return new Promise<void>(resolve => {
      if (setterOpt.stateOnly) {
        // chrome.storageは更新せずstateだけに反映させる
        // とりあえず現在のページの表示に反映させたいだけ、という場合に有効
        stateList[stateName][0] = newValue
        resolve()
      } else {
        // chrome.storageが読み込まれていなければreturn
        if (!isLoadedRef.current) return
        // chrome.storageにも反映
        storage[storageType].get(data => {
          const process = set(data, pathListRef.current[stateName], newValue)
          storage[storageType].set(process, resolve)
        })
      }
    })
  }, [])

  // Listener置き場1
  const listenerList = useRef<ListenerList<T>>({})
  const addListener = useCallback((stateName: keyof T, listener: Listener<T[keyof T]>) => {
    const { current } = listenerList
    if (!current[stateName]) current[stateName] = []
    !current[stateName]?.includes(listener) && current[stateName]?.push(listener)
  }, [])
  const removeListener = useCallback((stateName: keyof T, listener: Listener<T[keyof T]>) => {
    const { current } = listenerList
    current[stateName] = current[stateName]?.filter(f => f !== listener)
  }, [])
  const emit = useCallback((stateName: keyof T, storageChangeInfo: StorageChangeInfo<T[keyof T]>) => {
    listenerList.current[stateName]?.forEach(listener => listener(storageChangeInfo))
  }, [])
  // stateの変更とともに実行される空非同期関数のリスト
  const resolveList = useRef<ResolveList<T>>({})
  // stateの変更を検知したときに呼び出される
  const executeResolve = useCallback((stateName: keyof T) => {
    const onChange = resolveList.current[stateName]
    if (onChange) {
      onChange()
      // 一度使ったイベントは破棄
      delete resolveList.current[stateName]
    }
  }, [])

  // ストレージ読込前に提供する state
  const [stateList, setStateList] = useState<MappedStateList<T>>(
    mapValues(
      useOpt,
      (optValue, stateName) =>
        [
          optValue.initialValue,
          (value: T[keyof T], setterOpt: SetterOpt = {}) => promiseSetter(stateName as keyof T, value, setterOpt),
          {
            addListener: listener => addListener(stateName as keyof T, listener),
            removeListener: listener => removeListener(stateName as keyof T, listener),
            awaitListener: () =>
              new Promise(resolve => {
                resolveList.current[stateName as keyof T] = resolve
              }),
          },
        ] as StateItem<T[any]>
    )
  )

  useAsyncEffect(async () => {
    // stateListのセットアップ

    // 全てのchrome.storageデータを読み込む
    let allData = await storage[storageType].get()
    // 指定されたstateをchrome.storageから引っ張り出してきて、提供用に整える
    for (const [stateName, { defaultValue }] of Object.entries(useOpt) as [keyof UseOpt<T>, UseOpt<T>[keyof T]][]) {
      const path = pathListRef.current[stateName]
      const getData = get(allData, path)
      // StateItemを入れる
      stateList[stateName][0] = getData ?? defaultValue
      // デフォルトデータが指定されていて、かつchrome.storage側にデータが存在しない場合には、storageにデフォルト状態を充てがう
      if (getData === undefined && defaultValue !== undefined) allData = set(allData, path, defaultValue)
    }
    setStateList({ ...stateList })
    isLoadedRef.current = true
    setIsLoaded(true)
    // chrome.storageにデフォルトの状態を保存
    const chromeAsyncSetter = (data: any) =>
      new Promise(resolve => {
        storage[storageType].set(data, resolve)
      })
    await chromeAsyncSetter(allData)

    // chrome.storageの変更を自動検知してstateに反映
    //const storageForEvent = (storage[storageType] as any)
    storage.onChanged.addListener((result: { [key: string]: { oldValue?: any; newValue?: any } }) => {
      //console.log('result', result)
      for (const [key, { newValue }] of Object.entries(result)) {
        // 変更対象のstateだけ絞り込んで、各自newValueから新しい値をもらう
        const changedStatePathList = Object.entries<string[]>(pathListRef.current).filter(([_, path]) => path[0] == key)
        for (const [stateName, [, ...deepPath]] of changedStatePathList as [keyof T, string[]][]) {
          const oldState = stateList[stateName][0]
          const newState = deepPath.length ? get(newValue, deepPath) : newValue
          // newValueで更新する前にイベントを発火
          emit(stateName, { newState, oldState })
          stateList[stateName][0] = newState
          setStateList({ ...stateList })
          // 溜まってたresolveがあれば実行
          executeResolve(stateName)
        }
      }
      //console.log('stateList', stateList)
    })
  }, [])

  // 複数のstateListを更新する
  const promiseSetterMulti = useCallback((updateProcedures: UpdateProcedures<T>) => {
    if (!isLoadedRef.current) return
    return new Promise<void>(async resolve => {
      let data = await storage[storageType].get()
      for (const [stateName, newValue] of Object.entries(updateProcedures) as [keyof T, T][]) {
        data = set(data, pathListRef.current[stateName], newValue)
      }
      storage[storageType].set(data, resolve)
    })
  }, [])

  return [
    stateList,
    {
      isLoaded,
      promiseSetterMulti,
      pathListRef,
    },
  ] as UseChromeStorageReturnType<T>
}

export * from './type'
export { useChromeStorage as default }
