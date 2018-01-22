import { NativeModules, Alert } from 'react-native';
import iapRecord from './iapRecord';

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

/**
  * ctx:
  * {
  *   productId: number,
  *   isLoggedIn: bool,
  *   login: func,
  *   iapRecordVendor?:
  *     {
  *       getPayRecord,
  *       savePayRecord,
  *       removePayRecord
  *     }
  *   }
  * }
 */
export default class Iap {
  constructor(ctx) {
    this.ctx = ctx || {};
    if (!this.ctx.iapRecordVendor) {
      this.ctx.iapRecordVendor = iapRecord;
    }
  }

  async prepare() {
    await this.getProduct();
  }

  async getProduct() {
    if (this._getProductPromise) {
      return await this._getProductPromise;
    }
    this._getProductPromise = loadProducts([this.ctx.productId])
    .then((products) => {
      return products && products[0];
    })
    .catch((e) => {
      console.error('failed to loadProduct, id: ', this.ctx);
      return null;
    });

    return await this.getProduct();
  }

  // callback([appStoreProduct, paymentInfo, isCached]), return Promise<[bool, passdata]>, indicate success fail
  // return: [success: bool, passdata]
  async purchase(callback) {
    try {
      const { iapRecordVendor, productId } = this.ctx;
      const { savePayRecord, removePayRecord, getPayRecord } = iapRecordVendor;

      // 先检查已支付的记录
      const rec = await getPayRecord.call(iapRecordVendor, productId);
      if (rec) {
        if (rec.length !== 2) {
          throw new Error('invalid pay record');
        }
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
      if (success) {
        return [success, passdata];
      }

      // 新的记录，提交失败了，保存
      await savePayRecord.call(iapRecordVendor, appStoreProduct, paymentInfo);
      return [false, passdata];
    } catch (e) {
      console.error('purchase failed, error: ', e);
      return [false, e];
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

    return await purchaseProduct(this.ctx.productId);
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
}
