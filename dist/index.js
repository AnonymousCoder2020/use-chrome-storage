import { useState, useCallback, useMemo, useRef } from 'react';
import { get, set, mapValues } from 'lodash';
import 'chrome-extension-async';
import useAsyncEffect from 'use-async-effect';
import ObjectPath from 'objectpath';
const { storage } = chrome;
const err = () => (console.warn('The function of the unavailable stage is used.'), console.trace());
const useChromeStorage = (storageType, useOpt) => {
    // stateListの準備が完了したら
    const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
    // 指定されたuseOptの各文字列pathを分解して内部的に使うために置いておく
    const useOptPathList = useMemo(() => {
        return mapValues(useOpt, optValue => ObjectPath.parse(optValue.path));
    }, [useOpt]);
    // ストレージ読込前に提供する state
    const [stateList, setStateList] = useState(mapValues(useOpt, optValue => [optValue.initialValue, async () => err(), { addListener: err, removeListener: err, awaitListener: async () => err() }]));
    // Listener置き場
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
    useAsyncEffect(async () => {
        // stateListのセットアップ
        // 全てのchrome.storageデータを読み込む
        let allData = await storage[storageType].get();
        // 指定されたstateをchrome.storageから引っ張り出してきて、提供用に整える
        for (const [stateName, { defaultValue }] of Object.entries(useOpt)) {
            const path = useOptPathList[stateName];
            const getData = get(allData, path);
            // StateItemを入れる
            stateList[stateName] = [
                getData !== null && getData !== void 0 ? getData : defaultValue,
                (value, setterOpt = {}) => promiseSetterRef.current(stateName, value, setterOpt),
                {
                    addListener: listener => addListener(stateName, listener),
                    removeListener: listener => removeListener(stateName, listener),
                    awaitListener: () => new Promise(resolve => {
                        resolveList.current[stateName] = resolve;
                    }),
                },
            ];
            // デフォルトデータが指定されていて、かつchrome.storage側にデータが存在しない場合には、storageにデフォルト状態を充てがう
            if (getData === undefined && defaultValue !== undefined)
                allData = set(allData, path, defaultValue);
        }
        //console.log('stateList', stateList)
        setStateList({ ...stateList });
        setIsLoadingCompleted(true);
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
                const changedStatePathList = Object.entries(useOptPathList).filter(([_, path]) => path[0] == key);
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
    // state or chrome storage の状態を変更する
    const promiseSetterRef = useRef((stateName, newValue, setterOpt) => {
        return new Promise(resolve => {
            if (setterOpt.stateOnly) {
                // chrome.storageは更新せずstateだけに反映させる
                // とりあえず現在のページの表示に反映させたいだけ、という場合に有効
                stateList[stateName][0] = newValue;
                resolve();
            }
            else {
                // chrome.storageにも反映
                storage[storageType].get(data => {
                    const process = set(data, useOptPathList[stateName], newValue);
                    storage[storageType].set(process, resolve);
                });
            }
        });
    });
    // 複数のstateListを更新する
    const promiseSetterMulti = useRef((updateProcedures) => {
        return new Promise(async (resolve) => {
            let data = await storage[storageType].get();
            for (const [stateName, newValue] of Object.entries(updateProcedures)) {
                data = set(data, useOptPathList[stateName], newValue);
            }
            storage[storageType].set(data, resolve);
        });
    });
    return [
        stateList,
        {
            isLoadingCompleted,
            promiseSetterMulti: promiseSetterMulti.current,
            useOptPathList,
        },
    ];
};
export { useChromeStorage as default };
export * from './type';
