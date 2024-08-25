import { EventUtil } from "../utils/event-util";
import { Mapper } from "../mappers/mapper";
import { DBHandler } from "../handlers/db-handler";

const TABLE_NAME = process.env.TABLE_NAME??"orders";

export const handler = async(event: any = {}): Promise<any> => {
  console.log('In create-order. Table name: ', TABLE_NAME);
  const parsedEvent = EventUtil.parseEvent(event);
  
  const order = Mapper.mapCreateOrder(parsedEvent.customerID, parsedEvent.eventBody);

  const dbHandler:DBHandler = new DBHandler(TABLE_NAME);
  await dbHandler.putOrder(order);

  console.log('Item inserted successfully. OrderId: ', order.orderID);

  return { statusCode: 201 };
}
