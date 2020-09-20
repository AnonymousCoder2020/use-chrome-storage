import 'chrome-extension-async';
import { get, mapValues, set, toPath } from 'lodash';
import { useCallback, useRef, useState } from 'react';
import useAsyncEffect from 'use-async-effect';
const { storage } = chrome;
const useChromeStorage = (storageType, useOpt) => {
    // stateListの準備が完了したら
    const isLoadedRef = useRef(false);
    const [isLoaded, setIsLoaded] = useState(false);
    // 指定されたuseOptの各文字列pathを分解して内部的に使うために置いておく
    const pathListRef = useRef(mapValues(useOpt, optValue => toPath(optValue.path)));
    // state or chrome storage の状態を変更する
    const promiseSetter = useCallback((stateName, newValue, setterOpt) => {
        return new Promise(resolve => {
            if (setterOpt.stateOnly) {
                // chrome.storageは更新せずstateだけに反映させる
                // とりあえず現在のページの表示に反映させたいだけ、という場合に有効
                stateList[stateName][0] = newValue;
                resolve();
            }
            else {
                // chrome.storageが読み込まれていなければreturn
                if (!isLoadedRef.current)
                    return;
                // chrome.storageにも反映
                storage[storageType].get(data => {
                    const process = set(data, pathListRef.current[stateName], newValue);
                    storage[storageType].set(process, resolve);
                });
            }
        });
    }, []);
    // Listener置き場1
    const listenerList = useRef({});
    const addListener = useCallback((stateName, listener) => {
        var _a, _b;
        const { current } = listenerList;
        if (!current[stateName])
            current[stateName] = [];
        !((_a = current[stateName]) === null || _a === void 0 ? void 0 : _a.includes(listener)) && ((_b = current[stateName]) === null || _b === void 0 ? void 0 : _b.push(listener));
    }, []);
    const removeListener = useCallback((stateName, listener) => {
        var _a;
        const { current } = listenerList;
        current[stateName] = (_a = current[stateName]) === null || _a === void 0 ? void 0 : _a.filter(f => f !== listener);
    }, []);
    const emit = useCallback((stateName, storageChangeInfo) => {
        var _a;
        (_a = listenerList.current[stateName]) === null || _a === void 0 ? void 0 : _a.forEach(listener => listener(storageChangeInfo));
    }, []);
    // stateの変更とともに実行される空非同期関数のリスト
    const resolveList = useRef({});
    // stateの変更を検知したときに呼び出される
    const executeResolve = useCallback((stateName) => {
        const onChange = resolveList.current[stateName];
        if (onChange) {
            onChange();
            // 一度使ったイベントは破棄
            delete resolveList.current[stateName];
        }
    }, []);
    // ストレージ読込前に提供する state
    const [stateList, setStateList] = useState(mapValues(useOpt, (optValue, stateName) => [
        optValue.initialValue,
        (value, setterOpt = {}) => promiseSetter(stateName, value, setterOpt),
        {
            addListener: listener => addListener(stateName, listener),
            removeListener: listener => removeListener(stateName, listener),
            awaitListener: () => new Promise(resolve => {
                resolveList.current[stateName] = resolve;
            }),
        },
    ]));
    useAsyncEffect(async () => {
        // stateListのセットアップ
        // 全てのchrome.storageデータを読み込む
        let allData = await storage[storageType].get();
        // 指定されたstateをchrome.storageから引っ張り出してきて、提供用に整える
        for (const [stateName, { defaultValue }] of Object.entries(useOpt)) {
            const path = pathListRef.current[stateName];
            const getData = get(allData, path);
            // StateItemを入れる
            stateList[stateName][0] = getData !== null && getData !== void 0 ? getData : defaultValue;
            // デフォルトデータが指定されていて、かつchrome.storage側にデータが存在しない場合には、storageにデフォルト状態を充てがう
            if (getData === undefined && defaultValue !== undefined)
                allData = set(allData, path, defaultValue);
        }
        setStateList({ ...stateList });
        isLoadedRef.current = true;
        setIsLoaded(true);
        // chrome.storageにデフォルトの状態を保存
        const chromeAsyncSetter = (data) => new Promise(resolve => {
            storage[storageType].set(data, resolve);
        });
        await chromeAsyncSetter(allData);
        // chrome.storageの変更を自動検知してstateに反映
        //const storageForEvent = (storage[storageType] as any)
        storage.onChanged.addListener((result) => {
            //console.log('result', result)
            for (const [key, { newValue }] of Object.entries(result)) {
                // 変更対象のstateだけ絞り込んで、各自newValueから新しい値をもらう
                const changedStatePathList = Object.entries(pathListRef.current).filter(([_, path]) => path[0] == key);
                for (const [stateName, [, ...deepPath]] of changedStatePathList) {
                    const oldState = stateList[stateName][0];
                    const newState = deepPath.length ? get(newValue, deepPath) : newValue;
                    // newValueで更新する前にイベントを発火
                    emit(stateName, { newState, oldState });
                    stateList[stateName][0] = newState;
                    setStateList({ ...stateList });
                    // 溜まってたresolveがあれば実行
                    executeResolve(stateName);
                }
            }
            //console.log('stateList', stateList)
        });
    }, []);
    // 複数のstateListを更新する
    const promiseSetterMulti = useCallback((updateProcedures) => {
        if (!isLoadedRef.current)
            return;
        return new Promise(async (resolve) => {
            let data = await storage[storageType].get();
            for (const [stateName, newValue] of Object.entries(updateProcedures)) {
                data = set(data, pathListRef.current[stateName], newValue);
            }
            storage[storageType].set(data, resolve);
        });
    }, []);
    return [
        stateList,
        {
            isLoaded,
            promiseSetterMulti,
            pathListRef,
        },
    ];
};
export * from './type';
export { useChromeStorage as default };
