import { randomUUID } from "crypto";

export class OrderUtil {
  public static generateOrderId():string {
    return randomUUID()
  }
}