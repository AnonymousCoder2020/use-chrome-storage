declare const _default: {
    tabSendMessage: <T>(tabId: number, message: any) => Promise<T>;
    sendMessage: (message: any) => Promise<unknown>;
    storage: {
        set(type: import("../type").StorageType, data: any): Promise<unknown>;
        remove(type: import("../type").StorageType, removeKey: string | string[]): Promise<unknown>;
    };
    tabs: {
        executeScript(details: chrome.tabs.InjectDetails): Promise<unknown>;
    };
};
export default _default;
