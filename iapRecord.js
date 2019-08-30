import iCloudStorage from 'react-native-icloudstore';
import DeviceInfo from 'react-native-device-info';

const bid = DeviceInfo.getBundleId();
const SAVED_PAY_RECORD_PREFIX = bid ? `${bid}-` : '';

export default {
  payRecordKey(appStoreProductId) {
    return `${SAVED_PAY_RECORD_PREFIX}${appStoreProductId}`;
  },

  savePayRecord(appStoreProduct, paymentInfo) {
    const key = this.payRecordKey(appStoreProduct.identifier);
    if (!key) {
      return Promise.reject('no key to save pay record, should not happen');
    }
    const item = { appStoreProduct, paymentInfo };
    return Promise.resolve(item)
    .then(it => JSON.stringify(it))
    .then(value => Promise.all([iCloudStorage.setItem(key, value), value]))
    .then((res) => {
      console.log(`did save pay record: ${res[1]}, forkey: ${key}`);
    })
    .then(() => true);
  },

  getPayRecord(appStoreProductId) {
    const key = this.payRecordKey(appStoreProductId);
    return iCloudStorage.getItem(key)
    .then(str => str && JSON.parse(str))
    .then((data) => {
      if (!data) return null;
      console.log(`did get pay record from icloud: ${JSON.stringify(data)}, forKey: ${key}`);
      const { appStoreProduct, paymentInfo } = data;
      // 兼容老数据、新版本in-app-util
      if (paymentInfo && !paymentInfo.transactionReceipt) {
        paymentInfo.transactionReceipt = paymentInfo.receipt;
      }
      return [appStoreProduct, paymentInfo];
    });
  },

  removePayRecord(appStoreProductId) {
    const key = this.payRecordKey(appStoreProductId);
    return removePayRecord(key);
  },
};

function removePayRecord(key) {
  return iCloudStorage.removeItem(key)
    .then(() => {
      console.log(`did remove pay record for key: ${key}`);
    })
    .catch((error) => {
      console.error(`failed to rm pay record, error: ${JSON.stringify(error)}`);
      return Promise.reject(error);
    });
}
