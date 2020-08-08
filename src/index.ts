import { useState, useCallback, useMemo, useRef } from 'react'
import { get, set, mapValues } from 'lodash'
import 'chrome-extension-async'
import useAsyncEffect from 'use-async-effect'
import ObjectPath from 'objectpath'
import {
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
  UseChromeStorageReturnType,
} from './type'

const { storage } = chrome

const useChromeStorage = <T>(storageType: StorageType, useOpt: UseOpt<T>) => {
  // stateListの準備が完了したら
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  // 指定されたuseOptの各文字列pathを分解して内部的に使うために置いておく
  const useOptPathList = useMemo(() => {
    return mapValues(useOpt, optValue => ObjectPath.parse(optValue.path))
  }, [useOpt])
  // ストレージ読込前に提供する state
  const [stateList, setStateList] = useState<MappedStateList<T>>(
    mapValues(
      useOpt,
      optValue => [optValue.initialValue, async () => {}, { addListener: null, removeListener: null, awaitListener: null }] as StateItem<T[any]>
    )
  )

  // Listener置き場
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

  useAsyncEffect(async () => {
    // stateListのセットアップ

    // 全てのchrome.storageデータを読み込む
    let allData = await storage[storageType].get()
    // 指定されたstateをchrome.storageから引っ張り出してきて、提供用に整える
    for (const [stateName, { defaultValue }] of Object.entries(useOpt) as [keyof UseOpt<T>, UseOpt<T>[keyof T]][]) {
      const path = useOptPathList[stateName]
      const getData = get(allData, path)
      // StateItemを入れる
      stateList[stateName] = [
        getData ?? defaultValue,
        (value: T[keyof T], setterOpt: SetterOpt = {}) => promiseSetterRef.current(stateName, value, setterOpt),
        {
          addListener: listener => addListener(stateName, listener),
          removeListener: listener => removeListener(stateName, listener),
          awaitListener: () =>
            new Promise(resolve => {
              resolveList.current[stateName] = resolve
            }),
        },
      ]
      // デフォルトデータが指定されていて、かつchrome.storage側にデータが存在しない場合には、storageにデフォルト状態を充てがう
      if (getData === undefined && defaultValue !== undefined) allData = set(allData, path, defaultValue)
    }
    //console.log('stateList', stateList)
    setStateList({ ...stateList })
    setIsLoadingCompleted(true)
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
        const changedStatePathList = Object.entries<string[]>(useOptPathList).filter(([_, path]) => path[0] == key)
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
  // state or chrome storage の状態を変更する
  const promiseSetterRef = useRef((stateName: keyof T, newValue: T[keyof T], setterOpt: SetterOpt) => {
    return new Promise<void>(resolve => {
      if (setterOpt.stateOnly) {
        // chrome.storageは更新せずstateだけに反映させる
        // とりあえず現在のページの表示に反映させたいだけ、という場合に有効
        stateList[stateName][0] = newValue
        resolve()
      } else {
        // chrome.storageにも反映
        storage[storageType].get(data => {
          const process = set(data, useOptPathList[stateName], newValue)
          console.log('process', process)
          storage[storageType].set(process, resolve)
        })
      }
    })
  })

  // 複数のstateListを更新する
  const promiseSetterMulti = useRef((updateProcedures: UpdateProcedures<T>) => {
    return new Promise<void>(async resolve => {
      let data = await storage[storageType].get()
      for (const [stateName, newValue] of Object.entries(updateProcedures) as [keyof T, T][]) {
        data = set(data, useOptPathList[stateName], newValue)
      }
      storage[storageType].set(data, resolve)
    })
  })

  return [
    stateList,
    {
      isLoadingCompleted,
      promiseSetterMulti: promiseSetterMulti.current,
      useOptPathList,
    },
  ] as UseChromeStorageReturnType<T>
}

export { useChromeStorage as default }

export * from './type'
