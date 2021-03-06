import * as assert from 'assert';
import * as BigNumber from 'bignumber.js';
import ethUtil = require('ethereumjs-util');
import { BNUtil } from '../../../util/bn_util';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { Order } from '../../../util/order';
import { Artifacts } from '../../../util/artifacts';

const {
  Exchange,
  TokenRegistry,
} = new Artifacts(artifacts);

const { toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const feeRecipient = accounts[1] || accounts[accounts.length - 1];

  let order: Order;
  let exchangeWrapper: ExchangeWrapper;
  let orderFactory: OrderFactory;

  before(async () => {
    const [tokenRegistry, exchange] = await Promise.all([
      TokenRegistry.deployed(),
      Exchange.deployed(),
    ]);
    exchangeWrapper = new ExchangeWrapper(exchange);
    const [repAddress, dgdAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('REP'),
      tokenRegistry.getTokenAddressBySymbol('DGD'),
    ]);
    const defaultOrderParams = {
      exchangeContractAddress: Exchange.address,
      maker,
      feeRecipient,
      makerToken: repAddress,
      takerToken: dgdAddress,
      makerTokenAmount: toSmallestUnits(100),
      takerTokenAmount: toSmallestUnits(200),
      makerFee: toSmallestUnits(1),
      takerFee: toSmallestUnits(1),
    };
    orderFactory = new OrderFactory(defaultOrderParams);
  });

  beforeEach(async () => {
    order = await orderFactory.newSignedOrderAsync();
  });

  describe('getOrderHash', () => {
    it('should output the correct orderHash', async () => {
      const orderHashHex = await exchangeWrapper.getOrderHashAsync(order);
      assert.equal(order.params.orderHashHex, orderHashHex);
    });
  });

  describe('isValidSignature', () => {
    beforeEach(async () => {
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should return true with a valid signature', async () => {
      const success = await exchangeWrapper.isValidSignatureAsync(order);
      const isValidSignature = order.isValidSignature();
      assert(isValidSignature);
      assert(success);
    });

    it('should return false with an invalid signature', async () => {
      order.params.r = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
      order.params.s = ethUtil.bufferToHex(ethUtil.sha3('invalidS'));
      const success = await exchangeWrapper.isValidSignatureAsync(order);
      assert(!order.isValidSignature());
      assert(!success);
    });
  });

  describe('isRoundingError', () => {
    it('should return false if there is a rounding error of 0.1%', async () => {
      const numerator = new BigNumber(20);
      const denominator = new BigNumber(999);
      const target = new BigNumber(50);
      // rounding error = ((20*50/999) - floor(20*50/999)) / (20*50/999) = 0.1%
      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, false);
    });

    it('should return false if there is a rounding of 0.09%', async () => {
      const numerator = new BigNumber(20);
      const denominator = new BigNumber(9991);
      const target = new BigNumber(500);
      // rounding error = ((20*500/9991) - floor(20*500/9991)) / (20*500/9991) = 0.09%
      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, false);
    });

    it('should return true if there is a rounding error of 0.11%', async () => {
      const numerator = new BigNumber(20);
      const denominator = new BigNumber(9989);
      const target = new BigNumber(500);
      // rounding error = ((20*500/9989) - floor(20*500/9989)) / (20*500/9989) = 0.011%
      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, true);
    });

    it('should return true if there is a rounding error > 0.1%', async () => {
      const numerator = new BigNumber(3);
      const denominator = new BigNumber(7);
      const target = new BigNumber(10);
      // rounding error = ((3*10/7) - floor(3*10/7)) / (3*10/7) = 6.67%
      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, true);
    });

    it('should return false when there is no rounding error', async () => {
      const numerator = new BigNumber(1);
      const denominator = new BigNumber(2);
      const target = new BigNumber(10);

      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, false);
    });

    it('should return false when there is rounding error <= 0.1%', async () => {
      // randomly generated numbers
      const numerator = new BigNumber(76564);
      const denominator = new BigNumber(676373677);
      const target = new BigNumber(105762562);
      // rounding error = ((76564*105762562/676373677) - floor(76564*105762562/676373677)) / (76564*105762562/676373677) = 0.0007%
      const isRoundingError = await exchangeWrapper.isRoundingErrorAsync(numerator, denominator, target);
      assert.equal(isRoundingError, false);
    });
  });

  describe('getPartialAmount', () => {
    it('should return the numerator/denominator*target', async () => {
      const numerator = new BigNumber(1);
      const denominator = new BigNumber(2);
      const target = new BigNumber(10);

      const partialAmount = await exchangeWrapper.getPartialAmountAsync(numerator, denominator, target);
      const expectedPartialAmount = '5';
      assert.equal(partialAmount.toString(), expectedPartialAmount);
    });

    it('should round down', async () => {
      const numerator = new BigNumber(2);
      const denominator = new BigNumber(3);
      const target = new BigNumber(10);

      const partialAmount = await exchangeWrapper.getPartialAmountAsync(numerator, denominator, target);
      const expectedPartialAmount = '6';
      assert.equal(partialAmount.toString(), expectedPartialAmount);
    });

    it('should round .5 down', async () => {
      const numerator = new BigNumber(1);
      const denominator = new BigNumber(20);
      const target = new BigNumber(10);

      const partialAmount = await exchangeWrapper.getPartialAmountAsync(numerator, denominator, target);
      const expectedPartialAmount = '0';
      assert.equal(partialAmount.toString(), expectedPartialAmount);
    });
  });
});
