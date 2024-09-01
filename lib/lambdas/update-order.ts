import { DBHandler } from "../handlers/db-handler";
import { Mapper } from "../mappers/mapper";
import { EventUtil } from "../utils/event-util";

const TABLE_NAME = process.env.TABLE_NAME??"orders";

export const handler = async(event: any = {}): Promise<any> => {
  console.log('In update order. Table name: ', TABLE_NAME);

  const orderID = event.pathParameters.id;
  if (!orderID) {
    return {
      statusCode: 400,
      body: `Error: OrderID not found in request`
    }
  }

  const parseEvent = EventUtil.parseEvent(event);

  const dbHandler = new DBHandler(TABLE_NAME);

  // lookup order
  const order = await dbHandler.getSingleOrder(orderID);

  // perform update
  const orderToUpdate = Mapper.mapUpdateOrder(order, parseEvent.eventBody);
  dbHandler.putOrder(orderToUpdate);
  
  return { statusCode: 201 };
}