type StorageType = 'local' | 'sync'

const tabSendMessage = <T>(tabId: number, message: any) =>
  new Promise<T>(resolve => {
    chrome.tabs.sendMessage(tabId, message, res => resolve(res))
  })

const sendMessage = (message: any) =>
  new Promise(resolve => {
    chrome.runtime.sendMessage(message, resolve)
  })

const storage = {
  set(type: StorageType, data: any) {
    return new Promise(resolve => {
      chrome.storage[type].set(data, resolve)
    })
  },
  remove(type: StorageType, removeKey: string | string[]) {
    return new Promise(resolve => {
      chrome.storage[type].remove(removeKey, resolve)
    })
  },
}

const tabs = {
  executeScript(details: chrome.tabs.InjectDetails) {
    return new Promise(resolve => {
      chrome.tabs.executeScript(details, resolve)
    })
  },
}

export default { tabSendMessage, sendMessage, storage, tabs }
