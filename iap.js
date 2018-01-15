import { NativeModules, Alert } from 'react-native';

// 转化成promise方法
const promisify = (fn, receiver) => (
  (...args) => (
    new Promise((resolve, reject) => {
      fn.apply(receiver, [...args, (err, res) => (
        err ? reject(err) : resolve(res)
      )]);
    })
  )
);

const { InAppUtils, ZKFileUtils } = NativeModules;
const purchaseProduct = promisify(InAppUtils.purchaseProduct, { thisArg:InAppUtils });
const loadProducts = promisify(InAppUtils.loadProducts, { thisArg:InAppUtils });


function identity(whatever) {
  return whatever;
}

function icloudAvailable() {
  return new Promise((resolve, reject) => {
    ZKFileUtils.isIcloudAvailable((error, available) => {
      if (error) {
        reject(error);
      } else {
        resolve(available);
      }
    });
  });
}

function shouldSaveRecord(rec) {
  return true;
}

/**
  * ctx:
  * {
  *   isLoggedIn: bool,
  *   login: func,
  *   toAppStoreProductId?: func,
  *   shouldSavePayRecord?: func,
  *   iapRecordVendor:
  *     {
  *       getPayRecord,
  *       savePayRecord,
  *       removePayRecord
  *     }
  *   }
  * }
 */
export default class Iap {
  constructor(productId, ctx) {
    this.id = productId;
    this.ctx = ctx || {};
  }

  async prepare() {
    await this.getProduct();
  }

  async getProduct() {
    if (this._getProductPromise) {
      return await this._getProductPromise;
    }
    this._getProductPromise = loadProducts([this._toAppStoreProductId()])
    .then((products) => {
      return products && products[0];
    })
    .catch((e) => {
      console.error('failed to loadProduct, id: ', this._toAppStoreProductId());
      return null;
    });

    return await this.getProduct();
  }

  // callback([appStoreProduct, paymentInfo, isCached]), return Promise<[bool, passdata]>, indicate success fail
  // return: [success: bool, passdata]
  async purchase(callback, ctx) {
    try {
      const { iapRecordVendor } = this.ctx;
      const { savePayRecord, removePayRecord } = iapRecordVendor;

      // 先检查已保存的记录
      const rec = await this._getIapPayRecord().catch(() => null);
      if (rec) {
        const ret = await Promise.resolve(callback([...rec, true]));
        if (!ret[0]) {
          return ret;
        }
        // 已有的记录，提交成功就删掉
        await removePayRecord.call(iapRecordVendor, rec);
        return ret;
      }

      const appStoreProduct = await this.getProduct();
      if (!appStoreProduct) {
        const ret = await callback(null);
        return ret;
      }

      const paymentInfo = await this._iapPay();
      const [success, passdata] = await Promise.resolve(callback([appStoreProduct, paymentInfo]));
      if (success || !shouldSaveRecord([appStoreProduct, paymentInfo])) {
        return [success, passdata];
      }

      // 新的记录，提交失败了，并且重要（price > 0），就保存
      await savePayRecord.call(iapRecordVendor, appStoreProduct, paymentInfo);
      return [false, passdata];
    } catch (e) {
      console.error('purchase failed, error: ', e);
      return [false];
    }
  }

  async _getIapPayRecord() {
    try {
      const { iapRecordVendor } = this.ctx;
      const { getPayRecord } = iapRecordVendor;
      const ret = await getPayRecord.call(iapRecordVendor, this._toAppStoreProductId());
      return ret;
    } catch (e) {
      return null;
    }
  }

  async _iapPay(alertIfNoUser = true) {
    const isLoggedIn = this._isLoggedIn();
    if (!isLoggedIn && alertIfNoUser) {
      return await new Promise((resolve, reject) => {
        Alert.alert(
          '友情提示',
          '您正在未登录的情况下购买课程。\
          支付完成后，您可以在本机登录智课账号以便提交订单。\
          如果您需要在其他手机提交订单，请确保已经使用您的Apple Id登录iCloud。',
          [
            {
              text: '先去登录',
              onPress: () => {
                reject('支付已取消');
                this._goLogin();
              },
            },
            {
              text: '继续',
              onPress: () => {
                icloudAvailable()
                .then((avail) => {
                  if (avail) {
                    resolve(this._iapPay(false));
                  } else {
                    reject('请打开iCloud存储权限，然后重新尝试报名。');
                  }
                })
                .catch((error) => {
                  reject(error);
                });
              },
            },
            {
              text: '取消',
              onPress: () => {
                reject('支付已取消');
              },
            },
          ]
        );
      });
    }

    return await purchaseProduct(this._toAppStoreProductId());
  }

  // convenient
  _isLoggedIn() {
    return this.ctx && !!this.ctx.isLoggedIn;
  }

  _goLogin() {
    const { login } = this.ctx;
    if (login) {
      login(this.ctx);
    }
  }

  _toAppStoreProductId() {
    const { toAppStoreProductId } = this.ctx;
    if (toAppStoreProductId) {
      return toAppStoreProductId(this.id);
    }

    return identity(this.id);
  }
}
