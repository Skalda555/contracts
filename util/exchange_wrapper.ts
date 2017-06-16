import { formatters } from './formatters';
import { Order } from './order';
import { ContractInstance } from './types';
import * as BigNumber from 'bignumber.js';

export class ExchangeWrapper {
  private exchange: ContractInstance;
  constructor(exchangeContractInstance: ContractInstance) {
    this.exchange = exchangeContractInstance;
  }
  public fillAsync(order: Order, from: string,
                   opts: { fillTakerTokenAmount?: BigNumber.BigNumber,
                           shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmount);
    return this.exchange.fill(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public cancelAsync(order: Order, from: string, opts: { cancelTakerTokenAmount?: BigNumber.BigNumber } = {}) {
    const params = order.createCancel(opts.cancelTakerTokenAmount);
    return this.exchange.cancel(
      params.orderAddresses,
      params.orderValues,
      params.cancelTakerTokenAmount,
      { from },
    );
  }
  public fillOrKillAsync(order: Order, from: string, opts: { fillTakerTokenAmount?: BigNumber.BigNumber } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = true;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance, opts.fillTakerTokenAmount);
    return this.exchange.fillOrKill(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchFillOrdersAsync(orders: Order[], from: string,
                              opts: { fillValuesT?: BigNumber.BigNumber[],
                                      shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = formatters.createBatchFill(orders, shouldThrowOnInsufficientBalanceOrAllowance, opts.fillValuesT);
    return this.exchange.batchFillOrders(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmounts,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public fillOrdersUpToAsync(orders: Order[], from: string,
                             opts: { fillTakerTokenAmount?: BigNumber.BigNumber,
                                     shouldThrowOnInsufficientBalanceOrAllowance?: boolean } = {}) {
    const shouldThrowOnInsufficientBalanceOrAllowance = !!opts.shouldThrowOnInsufficientBalanceOrAllowance;
    const params = formatters.createFillUpTo(orders,
                                             shouldThrowOnInsufficientBalanceOrAllowance,
                                             opts.fillTakerTokenAmount);
    return this.exchange.fillOrdersUpTo(
      params.orderAddresses,
      params.orderValues,
      params.fillTakerTokenAmount,
      params.shouldThrowOnInsufficientBalanceOrAllowance,
      params.v,
      params.r,
      params.s,
      { from },
    );
  }
  public batchCancelOrdersAsync(orders: Order[], from: string, opts: { cancelValuesT?: BigNumber.BigNumber[] } = {}) {
    const params = formatters.createBatchCancel(orders, opts.cancelValuesT);
    return this.exchange.batchCancelOrders(
      params.orderAddresses,
      params.orderValues,
      params.cancelTakerTokenAmounts,
      { from },
    );
  }
  public getOrderHashAsync(order: Order) {
    const shouldThrowOnInsufficientBalanceOrAllowance = false;
    const params = order.createFill(shouldThrowOnInsufficientBalanceOrAllowance);
    return this.exchange.getOrderHash(params.orderAddresses, params.orderValues);
  }
  public isValidSignatureAsync(order: Order) {
    const isValidSignature = this.exchange.isValidSignature(
      order.params.maker,
      order.params.orderHashHex,
      order.params.v,
      order.params.r,
      order.params.s,
    );
    return isValidSignature;
  }
}
