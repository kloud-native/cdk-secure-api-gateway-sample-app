import { OrderUtil } from '../utils/order-util';
import { DateUtil } from '../utils/date-util';
import { Order } from "../entities/order";
import { OrderItem } from "../entities/order-item";

export class Mapper {
  public static mapCreateOrder(customerID:string, requestBody:any):Order {
    const orderId = OrderUtil.generateOrderId();
    const orderDateISO = DateUtil.currentDateInISOUpToSeconds();
    
    const orderItems = Mapper.mapOrderItems(requestBody);
    const order = new Order(customerID, orderDateISO, orderId, orderItems);
    return order;
  }
  public static mapUpdateOrder(order:Order, eventBody:any):Order {
    const orderItems = Mapper.mapOrderItems(eventBody);
    order.orderItems = orderItems;
    return order;
  }
  private static mapOrderItems(requestBody:any):OrderItem[] {
    let orderItems:OrderItem[] = [];
    requestBody.orderItems.forEach((item: { productID: String; productTitle: String; productPrice: Number; quantity: Number; }) => {
      orderItems.push(
        new OrderItem(item.productID, item.productTitle, item.productPrice, item.quantity)
      )
    });
    return orderItems;
  }
}