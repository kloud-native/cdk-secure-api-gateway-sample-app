import { OrderItem } from "./order-item";

export class Order {
  public customerID:String;
  public orderDateISO:String;
  public orderID:String;
  public orderItems:OrderItem[];

  public constructor(customerID:String, orderDateISO:String, orderID:String, orderItems:OrderItem[]) {
    this.customerID = customerID;
    this.orderDateISO = orderDateISO;
    this.orderID = orderID;
    this.orderItems = orderItems;
  }

  public static fromDbRecord(record:any):Order{
    const order = new Order(record.customerID, record.orderDateISO, record.orderID, []);
    return order;
  }
}